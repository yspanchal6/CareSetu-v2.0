import { useEffect, useState } from "react";
import { CircleCheckBig, Loader2, WifiOff, CloudOff } from "lucide-react";
import { systemApi } from "../../services/api";

type ConnectionState = "checking" | "online" | "offline" | "server-down";

export default function ConnectionStatus() {
  const [state, setState] = useState<ConnectionState>("checking");

  useEffect(() => {
    let active = true;

    const checkConnection = async () => {
      // Check device network first
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (active) setState("offline");
        return;
      }

      if (active) setState("checking");
      try {
        await systemApi.health();
        if (active) setState("online");
      } catch {
        // Device is online but backend is unreachable
        if (active) setState("server-down");
      }
    };

    void checkConnection();
    const interval = window.setInterval(() => void checkConnection(), 30000);

    // Listen for browser online/offline events for instant updates
    const onOnline = () => void checkConnection();
    const onOffline = () => { if (active) setState("offline"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const content = state === "online"
    ? { label: "Backend connected", className: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CircleCheckBig }
    : state === "offline"
      ? { label: "You're offline", className: "bg-red-50 text-red-700 border-red-200", Icon: WifiOff }
      : state === "server-down"
        ? { label: "Backend unavailable — retrying", className: "bg-amber-50 text-amber-700 border-amber-200", Icon: CloudOff }
        : { label: "Checking backend…", className: "bg-slate-50 text-slate-600 border-slate-200", Icon: Loader2 };
  const Icon = content.Icon;

  return (
    <div className={`fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg ${content.className}`} role="status" aria-live="polite">
      <Icon className={`h-3.5 w-3.5 ${state === "checking" ? "animate-spin" : ""}`} />
      {content.label}
    </div>
  );
}
