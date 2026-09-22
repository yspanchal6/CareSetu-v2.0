import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { emergencyApi, getActiveEmergencyCase, EmergencyCaseStatus, EmergencyAttempt } from "../../services/api";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";
import { useSocket } from "../../context/SocketContext";
import EmergencyTimeline from "../../components/emergency/EmergencyTimeline";
import {
  HospitalFoundCard,
  HospitalRejectedCard,
  HospitalAcceptedCard,
  TransferCard,
  TreatmentCard,
  CompletedCard,
} from "../../components/emergency/HospitalCards";

const STATUS_TO_STAGE: Record<string, string> = {
  CREATED: "EmergencyReported",
  LOCATED: "LocationCaptured",
  ANALYSED: "CaseAnalysed",
  PENDING: "FindingHospital",
  SEARCHING: "FindingHospital",
  MATCHING: "FindingHospital",
  HOSPITAL_REQUESTED: "FindingHospital",
  HOSPITAL_REJECTED: "FindingHospital",
  ACCEPTED: "HospitalAssigned",
  ASSIGNED: "HospitalAssigned",
  TRANSFER: "Transfer",
  IN_TRANSFER: "Transfer",
  IN_PROGRESS: "Transfer",
  TREATMENT: "Treatment",
  IN_TREATMENT: "Treatment",
  RESOLVED: "Completed",
  COMPLETED: "Completed",
  CLOSED: "Completed",
  CANCELLED: "Completed",
};

const STAGE_LABELS: Record<string, string> = {
  EmergencyReported: "Emergency reported",
  LocationCaptured: "Location captured",
  CaseAnalysed: "Case analysed",
  FindingHospital: "Finding a hospital",
  HospitalAssigned: "Hospital accepted",
  Transfer: "Transfer in progress",
  Treatment: "Treatment in progress",
  Completed: "Emergency completed",
};

const POLL_INTERVAL_MS = 4000;

