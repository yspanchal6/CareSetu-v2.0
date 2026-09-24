import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { emergencySyncClient } from "./services/api";
import { registerOfflineSync, flushQueuedSOS } from "./utils/offlineSync";

// Offline sync engine: flushes queued SOS requests on startup, re-entry,
// visibility, or when the browser reports the network is online.
registerOfflineSync(emergencySyncClient);
void flushQueuedSOS(emergencySyncClient); // startup trigger (concurrency-guarded)

// Offline fallback service worker — production builds only (dev reloads constantly).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swPath).catch(() => {
      console.warn("[SW] Offline fallback could not be registered.");
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);