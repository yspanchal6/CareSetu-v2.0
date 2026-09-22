import { Check, X, HeartPulse, Building2 } from "lucide-react";
import { Card } from "../common/Card";

function formatDistance(km?: number | null): string {
  if (km == null || typeof km !== "number" || !Number.isFinite(km)) return "";
  return `${km.toFixed(1)} km`;
}

/* ─────────────── FOUND CARD — request sent, waiting ─────────────── */
export function HospitalFoundCard({ hospital, waiting = true }: { hospital: any; waiting?: boolean }) {
  const time = hospital?.requestedAt ? new Date(hospital.requestedAt) : null;
  return (
    <Card className="p-4 border-l-4 border-sky-500 animate-slideUp">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-sky-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-7 h-7 text-sky-600" />
          </div>
          <div>
            <h3 className="font-bold text-navy text-base">{hospital.name}</h3>
            {hospital.address && <p className="text-xs text-slate-500 mt-0.5">{hospital.address}</p>}
            <p className="text-xs text-slate-500 mt-0.5">
              {formatDistance(hospital.distanceKm)}
              {formatDistance(hospital.distanceKm) && " away"}
            </p>
          </div>
        </div>
        <span className="bg-sky-500 text-white text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
          Best Match
        </span>
      </div>

      {hospital.capabilities?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {hospital.capabilities.slice(0, 4).map((c: string) => (
            <span
              key={c}
              className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="p-2.5 bg-sky-50 rounded-lg flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
        </span>
        <span className="text-xs font-medium text-sky-700 flex-1">
          {waiting ? "Emergency request sent — waiting for hospital response…" : "Emergency request sent"}
        </span>
        {time && (
          <span className="text-[10px] text-slate-500">
            {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ─────────────── REJECTED CARD ─────────────── */
export function HospitalRejectedCard({ hospital, reason }: { hospital: any; reason?: string }) {
  return (
    <Card className="p-4 bg-red-50 border border-red-200 animate-shake">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center animate-x-pop">
            <X className="text-red-600 text-xl" strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-bold text-red-900 text-sm">{hospital.name}</h3>
            {formatDistance(hospital.distanceKm) && (
              <p className="text-xs text-red-600 mt-0.5">{formatDistance(hospital.distanceKm)}</p>
            )}
          </div>
        </div>
        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
          Rejected
        </span>
      </div>

      <p className="text-sm text-red-800 mt-2">
        {reason || "Hospital is unable to accept right now."}
      </p>

      <div className="flex items-center gap-2 mt-3 text-sky-600">
        <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">
          Searching for the next suitable hospital automatically…
        </span>
      </div>
    </Card>
  );
}

/* ─────────────── ACCEPTED CARD ─────────────── */
export function HospitalAcceptedCard({ hospital }: { hospital: any }) {
  return (
    <Card className="p-4 bg-emerald-50 border border-emerald-200 animate-slideUp">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center animate-check-pop">
            <Check className="text-emerald-600 text-xl" strokeWidth={3} />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900 text-sm">{hospital.name}</h3>
            {hospital.address && <p className="text-xs text-emerald-700 mt-0.5">{hospital.address}</p>}
            {formatDistance(hospital.distanceKm) && (
              <p className="text-xs text-emerald-700 mt-0.5">{formatDistance(hospital.distanceKm)} away</p>
            )}
          </div>
        </div>
        <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
          Accepted
        </span>
      </div>

      <p className="text-sm text-emerald-800 mt-3 font-medium">
        Hospital has accepted your request. Help is being arranged.
      </p>
    </Card>
  );
}

/* ─────────────── TRANSFER CARD — real data only ─────────────── */
export function TransferCard({
  hospital,
  eta,
  distance,
}: {
  hospital: any;
  eta?: number | null;
  distance?: number | null;
}) {
  return (
    <Card className="p-4 border-l-4 border-sky-500 animate-slideUp">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-navy">Transfer in Progress</h3>
        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          Live
        </span>
      </div>

      <div className="aspect-video bg-gradient-to-br from-sky-50 to-sky-100 rounded-lg mb-3 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 120" preserveAspectRatio="none">
          <path
            d="M -20 90 Q 60 40 120 80 T 260 50 T 340 70"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="3"
            strokeDasharray="6 8"
            className="animate-route"
          />
          <circle cx="30" cy="95" r="6" fill="#0EA5E9">
            <animate attributeName="r" values="6;10;6" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="290" cy="60" r="4" fill="#F43F5E" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-1 animate-ambulance">🚑</div>
            <p className="text-sm font-bold text-navy">Ambulance on the way</p>
            <p className="text-xs text-slate-500 mt-0.5">{hospital?.name}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          {eta != null && Number.isFinite(Number(eta)) ? (
            <>
              <p className="text-2xl font-bold text-navy">{Number(eta)} min</p>
              <p className="text-xs text-slate-500">Estimated arrival</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-navy">En route</p>
              <p className="text-xs text-slate-500">Transfer in progress</p>
            </>
          )}
        </div>
        <div className="text-right">
          {distance != null && Number.isFinite(Number(distance)) ? (
            <p className="text-sm font-semibold text-emerald-600">
              {Number(distance).toFixed(1)} km away
            </p>
          ) : null}
          <p className="text-xs text-slate-500">Live tracking active</p>
        </div>
      </div>
    </Card>
  );
}

/* ─────────────── TREATMENT CARD ─────────────── */
export function TreatmentCard({ hospital }: { hospital: any }) {
  return (
    <Card className="p-4 border-l-4 border-sky-500 animate-slideUp">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-sky-50 rounded-lg flex items-center justify-center">
          <HeartPulse className="w-5 h-5 text-sky-600 animate-heartbeat" />
        </div>
        <div>
          <h3 className="font-bold text-navy text-sm">At Hospital</h3>
          <p className="text-xs text-slate-500">{hospital?.name}</p>
        </div>
      </div>

      <p className="text-sm text-sky-700 font-medium mb-3">
        Treatment in progress — patient is receiving care.
      </p>

      <div className="relative overflow-hidden rounded-lg">
        <svg viewBox="0 0 200 40" className="w-full h-10">
          <polyline
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="2"
            points="0,20 20,20 30,20 40,5 50,35 60,20 80,20 90,20 100,10 110,30 120,20 140,20 150,20 160,15 170,25 180,20 200,20"
          />
        </svg>
        <span className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-sky-100 animate-ecg" />
      </div>
    </Card>
  );
}

/* ─────────────── COMPLETED CARD ─────────────── */
export function CompletedCard({ caseId }: { caseId?: string }) {
  return (
    <Card className="p-6 bg-emerald-50 border border-emerald-200 text-center animate-slideUp">
      <div className="relative inline-flex items-center justify-center mb-3">
        <span className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)] animate-check-pop">
          <Check className="w-12 h-12 text-white" strokeWidth={3} />
        </span>
        <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-20" />
      </div>
      <h2 className="text-xl font-bold text-emerald-800">Emergency Completed</h2>
      <p className="text-sm text-emerald-700 mt-2">
        The emergency case has been successfully resolved.
      </p>
      {caseId && (
        <p className="font-mono text-xs text-emerald-600 mt-4">Case {caseId}</p>
      )}
    </Card>
  );
}