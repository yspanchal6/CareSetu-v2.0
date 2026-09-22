import { MapPin, Clock, BedDouble, HeartPulse, Wind } from "lucide-react";
import { Hospital } from "../../types";
import { Card } from "../common/Card";
import Badge from "../common/Badge";
import Button from "../common/Button";

const availabilityTone: Record<Hospital["availability"], "available" | "limited" | "busy" | "unavailable"> = {
  Available: "available",
  Limited: "limited",
  Busy: "busy",
  Unavailable: "unavailable",
};

export default function HospitalCard({
  hospital,
  distanceKm,
  onView,
  onRequest,
}: {
  hospital: Hospital;
  distanceKm?: number;
  onView?: () => void;
  onRequest?: () => void;
}) {
  const disabled = hospital.availability === "Unavailable";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-navy leading-tight">{hospital.name}</h4>
          <p className="text-xs text-text-secondary flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5" /> {hospital.address}
          </p>
        </div>
        <Badge tone={availabilityTone[hospital.availability]} dot>
          {hospital.availability}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-paleblue rounded-lg py-2">
          <p className="text-xs text-text-secondary flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> ETA</p>
          <p className="text-sm font-bold text-navy">{hospital.responseTimeMin} min</p>
        </div>
        <div className="bg-paleblue rounded-lg py-2">
          <p className="text-xs text-text-secondary flex items-center justify-center gap-1"><BedDouble className="w-3 h-3" /> Beds</p>
          <p className="text-sm font-bold text-navy">{hospital.bedsAvailable}/{hospital.beds}</p>
        </div>
        <div className="bg-paleblue rounded-lg py-2">
          <p className="text-xs text-text-secondary flex items-center justify-center gap-1"><HeartPulse className="w-3 h-3" /> ICU</p>
          <p className="text-sm font-bold text-navy">{hospital.icuAvailable}/{hospital.icuBeds}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {hospital.capabilities.slice(0, 3).map((c) => (
          <span key={c} className="text-[11px] font-medium px-2 py-1 rounded-md bg-lightblue text-navy-dark">
            {c}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-text-secondary">
        {distanceKm !== undefined && <span>{distanceKm.toFixed(1)} km away</span>}
        <span className="flex items-center gap-1"><Wind className="w-3 h-3" /> Rating {hospital.rating}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" fullWidth onClick={onView}>
          View Details
        </Button>
        <Button variant="primary" size="sm" fullWidth disabled={disabled} onClick={onRequest}>
          Request Case
        </Button>
      </div>
    </Card>
  );
}
