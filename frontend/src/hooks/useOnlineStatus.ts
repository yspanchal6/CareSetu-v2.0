import { useState, useEffect } from "react";

/**
 * Reactive hook that tracks device online/offline status via the browser's
 * `navigator.onLine` property and `online`/`offline` window events.
 *
 * Returns `true` when the device has network connectivity, `false` when offline.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
