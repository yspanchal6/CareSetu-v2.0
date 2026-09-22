import { XCircle, Loader2 } from "lucide-react";

export function HospitalRejectedCard({ hospital, reason }: { hospital: any; reason?: string }) {
  if (!hospital) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-shake">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-900">{hospital.name}</h3>
            <p className="text-xs text-red-600">
              {hospital.distanceKm !== undefined && hospital.distanceKm !== null
                ? `${Number(hospital.distanceKm).toFixed(1)} km`
                : ""}
            </p>
          </div>
        </div>
        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
          ✗ Rejected
        </span>
      </div>

      <p className="text-sm text-red-800 mt-2">
        {reason || "Hospital is unable to accept right now. Searching for the next best hospital..."}
      </p>

      <div className="flex items-center gap-2 mt-3 text-sky-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">Finding next suitable hospital...</span>
      </div>
    </div>
  );
}

export default HospitalRejectedCard;
