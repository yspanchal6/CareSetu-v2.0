import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Siren, MapPin, Phone, PhoneCall, CheckCircle2, AlertTriangle, Bot, CloudOff, RefreshCw, Loader2, User, ShieldAlert } from "lucide-react";
import { emergencyApi, saveActiveEmergencyCase, ApiError, emergencySyncClient } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n/I18nContext";
import {
  queueSOSRequest,
  onOfflineSynced,
  offOfflineSynced,
  subscribeOfflineQueue,
  getOfflineQueueStatus,
  flushQueuedSOS,
} from "../../utils/offlineSync";
import { getOfflineProfile } from "../../utils/offlineProfile";
import Button from "../../components/common/Button";

type FlowStep = "idle" | "locating" | "creating" | "created" | "queued" | "error";

const NAVIGATE_DELAY_MS = 1400;

const CHATBOT_PRESET = {
  source: "CHATBOT",
  symptoms: "Chest pain (severe), Sweating, Shortness of breath, Dizziness",
  emergencyType: "CARDIAC",
};

interface CreatedInfo {
  caseId: string;
  publicCaseId: string;
}

function getCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location services are not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      () =>
        reject(
          new Error("Location is required to find an emergency hospital. Please allow location access and try again.")
        ),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  });
}

export default function EmergencySOSPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<FlowStep>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [created, setCreated] = useState<CreatedInfo | null>(null);
  const [queuedOpId, setQueuedOpId] = useState<string | null>(null);
  const [offlineQueue, setOfflineQueue] = useState(() => getOfflineQueueStatus());
  const [cachedProfile] = useState(() => getOfflineProfile());

  const navigate = useNavigate();

  useEffect(() => {
    return subscribeOfflineQueue(setOfflineQueue);
  }, []);

  useEffect(() => {
    const handler = async (createdCase: { caseId: string; publicCaseId: string }) => {
      const publicCaseId = createdCase.publicCaseId || createdCase.caseId;
      sessionStorage.setItem("caresetu_active_emergency_case", publicCaseId);
      saveActiveEmergencyCase(publicCaseId);
      if (step === "queued") {
        setStep("created");
        setCreated({ caseId: createdCase.caseId, publicCaseId });
      }
      navigate(`/patient/emergency/status/${publicCaseId}`, { replace: true });
    };
    onOfflineSynced(handler);
    return () => offOfflineSynced(handler);
  }, [navigate, step]);

  useEffect(() => {
    if (step !== "created" || !created?.publicCaseId) return;
    const t = window.setTimeout(() => {
      navigate(`/patient/emergency/status/${created.publicCaseId}`, { replace: true });
    }, NAVIGATE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [step, created, navigate]);

  const dispatchSOS = async (preset?: { source: string; symptoms: string; emergencyType: string }) => {
    let pos: { latitude: number; longitude: number; accuracy: number } | undefined;
    try {
      if (step !== "idle") return;
      if (navigator.vibrate) navigator.vibrate(200);
      setStep("locating");

      // Phase 1 — capture the patient's real GPS location (no fake fallbacks).
      pos = await getCurrentLocation();

      // Phase 2 — create the real EmergencyCase via the authenticated API.
      setStep("creating");
      const res = await emergencyApi.create({
        symptoms: preset?.symptoms ?? "Not provided",
        emergencyType: preset?.emergencyType ?? "OTHER",
        source: preset?.source,
        location: {
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          source: "GPS",
        },
        idempotencyKey: crypto.randomUUID(),
      });

      const internalCaseId = res.caseId || res.publicCaseId;
      if (!internalCaseId) throw new Error("No case ID returned by the emergency service.");

      const publicCaseId = res.publicCaseId || res.caseId;

      sessionStorage.setItem("caresetu_active_emergency_case", publicCaseId || internalCaseId);
      saveActiveEmergencyCase(publicCaseId || internalCaseId);

      setCreated({ caseId: internalCaseId, publicCaseId: publicCaseId || internalCaseId });
      setStep("created");
    } catch (err: any) {
      console.error("[SOS]", err);
      const isNetworkFailure = typeof navigator !== "undefined" && (!navigator.onLine || (err instanceof ApiError && err.status === 0));

      if (isNetworkFailure && typeof pos !== "undefined") {
        try {
          const operationId = crypto.randomUUID();
          await queueSOSRequest({
            operationId,
            symptoms: preset?.symptoms ?? "Not provided",
            emergencyType: preset?.emergencyType ?? "OTHER",
            source: preset?.source,
            latitude: pos.latitude,
            longitude: pos.longitude,
            location: {
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: pos.accuracy,
              source: "GPS",
            },
          });
          setQueuedOpId(operationId);
          setCreated(null);
          setStep("queued");
        } catch (queueErr) {
          console.error("[SOS] offline queue failed", queueErr);
          setCreated(null);
          setStep("error");
          setErrorMessage(
            "You're offline and the automatic queue could not be saved. Please call 108 immediately."
          );
        }
        return;
      }

      setCreated(null);
      setStep("error");
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage("Authentication session required or expired. Please log in to dispatch an emergency SOS.");
        } else if (err.status === 403) {
          setErrorMessage("Insufficient permissions. Emergency SOS is restricted to Patient accounts and active Guest sessions.");
        } else if (err.status === 409) {
          setErrorMessage("An emergency SOS request is already active or in progress for your account.");
        } else if (err.status === 429) {
          setErrorMessage("Too many SOS requests triggered in a short duration. Please call 108 immediately.");
        } else if (err.status === 500) {
          setErrorMessage("Server error encountered while initializing emergency case. Please call 108 immediately.");
        } else {
          setErrorMessage(err.message || "Emergency request failed. Please call 108 for immediate help.");
        }
      } else {
        setErrorMessage(
          err?.message?.includes("Location")
            ? err.message
            : err?.message
            ? `${err.message} — Please call 108 for immediate help.`
            : "SOS failed. Please call 108 for immediate help."
        );
      }
    }
  };

  /* ────────────────────────── RENDER ────────────────────────── */

  if (step === "created" && created) {
    return (
      <div className="flex flex-col items-center text-center pt-10 pb-6 max-w-sm mx-auto px-4">
        <div className="relative mt-2 mb-4">
          <div className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.5)] animate-check-pop">
            <CheckCircle2 className="w-14 h-14 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Emergency case created</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Your SOS has been received. Opening live tracking...</p>

        <div className="mt-6 w-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 rounded-card p-5">
          <p className="text-xs uppercase tracking-wide font-bold text-emerald-700 dark:text-emerald-400">Case Reference ID</p>
          <p className="font-mono text-lg font-extrabold text-emerald-900 dark:text-emerald-200 mt-1 break-all">
            {created.publicCaseId}
          </p>
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
          Redirecting to live emergency tracking…
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center text-center pt-10 pb-6 max-w-sm mx-auto px-4">
        <div className="mt-2 mb-4">
          <div className="w-24 h-24 rounded-full bg-rose-50 dark:bg-rose-950 flex items-center justify-center animate-x-pop">
            <AlertTriangle className="w-12 h-12 text-rose-600 dark:text-rose-400" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Emergency request failed</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{errorMessage}</p>

        <div className="w-full mt-6 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/80 rounded-card p-4">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Call 108 — Ambulance / Emergency</p>
          <a
            href="tel:108"
            className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-rose-600 rounded-xl py-3 px-4 mt-3 shadow-emergency"
          >
            <Phone className="w-4 h-4" /> Call 108
          </a>
        </div>

        <button
          onClick={() => {
            setStep("idle");
            setErrorMessage("");
          }}
          className="mt-6 text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline"
        >
          ← Try again
        </button>
      </div>
    );
  }

  if (step === "queued") {
    return (
      <div className="flex flex-col items-center text-center pt-10 pb-6 max-w-sm mx-auto px-4">
        <div className="mt-2 mb-4">
          <div className="w-24 h-24 rounded-full bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
            <CloudOff className="w-12 h-12 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">SOS SAVED ON THIS DEVICE</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Internet connection unavailable.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
          Your request is stored securely on this phone and will be sent to the emergency service automatically as soon as a connection is restored.
        </p>

        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
          {offlineQueue.syncing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing…
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Waiting for connection
            </>
          )}
        </div>

        {offlineQueue.authRequired && (
          <p className="mt-3 text-xs font-bold text-amber-800 dark:text-amber-400">
            Your session expired. Sign in again to sync your saved SOS.
          </p>
        )}

        {!offlineQueue.syncing && navigator.onLine && (
          <button
            onClick={() => void flushQueuedSOS(emergencySyncClient)}
            className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 rounded-full px-4 py-2 hover:bg-sky-100"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Sync now
          </button>
        )}

        <div className="mt-6 w-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 rounded-card p-4 text-left">
          <p className="text-xs uppercase tracking-wide font-bold text-amber-800 dark:text-amber-400">Queued reference</p>
          <p className="font-mono text-sm text-amber-900 dark:text-amber-200 mt-1 break-all">{queuedOpId}</p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
            Your GPS location was captured at the time you tapped SOS. The request will be delivered to the nearest hospitals as soon as you regain a connection.
          </p>
        </div>

        {cachedProfile?.emergencyContacts && cachedProfile.emergencyContacts.length > 0 && (
          <div className="w-full mt-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-card p-4 text-left">
            <p className="text-xs uppercase tracking-wide font-bold text-slate-500 dark:text-slate-400">Emergency contacts</p>
            <div className="mt-2 space-y-2">
              {cachedProfile.emergencyContacts.map((contact, i) => (
                <a
                  key={`${contact.phone}-${i}`}
                  href={`tel:${contact.phone.replace(/[^0-9+]/g, "")}`}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 border border-slate-200/60 dark:border-slate-700"
                >
                  <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{contact.name}</span>
                    {contact.relation && (
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{contact.relation}</span>
                    )}
                  </span>
                  <Phone className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="w-full mt-6 border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/80 rounded-card p-4">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Need immediate help?</p>
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">Call emergency services directly</p>
          <div className="flex gap-2 mt-3">
            <a
              href="tel:108"
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-rose-600 rounded-xl py-3 px-4 shadow-emergency"
            >
              <Phone className="w-4 h-4" /> Call 108
            </a>
            <a
              href="tel:112"
              className="flex-1 flex items-center justify-center gap-2 text-sm font-bold text-white bg-red-700 rounded-xl py-3 px-4"
            >
              <PhoneCall className="w-4 h-4" /> Call 112
            </a>
          </div>
        </div>

        <button
          onClick={() => { setStep("idle"); setQueuedOpId(null); }}
          className="mt-6 text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline"
        >
          ← Back to SOS
        </button>
      </div>
    );
  }

  const busy = step === "locating" || step === "creating";

  return (
    <div className="flex flex-col items-center text-center pt-8 pb-6 max-w-sm mx-auto px-4">
      {user?.isGuest && (
        <div className="w-full mb-6 rounded-card border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/80 p-3.5 text-left flex items-start gap-3 text-xs text-slate-800 dark:text-slate-200 shadow-sm">
          <ShieldAlert className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Guest Mode: Your medical history is not available.</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">Emergency SOS will proceed with your real location and symptoms without prior medical records.</p>
          </div>
        </div>
      )}
      {offlineQueue.queued > 0 && (
        <div className="w-full mb-6 rounded-card border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/80 p-4 text-left">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <CloudOff className="w-4 h-4" /> {offlineQueue.queued} saved SOS waiting to sync
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            {offlineQueue.authRequired
              ? "Your session expired — sign in again to send it to hospitals."
              : offlineQueue.syncing
              ? "Syncing to the emergency service…"
              : "It will be delivered automatically as soon as you're back online."}
          </p>
          {!offlineQueue.syncing && !offlineQueue.authRequired && navigator.onLine && (
            <button
              onClick={() => void flushQueuedSOS(emergencySyncClient)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-full px-3 py-1.5 hover:bg-sky-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync now
            </button>
          )}
        </div>
      )}
      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Need emergency assistance?</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-8">
        Tap once to report an emergency. Nothing else is required.
      </p>

      <div className="flex flex-col items-center">
        <div className="relative w-56 h-56 select-none touch-none">
          {busy && (
            <>
              <span className="absolute inset-4 rounded-full border-2 border-sky-400/60 animate-radius-expand" />
              <span
                className="absolute inset-4 rounded-full border-2 border-sky-400/40 animate-radius-expand"
                style={{ animationDelay: "0.7s" }}
              />
            </>
          )}

          <button
            type="button"
            onClick={() => dispatchSOS()}
            disabled={step !== "idle"}
            aria-label="Tap to send emergency SOS"
            className="absolute inset-4 rounded-full flex items-center justify-center
                       bg-gradient-to-br from-red-600 to-rose-700
                       shadow-emergency
                       active:scale-95 transition-all duration-150 disabled:opacity-80 disabled:cursor-wait"
          >
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30 pointer-events-none" />
            <span className="relative z-10 flex flex-col items-center text-white">
              {busy ? (
                <MapPin className="w-10 h-10 mb-2 animate-pulse" />
              ) : (
                <Siren className="w-12 h-12 mb-2" />
              )}
              <span className="font-extrabold text-2xl tracking-wider">
                {step === "idle" ? "SOS" : step === "locating" ? "Locating…" : "Sending…"}
              </span>
              <span className="text-[11px] font-medium opacity-90 mt-1 px-4">
                {step === "idle"
                  ? "Tap to report"
                  : step === "locating"
                  ? "Capturing GPS coordinates"
                  : "Creating emergency case"}
              </span>
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-8 text-center max-w-xs leading-relaxed">
          One tap sends your real location and emergency to best-matched nearby hospitals instantly.
        </p>
      </div>

      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-10">Need to speak to someone directly?</p>
      <a
        href="tel:108"
        className="flex items-center gap-2 text-sm font-extrabold text-rose-600 dark:text-rose-400 mt-1 hover:underline"
      >
        <Phone className="w-4 h-4" /> Call 108 Emergency Service
      </a>

      <div className="w-full mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => dispatchSOS(CHATBOT_PRESET)}
          disabled={step !== "idle"}
          className="w-full flex items-center gap-3 rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-slate-850 p-4 text-left transition-all hover:bg-sky-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
        >
          <span className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-glow">
            <Bot className="w-5 h-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-slate-900 dark:text-white">[Demo] Simulate Chatbot SOS</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              AI-detected emergency from a chatbot conversation
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}