export default function EmergencyStatusPage() {
  const { caseId: urlCaseId } = useParams<{ caseId: string }>();
  const { subscribeEmergencyEvents, connected } = useSocket();

  const [caseData, setCaseData] = useState<EmergencyCaseStatus | null>(null);
  const [attempts, setAttempts] = useState<EmergencyAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEventType, setLastEventType] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { showToast } = useToast();

  // Resolve the case reference (URL param or last active case)
  const caseRef = useMemo(() => {
    const stored = getActiveEmergencyCase();
    return urlCaseId || stored || "";
  }, [urlCaseId]);

  const load = useCallback(async () => {
    if (!caseRef) return;
    try {
      const [statusRes, attemptsRes] = await Promise.all([
        emergencyApi.status(caseRef),
        emergencyApi.attempts(caseRef).catch(() => ({ attempts: [] as EmergencyAttempt[] })),
      ]);
      setCaseData(statusRes.case);
      setAttempts(attemptsRes.attempts || []);
      setError(null);
    } catch (err: any) {
      console.error("[Tracking]", err);
      if (err?.status === 404) {
        setError("Emergency case not found.");
      } else {
        setError(err.message || "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, [caseRef]);

  const handleCancel = async () => {
    if (!caseRef) return;
    setCancelling(true);
    try {
      await emergencyApi.cancel(caseRef);
      setCancelOpen(false);
      showToast("success", "Emergency request cancelled.");
      await load();
    } catch (err: any) {
      setCancelOpen(false);
      showToast("error", err?.message || "Failed to cancel emergency");
    } finally {
      setCancelling(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!caseRef) {
      setError("No active emergency case ID found");
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [caseRef, load]);

  // Real-time socket updates — refetch real backend state on any matching event
  useEffect(() => {
    if (!caseRef) return;
    const unsubscribeForRef = subscribeEmergencyEvents(caseRef, (eventName) => {
      setLastEventType(eventName);
      void load();
    });

    // Also subscribe under the canonical public case ID once known,
    // so events keyed by CASE-… are always received.
    let unsubscribeForCaseId: (() => void) | undefined;
    if (caseData?.caseId && caseData.caseId !== caseRef) {
      unsubscribeForCaseId = subscribeEmergencyEvents(caseData.caseId, (eventName) => {
        setLastEventType(eventName);
        void load();
      });
    }

    return () => {
      unsubscribeForRef();
      unsubscribeForCaseId?.();
    };
  }, [caseRef, caseData?.caseId, subscribeEmergencyEvents, load]);

  // Polling fallback (efficient, only when the socket is not connected)
  useEffect(() => {
    if (connected || !caseRef) return;
    const iv = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [connected, caseRef, load]);

  // Re-sync authoritative state after a socket reconnect. Events emitted while
  // the socket was down would otherwise be missed (polling stops on reconnect),
  // leaving stale UI. Initial mount already loads above, so skip the first connect.
  const wasDisconnected = useRef(false);
  useEffect(() => {
    if (!connected) {
      wasDisconnected.current = true;
      return;
    }
    if (wasDisconnected.current) {
      wasDisconnected.current = false;
      void load();
    }
  }, [connected, load]);

  const stage = STATUS_TO_STAGE[caseData?.status ?? ""] || "FindingHospital";
  const cancelled = caseData?.status === "CANCELLED";

  // The hospital currently being asked (first PENDING request).
  const pendingAttempt = useMemo(
    () => attempts.find((a) => a.status === "PENDING"),
    [attempts]
  );

  // Hospitals that could not accept (explicit rejection or response timeout).
  const rejectedAttempts = useMemo(
    () => attempts.filter((a) => a.status === "REJECTED" || a.status === "EXPIRED"),
    [attempts]
  );

  // The hospital that accepted the case (source of truth from the backend).
  const acceptedAttempt = useMemo(
    () =>
      attempts.find((a) => a.status === "ACCEPTED") ||
      (caseData?.hospital
        ? {
            hospital: caseData.hospital as any,
            status: "ACCEPTED" as const,
            distanceKm: null,
          }
        : undefined),
    [attempts, caseData]
  );

  const acceptedHospital = acceptedAttempt?.hospital || caseData?.hospital || null;
  const acceptedDistance = acceptedAttempt?.distanceKm ?? null;

  const noHospital =
    stage === "FindingHospital" &&
    !pendingAttempt &&
    rejectedAttempts.length > 0;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 mt-4">Loading emergency tracking...</p>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <p className="text-red-600 font-semibold">Unable to load case</p>
        <p className="text-xs text-slate-500 mt-2">{error}</p>
      </div>
    );
  }

  const isLive = stage !== "Completed" && !cancelled;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            EMERGENCY TRACKING
          </p>
          <h1 className="text-lg font-bold text-navy mt-1 break-all">
            Case {caseData.caseId || caseRef}
          </h1>
          {/* Real backend timestamp */}
          <p className="text-xs text-slate-400 mt-0.5">
            Reported {caseData.createdAt ? new Date(caseData.createdAt).toLocaleString() : "—"}
          </p>
          <p className="text-sm text-slate-600 mt-1">
            {cancelled ? "Emergency cancelled" : STAGE_LABELS[stage] || "Processing..."}
          </p>
        </div>
        {isLive ? (
          <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            Live
          </span>
        ) : (
          <span className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap">
            {cancelled ? "Cancelled" : "✓ Resolved"}
          </span>
        )}
      </div>

      {/* TIMELINE */}
      <Card className="p-4">
        <EmergencyTimeline
          currentStage={stage}
          acceptedHospital={acceptedHospital}
          rejectedHospitals={rejectedAttempts}
          pendingHospital={pendingAttempt?.hospital}
          noHospital={noHospital}
        />
      </Card>

      {/* CANCEL SOS — only while still searching for a hospital */}
      {stage === "FindingHospital" && !cancelled && (
        <Card className="p-4 flex items-center justify-between gap-3 border-amber-200">
          <div>
            <p className="font-semibold text-navy text-sm">Still searching for a hospital?</p>
            <p className="text-xs text-slate-500">You can cancel this SOS while no hospital has been assigned yet.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>Cancel SOS</Button>
        </Card>
      )}

      {/* CARDS — derived only from real backend state */}
      {stage === "FindingHospital" && !cancelled && (
        <>
          {rejectedAttempts.length > 0 && (
            <HospitalRejectedCard
              hospital={rejectedAttempts[rejectedAttempts.length - 1].hospital}
              reason={
                rejectedAttempts[rejectedAttempts.length - 1].rejectionReason ??
                (rejectedAttempts[rejectedAttempts.length - 1].status === "EXPIRED"
                  ? "No response received within the response window"
                  : undefined)
              }
            />
          )}

          {pendingAttempt ? (
            <HospitalFoundCard hospital={pendingAttempt.hospital} waiting />
          ) : rejectedAttempts.length > 0 ? (
            <HospitalFoundCard
              hospital={rejectedAttempts[rejectedAttempts.length - 1].hospital}
              waiting={false}
            />
          ) : null}

          {noHospital && (
            <Card className="p-4 bg-red-50 border border-red-200">
              <p className="text-sm font-semibold text-red-800">No hospital available right now</p>
              <p className="text-xs text-red-600 mt-1">
                Every suitable hospital was contacted but none could accept. Emergency services (108) have been escalated.
              </p>
            </Card>
          )}
        </>
      )}

      {stage === "HospitalAssigned" && acceptedHospital && !cancelled && (
        <HospitalAcceptedCard hospital={acceptedHospital} />
      )}

      {stage === "Transfer" && acceptedHospital && !cancelled && (
        <TransferCard hospital={acceptedHospital} eta={null} distance={acceptedDistance} />
      )}

      {stage === "Treatment" && acceptedHospital && !cancelled && (
        <TreatmentCard hospital={acceptedHospital} />
      )}

      {stage === "Completed" && !cancelled && <CompletedCard caseId={caseData.caseId ?? undefined} />}

      {cancelled && (
        <Card className="p-4 bg-slate-50 border border-slate-200 text-center">
          <p className="text-sm font-semibold text-slate-700">This emergency case was cancelled.</p>
        </Card>
      )}

      {/* HEALTH PACK — available after hospital assignment */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-lg">
            🔒
          </div>
          <div>
            <p className="font-semibold text-navy text-sm">Secure Health Pack</p>
            <p className="text-xs text-slate-500">
              {acceptedHospital
                ? `Share with ${acceptedHospital.name}`
                : "Available after a hospital is assigned"}
            </p>
          </div>
        </div>
        <button
          disabled={!acceptedHospital}
          className={`text-xs font-semibold px-4 py-2 rounded-lg ${
            acceptedHospital
              ? "bg-sky-500 text-white hover:bg-sky-600"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          Share
        </button>
      </Card>

      {/* SECURITY */}
      <Card className="p-4">
        <p className="font-semibold text-navy text-sm mb-3">Security</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {["Encrypted", "Consent Granted", "Authorized Access", "Access Logged"].map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">
                ✓
              </span>
              {s}
            </span>
          ))}
        </div>

        {lastEventType && (
          <p className="text-[10px] text-slate-400 mt-3 uppercase tracking-wide">
            Realtime: {lastEventType}
            {connected ? " • connected" : " • polling"}
          </p>
        )}
      </Card>

      {/* CANCEL CONFIRMATION */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel SOS?" size="sm">
        <p className="text-sm text-text-secondary mb-5">
          Cancel this emergency request? Hospitals currently being notified will stop receiving it. This is only possible while a hospital is still being searched.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={() => setCancelOpen(false)}>Keep it going</Button>
          <Button variant="danger" fullWidth loading={cancelling} onClick={handleCancel}>Cancel Emergency</Button>
        </div>
      </Modal>
    </div>
  );
}