import { CheckCircle2, XCircle } from "lucide-react";

interface TimelineProps {
  currentStage: string;
  hospital?: any;
  rejectedHospitals?: any[];
}

const STAGES = [
  { key: "EmergencyReported", label: "Emergency Reported" },
  { key: "LocationCaptured", label: "Location Captured" },
  { key: "CaseAnalysed", label: "Case Analysed" },
  { key: "FindingHospital", label: "Finding Hospital", sub: "Searching nearby..." },
  { key: "HospitalAssigned", label: "Hospital Assigned" },
  { key: "Transfer", label: "Transfer", sub: "Ambulance en route" },
  { key: "Treatment", label: "Treatment" },
  { key: "Completed", label: "Completed" },
];

export function Timeline({ currentStage, hospital, rejectedHospitals }: TimelineProps) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="flex flex-col gap-2">
      {STAGES.map((stage, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        const isHospitalStage = stage.key === "FindingHospital";

        return (
          <div key={stage.key} className="relative">
            <div className="flex items-start gap-3">
              {/* Circle */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isDone
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "bg-sky-500 text-white animate-pulseRing"
                  : "bg-slate-100 text-slate-400"
              }`}>
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <span className="font-bold">{i + 1}</span>}
              </div>

              {/* Label */}
              <div className="flex-1 pt-1">
                <p className={`text-sm ${
                  isDone
                    ? "text-navy font-medium"
                    : isActive
                    ? "text-sky-700 font-semibold"
                    : "text-slate-400"
                }`}>
                  {stage.label}
                </p>
                {stage.sub && isActive && (
                  <p className="text-xs text-sky-600 mt-1">{stage.sub}</p>
                )}
              </div>

              {/* Timestamp */}
              {isDone && (
                <span className="text-xs text-slate-500">
                  {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {/* Vertical line */}
            {i < STAGES.length - 1 && (
              <div className={`ml-4 w-0.5 h-6 ${isDone ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}

            {/* Hospital list under Finding Hospital stage */}
            {isHospitalStage && (isActive || isDone) && (
              <div className="ml-12 mt-2 space-y-2">
                {rejectedHospitals?.map((r, idx) => (
                  <div key={idx} className="text-xs text-red-600 flex items-center gap-2">
                    <XCircle className="w-3 h-3" />
                    <span>{r.hospital?.name || "Hospital"} rejected</span>
                  </div>
                ))}
                {hospital && (
                  <div className="text-xs text-emerald-600 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{hospital.name} accepted</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Timeline;
