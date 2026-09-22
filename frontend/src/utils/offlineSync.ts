// offlineSync.ts
// Offline Sync Engine (PWA): queues an SOS in IndexedDB and syncs it to the
// backend using the SAME operationId as idempotencyKey so a retry/replay can
// never create a duplicate EmergencyCase.
//
// Truthfulness rules enforced here:
//  - The queue only ever reports "saved locally / waiting / syncing / server
//    received" — never "hospital notified" (that happens server-side after this
//    client acknowledged the POST).
//  - A client timeout is NOT treated as "server missed" — retries reuse the
//    same idempotencyKey so the server returns the existing case.
//  - Failed items are retained and retried with bounded backoff; items are
//    removed ONLY after the server responds successfully.
//  - A concurrency guard ensures two flushes never process the queue together.
//  - An expired auth token surfaces an honest "sign in again" state instead of
//    pretending sync succeeded.

type ApiClient = (endpoint: string, payload: any) => Promise<any>;

type SyncedHandler = (created: { caseId: string; publicCaseId: string }, payload: any) => void | Promise<void>;

export interface OfflineQueueStatus {
  queued: number;
  syncing: boolean;
  lastSyncError: string | null;
  authRequired: boolean;
}

const DB_NAME = "CareSetuOfflineSync";
const STORE_NAME = "sos_queue";
const DB_VERSION = 1;

// Bounded online retry after triggers: attempt, then back off a few seconds and
// stop. We NEVER run an infinite timer / background loop.
const MAX_ONLINE_RETRIES = 3;
const RETRY_BACKOFF_MS = [5000, 15000, 30000];

let syncedHandlers: SyncedHandler[] = [];
let listeners = new Set<(status: OfflineQueueStatus) => void>();
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

const status: OfflineQueueStatus = {
  queued: 0,
  syncing: false,
  lastSyncError: null,
  authRequired: false,
};

function notify() {
  const snapshot = { ...status };
  listeners.forEach((l) => l(snapshot));
}

async function refreshCount() {
  status.queued = await getOfflineQueueCount();
  notify();
}

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "operationId" });
      }
    };

    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
}

export async function queueSOSRequest(payload: any): Promise<void> {
  if (!payload.operationId) {
    throw new Error("Payload must contain an operationId for idempotency.");
  }

  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const request = store.put(payload);

    request.onsuccess = () => resolve();
    request.onerror = (e: any) => reject(e.target.error);
  });
  void refreshCount();
}

export async function getQueuedSOSRequests(): Promise<any[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
}

export async function removeQueuedSOSRequest(operationId: string): Promise<void> {
  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(operationId);

    request.onsuccess = () => resolve();
    request.onerror = (e: any) => reject(e.target.error);
  });
  void refreshCount();
}

export async function getOfflineQueueCount(): Promise<number> {
  try {
    const q = await getQueuedSOSRequests();
    return q.length;
  } catch {
    return 0;
  }
}

/**
 * Subscribe to live queue status for UI ("Saved locally / Waiting for
 * connection / Syncing / Sign in again to sync..."). Returns unsubscribe.
 */
export function subscribeOfflineQueue(listener: (s: OfflineQueueStatus) => void): () => void {
  listeners.add(listener);
  listener({ ...status });
  return () => {
    listeners.delete(listener);
  };
}

export function getOfflineQueueStatus(): OfflineQueueStatus {
  return { ...status };
}

/**
 * Registers a callback that fires after an offline-queued SOS is successfully
 * synced to the backend. Used by the SOS page to revive the created case.
 */
export function onOfflineSynced(handler: SyncedHandler) {
  syncedHandlers.push(handler);
}

export function offOfflineSynced(handler: SyncedHandler) {
  syncedHandlers = syncedHandlers.filter((h) => h !== handler);
}

function isUnauthorized(error: any): boolean {
  return error && (error.status === 401 || error.status === 403);
}

/**
 * One sync pass. Never runs concurrently with another pass.
 * Returns the list of queue entries that were acknowledged by the server.
 */
