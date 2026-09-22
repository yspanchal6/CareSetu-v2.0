/**
 * offlineDB.ts
 * CareSetu Master Structured IndexedDB Layer
 *
 * Provides a versioned, schema-enforced, structured local database on IndexedDB.
 *
 * STORES:
 *  1. sos_queue            — Queued Emergency SOS operations (keyPath: operationId)
 *  2. emergency_profile    — Session-bound minimal profile (keyPath: id)
 *  3. hospital_directory   — Cached public hospital directory (keyPath: id)
 *  4. contact_queue        — Queued non-sensitive support requests (keyPath: operationId)
 *  5. help_content         — Versioned Help & FAQ content (keyPath: id)
 *  6. sync_metadata        — Synchronization status & timestamps (keyPath: key)
 *  7. operations_log       — Local audit & operational log (keyPath: id)
 *  8. offline_drafts       — Non-sensitive form drafts (keyPath: id)
 *  9. ai_offline_state     — Offline Doctor AI safety rule state (keyPath: key)
 * 10. cache_metadata       — Metadata for cached items & versions (keyPath: key)
 *
 * SECURITY RULE: Zero passwords, OTPs, JWT tokens, refresh tokens, encryption keys,
 * or unrestricted medical document files are persisted in IndexedDB.
 */

const DB_NAME = "CareSetuOfflineMasterDB";
const DB_VERSION = 2;

export interface SOSQueueRecord {
  operationId: string;
  symptoms: string;
  emergencyType: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  createdAt: string;
  expiresAt: string;
  syncStatus: "PENDING_SYNC" | "SYNCING" | "SYNCED" | "RETRY_WAIT" | "FAILED" | "EXPIRED";
  retryCount: number;
  sessionUserId?: string;
}

export interface ContactQueueRecord {
  operationId: string;
  category: string;
  message: string;
  email?: string;
  phone?: string;
  createdAt: string;
  expiresAt: string;
  syncStatus: "PENDING_SYNC" | "SYNCING" | "SYNCED" | "FAILED";
  retryCount: number;
  sessionUserId?: string;
}

export interface HospitalDirectoryRecord {
  id: string;
  name: string;
  address: string;
  phone: string;
  city?: string;
  capabilities: string[];
  location: { latitude: number; longitude: number };
  cachedAt: string;
  expiresAt: string;
  dataVersion: string;
}

export interface HelpContentRecord {
  id: string;
  category: string;
  question: string;
  answer: string;
  version: string;
  cachedAt: string;
  expiresAt: string;
}

export interface EmergencyProfileRecord {
  id: string;
  sessionUserId: string;
  bloodGroup?: string;
  allergies?: string;
  medicalConditions?: string;
  heartCondition?: string;
  diabetesStatus?: string;
  hypertensionStatus?: string;
  medications?: string;
  emergencyContacts?: any;
  updatedAt: string;
  expiresAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event: any) => {
      const db: IDBDatabase = event.target.result;

      // 1. sos_queue
      if (!db.objectStoreNames.contains("sos_queue")) {
        const store = db.createObjectStore("sos_queue", { keyPath: "operationId" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }

      // 2. emergency_profile
      if (!db.objectStoreNames.contains("emergency_profile")) {
        const store = db.createObjectStore("emergency_profile", { keyPath: "id" });
        store.createIndex("sessionUserId", "sessionUserId", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }

      // 3. hospital_directory
      if (!db.objectStoreNames.contains("hospital_directory")) {
        const store = db.createObjectStore("hospital_directory", { keyPath: "id" });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }

      // 4. contact_queue
      if (!db.objectStoreNames.contains("contact_queue")) {
        const store = db.createObjectStore("contact_queue", { keyPath: "operationId" });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("sessionUserId", "sessionUserId", { unique: false });
      }

      // 5. help_content
      if (!db.objectStoreNames.contains("help_content")) {
        const store = db.createObjectStore("help_content", { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("version", "version", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }

      // 6. sync_metadata
      if (!db.objectStoreNames.contains("sync_metadata")) {
        const store = db.createObjectStore("sync_metadata", { keyPath: "key" });
        store.createIndex("lastSyncAt", "lastSyncAt", { unique: false });
      }

      // 7. operations_log
      if (!db.objectStoreNames.contains("operations_log")) {
        const store = db.createObjectStore("operations_log", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("action", "action", { unique: false });
      }

      // 8. offline_drafts
      if (!db.objectStoreNames.contains("offline_drafts")) {
        const store = db.createObjectStore("offline_drafts", { keyPath: "id" });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // 9. ai_offline_state
      if (!db.objectStoreNames.contains("ai_offline_state")) {
        const store = db.createObjectStore("ai_offline_state", { keyPath: "key" });
        store.createIndex("lastCheck", "lastCheck", { unique: false });
      }

      // 10. cache_metadata
      if (!db.objectStoreNames.contains("cache_metadata")) {
        const store = db.createObjectStore("cache_metadata", { keyPath: "key" });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };

    req.onsuccess = (e: any) => resolve(e.target.result);
    req.onerror = (e: any) => reject(e.target.error);
  });
}

export async function putRecord<T = any>(storeName: string, record: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = (e: any) => reject(e.target.error);
  });
}

export async function getRecord<T = any>(storeName: string, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = (e: any) => resolve(e.target.result || null);
    req.onerror = (e: any) => reject(e.target.error);
  });
}

export async function getAllRecords<T = any>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = (e: any) => resolve(e.target.result || []);
    req.onerror = (e: any) => reject(e.target.error);
  });
}

export async function deleteRecord(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e: any) => reject(e.target.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e: any) => reject(e.target.error);
  });
}

/**
 * Purges records whose `expiresAt` ISO date string has passed.
 */
export async function purgeExpiredRecords(): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const stores = ["sos_queue", "emergency_profile", "hospital_directory", "contact_queue", "help_content", "cache_metadata"];

    for (const storeName of stores) {
      const records = await getAllRecords<any>(storeName);
      for (const rec of records) {
        if (rec.expiresAt && rec.expiresAt < nowIso) {
          await deleteRecord(storeName, rec.operationId || rec.id || rec.key);
        }
      }
    }
  } catch (e) {
    console.warn("[offlineDB] Purge expired records warning:", e);
  }
}

/**
 * Clears user-bound sensitive stores upon logout or session termination.
 */
export async function clearSensitiveLocalData(): Promise<void> {
  try {
    await clearStore("emergency_profile");
    await clearStore("offline_drafts");
    await clearStore("sos_queue");
    await clearStore("contact_queue");
    console.log("[offlineDB] Sensitive local data cleared cleanly.");
  } catch (e) {
    console.warn("[offlineDB] Failed to clear sensitive local data:", e);
  }
}
