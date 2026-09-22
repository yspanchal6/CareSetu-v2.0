import { useState, useEffect } from "react";
import { subscribeSyncEngine, SyncEngineStatus } from "../utils/syncEngine";

export type ConnectionState = "ONLINE" | "OFFLINE" | "RECONNECTING" | "SERVER_UNREACHABLE";
export type ConnectivityUIStatus =
  | "ONLINE"
  | "OFFLINE"
  | "RECONNECTING"
  | "SYNCING"
  | "SYNC_COMPLETE"
  | "SYNC_FAILED";

export interface ConnectivityInfo {
  state: ConnectionState;
  uiStatus: ConnectivityUIStatus;
  isOnline: boolean;
  isServerReachable: boolean;
  syncStatus: SyncEngineStatus;
}

/**
 * useConnectivity Hook
 * Lightweight health ping + navigator events + sync engine state integration.
 */
export function useConnectivity(pingEndpoint: string = "/api/health"): ConnectivityInfo {
  const [isBrowserOnline, setIsBrowserOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isServerReachable, setIsServerReachable] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>({
    isSyncing: false,
    pendingSOSCount: 0,
    pendingContactCount: 0,
    lastSyncAt: null,
    lastSyncError: null,
    authRequired: false,
  });

  // Subscribe to Sync Engine
  useEffect(() => {
    return subscribeSyncEngine((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Browser Online/Offline Event Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      setIsReconnecting(true);
      // Verify actual backend reachability
      checkReachability().finally(() => setIsReconnecting(false));
    };

    const handleOffline = () => {
      setIsBrowserOnline(false);
      setIsServerReachable(false);
      setIsReconnecting(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pingEndpoint]);

  // Lightweight Health Ping
  const checkReachability = async (): Promise<boolean> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsServerReachable(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res = await fetch(pingEndpoint, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const reachable = res.ok || res.status === 404 || res.status === 401; // Server responded
      setIsServerReachable(reachable);
      return reachable;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  };

  // Periodic low-frequency reachability check (30s when online, 10s when offline)
  useEffect(() => {
    const intervalTime = isBrowserOnline ? 30000 : 10000;
    const timer = setInterval(() => {
      void checkReachability();
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isBrowserOnline, pingEndpoint]);

  // Compute Overall Connection State
  let state: ConnectionState = "ONLINE";
  if (!isBrowserOnline) {
    state = "OFFLINE";
  } else if (isReconnecting) {
    state = "RECONNECTING";
  } else if (!isServerReachable) {
    state = "SERVER_UNREACHABLE";
  }

  // Compute UI Display Status
  let uiStatus: ConnectivityUIStatus = "ONLINE";
  if (state === "OFFLINE" || state === "SERVER_UNREACHABLE") {
    uiStatus = "OFFLINE";
  } else if (state === "RECONNECTING") {
    uiStatus = "RECONNECTING";
  } else if (syncStatus.isSyncing) {
    uiStatus = "SYNCING";
  } else if (syncStatus.lastSyncError) {
    uiStatus = "SYNC_FAILED";
  } else if (syncStatus.pendingSOSCount === 0 && syncStatus.pendingContactCount === 0 && syncStatus.lastSyncAt) {
    uiStatus = "SYNC_COMPLETE";
  }

  return {
    state,
    uiStatus,
    isOnline: state === "ONLINE",
    isServerReachable,
    syncStatus,
  };
}
