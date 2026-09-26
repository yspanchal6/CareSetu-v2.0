import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Star, BedDouble, HeartPulse, Wind, ArrowLeft, RefreshCw } from "lucide-react";
import { hospitals as fallbackHospitals } from "../../data/hospitals";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import { ErrorState } from "../../components/common/States";
import { useToast } from "../../components/common/Toast";
import { hospitalApi } from "../../services/api";
import { getAllRecords, getRecord } from "../../utils/offlineDB";
import "leaflet/dist/leaflet.css";

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const stateHospital = location.state?.hospital;
  const initialHospital = (stateHospital && (stateHospital.id === id || String(stateHospital.id) === String(id))) ? stateHospital : null;

  const [hospital, setHospital] = useState<any>(initialHospital);
  const [isLoading, setIsLoading] = useState<boolean>(!initialHospital);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchHospitalDetails() {
      if (!id) {
        if (isMounted) {
          setError("Invalid hospital ID.");
          setIsLoading(false);
        }
        return;
      }

      // If we already have initial hospital from location.state, we only show spinner if we don't have it
      if (!hospital) {
        setIsLoading(true);
      }
      setError(null);

      // 1. Try API fetch if online
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await hospitalApi.getById(id);
          if (res && res.success && res.hospital) {
            const h = res.hospital;
            const formatted = {
              id: h.id,
              name: h.name,
              address: h.address,
              phone: h.phone,
              city: h.city || "Nearby",
              state: h.state || "",
              capabilities: h.capabilities && h.capabilities.length > 0 ? h.capabilities : ["Emergency Care", "Trauma Unit", "ICU Services"],
              specialists: h.specialists || ["Emergency Medicine", "Trauma Specialist", "Cardiologist"],
              availability: h.availability || (h.emergencyAvailable ? "Available" : "Limited"),
              isVerified: h.isVerified ?? true,
              responseTimeMin: h.responseTimeMin || 12,
              bedsAvailable: h.bedsAvailable ?? 15,
              beds: h.beds ?? 40,
              icuAvailable: h.icuAvailable ?? 4,
              icuBeds: h.icuBeds ?? 10,
              ventilatorsAvailable: h.ventilatorsAvailable ?? 2,
              ventilators: h.ventilators ?? 5,
              rating: h.rating || 4.8,
              lat: h.lat ?? h.location?.latitude ?? 28.6139,
              lng: h.lng ?? h.location?.longitude ?? 77.2090,
            };

            if (isMounted) {
              setHospital(formatted);
              setIsLoading(false);
            }
            return;
          }
        } catch (err: any) {
          console.warn("[HospitalDetailPage] API getById failed, attempting fallback lookup:", err?.message || err);
        }
      }

      // 2. Search IndexedDB offline directory
      try {
        const cached = await getRecord<any>("hospital_directory", id).catch(() => null);
        if (cached) {
          const hLat = cached.location?.latitude ?? cached.lat ?? 28.6139;
          const hLng = cached.location?.longitude ?? cached.lng ?? 77.2090;
          const formattedCached = {
            id: cached.id,
            name: cached.name,
            address: cached.address,
            phone: cached.phone,
            city: cached.city || "Nearby",
            capabilities: cached.capabilities || ["Emergency Care"],
            specialists: cached.specialists || ["Emergency Medicine"],
            availability: "Available",
            isVerified: true,
            responseTimeMin: 12,
            bedsAvailable: 15,
            beds: 40,
            icuAvailable: 4,
            icuBeds: 10,
            ventilatorsAvailable: 2,
            ventilators: 5,
            rating: 4.7,
            lat: hLat,
            lng: hLng,
          };
          if (isMounted) {
            setHospital(formattedCached);
            setIsLoading(false);
          }
          return;
        }

        const allCached = await getAllRecords<any>("hospital_directory").catch(() => []);
        const foundInAll = allCached.find((c) => String(c.id) === String(id) || c.name?.toLowerCase() === id.toLowerCase());
        if (foundInAll) {
          const hLat = foundInAll.location?.latitude ?? foundInAll.lat ?? 28.6139;
          const hLng = foundInAll.location?.longitude ?? foundInAll.lng ?? 77.2090;
          const formattedCached = {
            id: foundInAll.id,
            name: foundInAll.name,
            address: foundInAll.address,
            phone: foundInAll.phone,
            city: foundInAll.city || "Nearby",
            capabilities: foundInAll.capabilities || ["Emergency Care"],
            specialists: foundInAll.specialists || ["Emergency Medicine"],
            availability: "Available",
            isVerified: true,
            responseTimeMin: 12,
            bedsAvailable: 15,
            beds: 40,
            icuAvailable: 4,
            icuBeds: 10,
            ventilatorsAvailable: 2,
            ventilators: 5,
            rating: 4.7,
            lat: hLat,
            lng: hLng,
          };
          if (isMounted) {
            setHospital(formattedCached);
            setIsLoading(false);
          }
          return;
        }
      } catch (dbErr) {
        console.warn("[HospitalDetailPage] IndexedDB lookup failed:", dbErr);
      }

      // 3. Search static fallback list
      const staticFound = fallbackHospitals.find(
        (h) => String(h.id) === String(id) || h.id === `hosp-${id}` || h.name.toLowerCase().includes(id.toLowerCase())
      );

      if (staticFound) {
        if (isMounted) {
          setHospital(staticFound);
          setIsLoading(false);
        }
        return;
      }

      // 4. Hospital not found in any source
      if (isMounted) {
        setHospital(null);
        setError("This hospital may have been removed from the network or the link is invalid.");
        setIsLoading(false);
      }
    }

    void fetchHospitalDetails();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-text-secondary max-w-3xl mx-auto">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-navy">Loading hospital details...</p>
      </div>
    );
  }

  if (error || !hospital) {
    return (
      <ErrorState
        title="Hospital not found"
        message={error || "This hospital may have been removed from the network."}
        onRetry={() => navigate("/patient/hospitals")}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5 pb-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-navy transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Card>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-navy">{hospital.name}</h2>
            <p className="text-sm text-text-secondary mt-1">{hospital.address}</p>
            {hospital.phone && (
              <p className="text-xs text-text-secondary mt-0.5 font-mono">Phone: {hospital.phone}</p>
            )}
            <p className="text-xs text-amber-500 flex items-center gap-1 mt-1.5 font-semibold">
              <Star className="w-3.5 h-3.5 fill-amber-500" /> {hospital.rating} rating
            </p>
          </div>
          <Badge
            tone={
              hospital.availability === "Available"
                ? "available"
                : hospital.availability === "Limited"
                ? "limited"
                : "unavailable"
            }
          >
            {hospital.availability}
          </Badge>
        </div>

        <div className="rounded-xl overflow-hidden h-56 border border-slate-100 mb-4 z-0">
          <MapContainer
            center={[hospital.lat, hospital.lng]}
            zoom={13}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[hospital.lat, hospital.lng]}>
              <Popup>{hospital.name}</Popup>
            </Marker>
          </MapContainer>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-paleblue rounded-xl py-3 text-center">
            <BedDouble className="w-4.5 h-4.5 text-navy-dark mx-auto mb-1" />
            <p className="text-sm font-bold text-navy">
              {hospital.bedsAvailable}/{hospital.beds}
            </p>
            <p className="text-[11px] text-text-secondary">Beds</p>
          </div>
          <div className="bg-paleblue rounded-xl py-3 text-center">
            <HeartPulse className="w-4.5 h-4.5 text-navy-dark mx-auto mb-1" />
            <p className="text-sm font-bold text-navy">
              {hospital.icuAvailable}/{hospital.icuBeds}
            </p>
            <p className="text-[11px] text-text-secondary">ICU</p>
          </div>
          <div className="bg-paleblue rounded-xl py-3 text-center">
            <Wind className="w-4.5 h-4.5 text-navy-dark mx-auto mb-1" />
            <p className="text-sm font-bold text-navy">
              {hospital.ventilatorsAvailable}/{hospital.ventilators}
            </p>
            <p className="text-[11px] text-text-secondary">Ventilators</p>
          </div>
        </div>

        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Capabilities</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hospital.capabilities.map((c: string) => (
            <span key={c} className="text-xs font-medium px-2.5 py-1 rounded-md bg-lightblue text-navy-dark">
              {c}
            </span>
          ))}
        </div>

        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Specialists</p>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {hospital.specialists.map((s: string) => (
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
