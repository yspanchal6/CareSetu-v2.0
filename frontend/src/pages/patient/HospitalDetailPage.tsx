import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Star, BedDouble, HeartPulse, Wind, ArrowLeft } from "lucide-react";
import { hospitals } from "../../data/hospitals";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import { ErrorState } from "../../components/common/States";
import { useToast } from "../../components/common/Toast";
import "leaflet/dist/leaflet.css";

export default function HospitalDetailPage() {
  const { id } = useParams();
  const hospital = hospitals.find((h) => h.id === id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  if (!hospital) {
    return <ErrorState title="Hospital not found" message="This hospital may have been removed from the network." onRetry={() => navigate("/patient/hospitals")} />;
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-navy">{hospital.name}</h2>
            <p className="text-sm text-text-secondary mt-1">{hospital.address}</p>
            <p className="text-xs text-amber-500 flex items-center gap-1 mt-1.5 font-semibold">
              <Star className="w-3.5 h-3.5 fill-amber-500" /> {hospital.rating} rating
            </p>
          </div>
          <Badge tone={hospital.availability === "Available" ? "available" : hospital.availability === "Limited" ? "limited" : "unavailable"}>
            {hospital.availability}
          </Badge>
        </div>

        <div className="rounded-xl overflow-hidden h-56 border border-slate-100 mb-4">
          <MapContainer center={[hospital.lat, hospital.lng]} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[hospital.lat, hospital.lng]}>
              <Popup>{hospital.name}</Popup>
            </Marker>
          </MapContainer>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-paleblue rounded-xl py-3 text-center">
            <BedDouble className="w-4.5 h-4.5 text-navy-dark mx-auto mb-1" />
            <p className="text-sm font-bold text-navy">{hospital.bedsAvailable}/{hospital.beds}</p>
            <p className="text-[11px] text-text-secondary">Beds</p>
          </div>
          <div className="bg-paleblue rounded-xl py-3 text-center">
            <HeartPulse className="w-4.5 h-4.5 text-navy-dark mx-auto mb-1" />
            <p className="text-sm font-bold text-navy">{hospital.icuAvailable}/{hospital.icuBeds}</p>
            <p className="text-[11px] text-text-secondary">ICU</p>
          </div>
          <div className="bg-paleblue rounded-xl py-3 text-center">
            <Wind className="w-4.5 h-4.5 text-navy-dark mx-auto mb-1" />
            <p className="text-sm font-bold text-navy">{hospital.ventilatorsAvailable}/{hospital.ventilators}</p>
            <p className="text-[11px] text-text-secondary">Ventilators</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Capabilities</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hospital.capabilities.map((c) => (
            <span key={c} className="text-xs font-medium px-2.5 py-1 rounded-md bg-lightblue text-navy-dark">
              {c}
            </span>
          ))}
        </div>

        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Specialists</p>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {hospital.specialists.map((s) => (
            <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-text-secondary">
              {s}
            </span>
          ))}
        </div>

        <Button
          variant="primary"
          fullWidth
          disabled={hospital.availability === "Unavailable"}
          onClick={() => showToast("success", `Emergency case request sent to ${hospital.name}.`)}
        >
          Request emergency case
        </Button>
      </Card>
    </div>
  );
}
