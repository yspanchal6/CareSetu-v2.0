import { Truck } from "lucide-react";

export function TransferCard({ eta, distance }: { eta: number; distance: number }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500 animate-slideUp">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-navy">Transfer in Progress</h3>
      </div>

      <div className="aspect-video bg-sky-50 rounded-lg mb-3 relative overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">🚑</div>
          <p className="text-sm font-medium text-navy">Ambulance en route</p>
        </div>
        <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
          🟢 LIVE
        </span>
      </div>

      <div className="flex justify-between">
        <div>
          <p className="text-2xl font-bold text-navy">{eta} min</p>
          <p className="text-xs text-slate-500">Estimated arrival</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-emerald-600">{(distance || 2.8).toFixed(1)} km away</p>
          <p className="text-xs text-slate-500">Live tracking active</p>
        </div>
      </div>
    </div>
  );
}

export default TransferCard;
