import { useState, useEffect } from "react";
import { MapPin, Clock, User, Bot, AlertTriangle } from "lucide-react";
import { Card } from "../common/Card";
import Badge from "../common/Badge";
import Button from "../common/Button";

function getSeverityTone(sev?: string): "critical" | "urgent" | "stable" {
  const upper = String(sev || "").toUpperCase();
  if (upper.includes("CRITICAL") || upper === "RED") return "critical";
  if (upper.includes("URGENT") || upper === "ORANGE") return "urgent";
  return "stable";
}

function getSeverityLabel(sev?: string): string {
  const upper = String(sev || "").toUpperCase();
  if (upper.includes("CRITICAL") || upper === "RED") return "🔴 CRITICAL";
  if (upper.includes("URGENT") || upper === "ORANGE") return "🟠 URGENT";
  return "🟡 MODERATE";
}

export default function EmergencyCaseCard({
  emergencyCase,
  onAccept,
  onReject,
  onView,
  isProcessing = false,
}: {
  emergencyCase: any;
  onAccept?: () => void;
  onReject?: () => void;
  onView?: () => void;
  isProcessing?: boolean;
}) {
  const c = emergencyCase || {};
  const caseIdDisplay = c.publicCaseId || c.caseId || c.id || "CASE-UNKNOWN";
  const severityTone = getSeverityTone(c.severity);
  const severityLabel = getSeverityLabel(c.severity);

  // 20-second countdown logic based on requestedAt / createdAt
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timerAvailable, setTimerAvailable] = useState<boolean>(true);

  useEffect(() => {
    const rawTime = c.requestedAt || c.createdAt;
    if (!rawTime) {
      setTimerAvailable(false);
      setSecondsLeft(null);
      return;
    }
    const startTime = new Date(rawTime).getTime();
    if (isNaN(startTime) || !isFinite(startTime)) {
      setTimerAvailable(false);
      setSecondsLeft(null);
      return;
    }

    setTimerAvailable(true);
    const deadline = startTime + 20000; // 20-second target

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [c.requestedAt, c.createdAt]);

  const patientName = c.patientName || c.patient?.name || "Not provided";
  const patientAge = c.age || c.patient?.age;
  const symptomsText = c.symptoms || "Not provided";
  const emergencyType = c.emergencyType || c.requiredCapability || "Medical Emergency";
  const isAiSource = c.source === "CHATBOT" || c.emergencyType === "CHATBOT";

  const distanceText = c.distanceKm != null
    ? `${Number(c.distanceKm).toFixed(1)} km away`
    : c.distance ? String(c.distance) : "Location unavailable";

  return (
    <Card className={`border-l-4 ${severityTone === "critical" ? "border-l-emergency" : severityTone === "urgent" ? "border-l-accent-dark" : "border-l-success"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono font-bold text-navy text-sm">{caseIdDisplay}</p>
            <Badge tone={severityTone}>{severityLabel}</Badge>
            {isAiSource ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                <Bot className="w-3 h-3" /> AI-assisted assessment
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Direct SOS
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <strong className="text-navy">{patientName}</strong>
            {patientAge ? `, ${patientAge} yrs` : ""}
          </p>
        </div>

        {timerAvailable && secondsLeft !== null ? (
          <div className={`text-right shrink-0 px-2 py-1 rounded-lg border ${secondsLeft <= 5 ? "bg-red-50 border-red-200 text-red-700 animate-pulse" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
            <p className="text-[10px] font-medium uppercase tracking-wide">Response Target</p>
            <p className="text-xs font-bold font-mono">{secondsLeft > 0 ? `${secondsLeft}s left` : "EXPIRED"}</p>
          </div>
        ) : (
          <div className="text-right shrink-0 px-2 py-1 rounded-lg border bg-slate-50 border-slate-200 text-slate-500">
            <p className="text-[10px] font-medium uppercase tracking-wide">Response Target</p>
            <p className="text-xs font-medium">Response timer unavailable</p>
          </div>
        )}
      </div>

      <div className="mt-3 bg-slate-50/70 border border-slate-100 rounded-lg p-2.5">
        <p className="text-xs text-slate-500 font-semibold mb-0.5">Emergency Type / Symptoms:</p>
        <p className="text-xs font-semibold text-navy">{emergencyType}</p>
        <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{symptomsText}</p>
        {isAiSource && (
          <p className="text-[11px] text-slate-500 mt-2 rounded-lg bg-sky-50 border border-sky-100 px-2.5 py-1.5 leading-snug">
            <span className="font-semibold text-sky-800">AI-assisted symptom extraction</span>
            <span className="text-slate-600"> — preliminary analysis, not an AI diagnosis. Clinical decision remains with hospital staff.</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
        <span className="font-medium px-2 py-1 rounded-md bg-lightblue text-navy-dark flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {distanceText}
        </span>
        {c.createdAt && (
          <span className="text-text-secondary flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {(onAccept || onReject) && (
        <div className="flex gap-2 mt-4">
          {onReject && (
            <Button variant="outline" size="sm" fullWidth onClick={onReject} disabled={isProcessing}>
              ❌ CANNOT HANDLE
            </Button>
          )}
          {onAccept && (
            <Button variant="success" size="sm" fullWidth onClick={onAccept} disabled={isProcessing}>
              {isProcessing ? "Accepting..." : "✅ ACCEPT"}
            </Button>
          )}
        </div>
      )}

      {onView && !onAccept && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={onView}>
          View details
        </Button>
      )}
    </Card>
  );
}
