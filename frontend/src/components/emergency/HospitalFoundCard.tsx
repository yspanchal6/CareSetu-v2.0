import { Send } from "lucide-react";

export function HospitalFoundCard({ hospital }: { hospital: any }) {
  if (!hospital) return null;

  return (
    <div className="bg-white border-l-4 border-emerald-500 rounded-lg p-4 shadow-sm animate-slideUp">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-sky-100 rounded-lg flex items-center justify-center text-2xl">
            🏥
          </div>
          <div>
            <h3 className="font-bold text-navy text-base">{hospital.name}</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {hospital.distanceKm !== undefined && hospital.distanceKm !== null
                ? `${Number(hospital.distanceKm).toFixed(1)} km`
                : "2.5 km"} · {hospital.city || "Ahmedabad"}
            </p>
          </div>
        </div>
        <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
          ✓ Best Match
        </span>
      </div>

      {hospital.capabilities && Array.isArray(hospital.capabilities) && hospital.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {hospital.capabilities.slice(0, 4).map((c: string) => (
            <span key={c} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded">
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 p-2.5 bg-sky-50 rounded-lg flex items-center gap-2">
        <Send className="w-4 h-4 text-sky-600" />
        <span className="text-sm font-medium text-sky-700 flex-1">
          Request sent to hospital
        </span>
        <span className="text-xs text-slate-500">
          {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export default HospitalFoundCard;
