import { Check, X, Ambulance, HeartPulse, Search } from "lucide-react";

interface Props {
  currentStage: string;
  acceptedHospital?: any;
  rejectedHospitals?: any[];
  pendingHospital?: any;
  noHospital?: boolean;
}

const STAGES = [
  { key: "EmergencyReported", num: 1, label: "Emergency Reported" },
  { key: "LocationCaptured", num: 2, label: "Location Captured" },
  { key: "CaseAnalysed", num: 3, label: "Case Analysed" },
  { key: "FindingHospital", num: 4, label: "Finding Hospital" },
  { key: "HospitalAssigned", num: 5, label: "Hospital Assigned" },
  { key: "Transfer", num: 6, label: "Transfer" },
  { key: "Treatment", num: 7, label: "Treatment" },
  { key: "Completed", num: 8, label: "Completed" },
];

function StageIcon({ state, num }: { state: "done" | "active" | "pending" | "rejected"; num: number }) {
  if (state === "done") {
    return (
      <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-check-pop">
        <Check className="w-5 h-5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "rejected") {
    return (
      <span className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center animate-x-pop">
        <X className="w-5 h-5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center animate-blue-pulse">
        {num}
      </span>
    );
  }
  return (
    <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
      {num}
    </span>
  );
}

export default function EmergencyTimeline({
  currentStage,
  acceptedHospital,
  rejectedHospitals = [],
  pendingHospital,
  noHospital,
}: Props) {
  const currentIdx = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex flex-col">
      {STAGES.map((stage, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;

        // Finding Hospital shows a red rejection sub-state when hospitals rejected
        const hasRejected =
          stage.key === "FindingHospital" && (isActive || isDone) && rejectedHospitals.length > 0;

        let state: "done" | "active" | "pending" | "rejected" = "pending";
        if (isDone) state = "done";
        else if (hasRejected && isActive && !pendingHospital) state = "rejected";
        else if (isActive) state = "active";

        return (
          <div key={stage.key} className="relative">
            <div className="flex items-start gap-3 py-1">
              <div className="relative shrink-0">
                <StageIcon state={state} num={stage.num} />
              </div>

              <div className="flex-1 pt-0.5">
                <p
                  className={`text-sm leading-tight transition-colors duration-300 ${
                    state === "done"
                      ? "text-navy font-semibold"
                      : state === "active"
                      ? "text-sky-700 font-bold"
                      : state === "rejected"
                      ? "text-red-700 font-semibold"
                      : "text-slate-400"
                  }`}
                >
                  {stage.label}
                </p>

                {/* Active stage supporting copy */}
                {isActive && stage.key === "FindingHospital" && (
                  <div className="text-xs text-sky-600 mt-1 space-y-1">
                    {noHospital ? (
                      <p className="text-red-600 font-medium">No suitable hospital could accept the case.</p>
                    ) : pendingHospital ? (
                      <p className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5" />
                        Waiting for {pendingHospital.name} to respond…
                      </p>
                    ) : rejectedHospitals.length > 0 ? (
                      <p>
                        Searching for the next best-matched hospital after{" "}
                        {rejectedHospitals.length} rejection{rejectedHospitals.length > 1 ? "s" : ""}…
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 animate-pulse" />
                        Searching for the best-matched hospital…
                      </p>
                    )}
                  </div>
                )}

                {isActive && stage.key === "Transfer" && (
                  <div className="text-xs text-sky-600 mt-1">
                    <p className="flex items-center gap-1.5">
                      <Ambulance className="w-3.5 h-3.5" />
                      Transfer in progress — ambulance on the way…
                    </p>
                    {acceptedHospital && (
                      <p className="text-slate-500 mt-0.5">To {acceptedHospital.name}</p>
                    )}
                  </div>
                )}

                {isActive && stage.key === "Treatment" && (
                  <div className="text-xs text-sky-600 mt-1 flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 animate-heartbeat" />
                    Treatment in progress — patient is receiving care.
                  </div>
                )}

                {isActive && stage.key === "HospitalAssigned" && acceptedHospital && (
                  <div className="text-xs text-emerald-600 mt-1">
                    {acceptedHospital.name} has been assigned.
                  </div>
                )}

                {isActive && stage.key === "Completed" && (
                  <div className="text-xs text-emerald-600 mt-1 font-medium">
                    The emergency case has been resolved.
                  </div>
                )}

                {/* Hospital events inside Finding Hospital */}
                {stage.key === "FindingHospital" && (isActive || isDone) && (rejectedHospitals.length > 0 || pendingHospital || acceptedHospital) && (
                  <div className="mt-2 space-y-1.5">
                    {rejectedHospitals.map((r, idx) => (
                      <div key={`rej-${idx}`} className="text-xs text-red-600 flex items-center gap-2 animate-fade-in">
                        <span className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                          <X className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                        <span className="flex-1">
                          <span className="font-semibold">{r.hospital?.name ?? r.hospitalName ?? "Hospital"}</span> rejected the request
                        </span>
                      </div>
                    ))}
                    {pendingHospital && !acceptedHospital && (
                      <div key="found" className="text-xs text-sky-700 flex items-center gap-2 animate-fade-in">
                        <span className="w-4 h-4 bg-sky-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />
                        </span>
                        <span className="flex-1">
                          Request sent to <span className="font-semibold">{pendingHospital.name}</span>
                        </span>
                      </div>
                    )}
                    {acceptedHospital && (
                      <div key="acc" className="text-xs text-emerald-600 flex items-center gap-2 animate-check-pop">
                        <span className="w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                        <span className="flex-1">
                          <span className="font-semibold">{acceptedHospital.name}</span> accepted
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div
                className={`ml-4 w-0.5 h-5 transition-colors duration-500 ${
                  isDone ? "bg-emerald-500" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}