async function flushPass(apiClient: ApiClient): Promise<Array<{ operationId: string; result: any }>> {
  if (flushing) return [];
  flushing = true;
  status.syncing = true;
  status.lastSyncError = null;
  notify();
  const synced: Array<{ operationId: string; result: any }> = [];
  let authRequired = false;

  try {
    const queued = await getQueuedSOSRequests();

    for (const payload of queued) {
      try {
        const requestPayload = {
          symptoms: payload.symptoms,
          latitude: typeof payload.latitude === "number" ? payload.latitude : undefined,
          longitude: typeof payload.longitude === "number" ? payload.longitude : undefined,
          idempotencyKey: payload.operationId,
          emergencyType: payload.emergencyType,
        };

        console.log("[Offline Sync Engine] Flushing SOS payload:", requestPayload);

        // Server acknowledges the create OR the existing case (same key). Only
        // after this resolves may we remove the item — no fabrication.
        const result = await apiClient("/api/emergency/sos", requestPayload);

        await removeQueuedSOSRequest(payload.operationId);
        console.log(`[Offline Sync Engine] Successfully synced ${payload.operationId}`);
        synced.push({ operationId: payload.operationId, result });

        for (const handler of [...syncedHandlers]) {
          try {
            await handler(result, payload);
          } catch (e) {
            console.error("[Offline Sync Engine] sync handler error:", e);
          }
        }
      } catch (error: any) {
        if (isUnauthorized(error)) authRequired = true;
        console.error(`[Offline Sync Engine] Failed to sync ${payload.operationId}, will retry with same key:`, error?.message || error);
      }
    }
  } finally {
    flushing = false;
    status.syncing = false;
    status.authRequired = authRequired;
    await refreshCount();
    notify();
  }

  return synced;
}

/**
 * Flushes the queue to the backend with bounded backoff while online.
 * Trigger-agnostic: safe to call from startup / online / visibility / resume.
 */
export async function flushQueuedSOS(apiClient: ApiClient): Promise<Array<{ operationId: string; result: any }>> {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  const queued = await getOfflineQueueCount();
  if (queued === 0) {
    status.lastSyncError = null;
    status.authRequired = false;
    notify();
    return [];
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    status.lastSyncError = "Waiting for connection";
    notify();
    return [];
  }

  const synced = await flushPass(apiClient);

  const remaining = await getOfflineQueueCount();
  if (remaining > 0 && retryCount < MAX_ONLINE_RETRIES && typeof navigator !== "undefined" && navigator.onLine) {
    retryCount += 1;
    const delay = RETRY_BACKOFF_MS[Math.min(retryCount - 1, RETRY_BACKOFF_MS.length - 1)];
    console.log(`[Offline Sync Engine] ${remaining} item(s) remain; retrying in ${delay}ms (attempt ${retryCount}/${MAX_ONLINE_RETRIES})`);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flushQueuedSOS(apiClient);
    }, delay);
  } else {
    // Either everything synced or we hit the bound — stop until the next trigger.
    retryCount = 0;
  }

  return synced;
}

/**
 * Registers durable, bounded sync triggers once at app startup:
 *  - immediate startup flush (application launch / re-entry)
 *  - browser 'online' event (connectivity restored)
 *  - visibilitychange -> visible (app foregrounded)
 *  - pageshow (browser back/forward cache, PWA resume)
 */
export function registerOfflineSync(apiClient: ApiClient) {
  if (typeof window === "undefined") return;

  const trigger = () => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushQueuedSOS(apiClient);
    }
  };

  // Reset the bounded-retry chain on each fresh external trigger.
  const resetRetry = () => {
    retryCount = 0;
  };
  const triggerReset = () => {
    resetRetry();
    trigger();
  };

  void refreshCount();
  void triggerReset(); // startup / re-entry

  window.addEventListener("online", triggerReset);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") triggerReset();
  });
  window.addEventListener("pageshow", triggerReset);
}