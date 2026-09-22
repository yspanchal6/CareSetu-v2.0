import { Check } from "lucide-react";
import { EmergencyStage } from "../../types";

const stages: { key: EmergencyStage; label: string }[] = [
  { key: "Reported", label: "Emergency Reported" },
  { key: "LocationCaptured", label: "Location Captured" },
  { key: "CaseAnalysed", label: "Case Analysed" },
  { key: "FindingHospital", label: "Finding Hospital" },
  { key: "HospitalAssigned", label: "Hospital Assigned" },
  { key: "Transfer", label: "Transfer" },
  { key: "Treatment", label: "Treatment" },
  { key: "Completed", label: "Completed" },
];

export default function StatusTracker({ current }: { current: EmergencyStage }) {
  const currentIndex = stages.findIndex((s) => s.key === current);

  return (
    <div className="flex flex-col">
      {stages.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === stages.length - 1;
        return (
          <div key={s.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  done
                    ? "bg-success text-white"
                    : active
                    ? "bg-sky text-white ring-4 ring-sky/20"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {!isLast && <div className={`w-0.5 flex-1 min-h-[24px] ${done ? "bg-success" : "bg-slate-200"}`} />}
            </div>
            <div className="pb-6">
              <p className={`text-sm font-semibold ${done || active ? "text-navy" : "text-slate-400"}`}>{s.label}</p>
              {active && <p className="text-xs text-sky mt-0.5">In progress...</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
