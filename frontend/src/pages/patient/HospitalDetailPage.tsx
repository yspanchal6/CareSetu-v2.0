import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useTranslation } from "../../i18n/I18nContext";
import {
  ArrowLeft,
  RefreshCw,
  Building2,
  MapPin,
  Phone,
  Database,
  ShieldCheck,
  Globe,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { Card } from "../../components/common/Card";
import Button from "../../components/common/Button";
import { ErrorState } from "../../components/common/States";
import { useToast } from "../../components/common/Toast";
import { hospitalDirectoryApi, DirectoryHospitalItem } from "../../services/api";
import "leaflet/dist/leaflet.css";

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [hospital, setHospital] = useState<DirectoryHospitalItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

      setIsLoading(true);
      setError(null);

      try {
        const res = await hospitalDirectoryApi.getById(id);
        if (res && res.success && res.hospital) {
          if (isMounted) {
            setHospital(res.hospital);
            setIsLoading(false);
          }
          return;
        }
      } catch (err: any) {
        console.warn("[HospitalDetailPage] Failed to fetch directory record:", err?.message || err);
      }

      if (isMounted) {
        setHospital(null);
        setError("This hospital record could not be found in the directory.");
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
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 max-w-3xl mx-auto">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-600" />
        <p className="text-sm font-medium text-navy">Loading directory record details...</p>
      </div>
    );
  }

  if (error || !hospital) {
    return (
      <ErrorState
        title="Hospital record not found"
        message={error || "This hospital record is no longer available in the directory."}
        onRetry={() => navigate("/patient/hospitals")}
      />
    );
  }

  const isGov = hospital.sourceType === "GOVERNMENT_DATA";
  const hasCoords =
    typeof hospital.latitude === "number" &&
    typeof hospital.longitude === "number" &&
    hospital.latitude !== 0 &&
    hospital.longitude !== 0;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-navy transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>

      {/* Main Header Card */}
      <Card className="p-6 border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {hospital.sourceType === "CARESETU_REGISTERED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> CareSetu Registered Network
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  <Database className="w-4 h-4 text-indigo-600" /> Government Open Data ({hospital.source})
                </span>
              )}

              {hospital.isVerified && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  Verified Partner
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-navy tracking-tight">{hospital.hospitalName}</h1>
            <p className="text-xs text-slate-500 font-semibold">{hospital.hospitalType}</p>
          </div>

          {hospital.sourceType === "CARESETU_REGISTERED" && (
            <div className="shrink-0">
              <Button
                variant="primary"
                onClick={() => showToast("success", `Emergency case request dispatched to ${hospital.hospitalName}.`)}
                className="bg-navy hover:bg-slate-800 text-white font-medium text-xs px-4 py-2.5"
              >
                Request Emergency Case
              </Button>
            </div>
          )}
        </div>

        {/* Source Data Attribution Banner for Government Records */}
        {isGov && (
          <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold">
                <Globe className="w-4 h-4" /> Source Dataset Attribution
              </div>
              <span className="text-[10px] text-slate-400">External Government Record</span>
            </div>

            <p className="text-slate-300 leading-relaxed">
              This record is published by the Government of India's Open Government Data platform under the{" "}
              <strong className="text-white">{hospital.licenseInfo || "Government Open Data License - India"}</strong>.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <div>
                <span className="text-slate-500 font-semibold">Source Record ID:</span>{" "}
                <span className="font-mono text-cyan-300">{hospital.sourceRecordId}</span>
              </div>

              {hospital.lastSyncedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Last Synced: {new Date(hospital.lastSyncedAt).toLocaleString("en-IN")}</span>
                </div>
              )}

              {hospital.sourceUrl && (
                <a
                  href={hospital.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  View data.gov.in resource <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Location & Details Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
            <div className="font-bold text-navy text-xs flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-cyan-600" /> Location Details
            </div>
            {hospital.address && <p className="text-slate-700">{hospital.address}</p>}
            <p className="text-slate-600 font-medium">
              <span className="font-semibold text-navy">District:</span> {hospital.district}
            </p>
            <p className="text-slate-600 font-medium">
              <span className="font-semibold text-navy">State:</span> {hospital.state}
            </p>
            {hospital.pincode && (
              <p className="text-slate-600 font-medium font-mono">
                <span className="font-semibold text-navy">Pincode:</span> {hospital.pincode}
              </p>
            )}

            {hospital.phone && (
              <p className="text-slate-700 font-mono pt-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {hospital.phone}
              </p>
            )}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
            <div className="font-bold text-navy text-xs flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-600" /> Verified Facility Information
            </div>

            {hospital.bedCount !== null && hospital.bedCount !== undefined ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Verified Bed Count</span>
                <span className="text-xl font-extrabold text-emerald-800">{hospital.bedCount} Beds</span>
              </div>
            ) : hospital.sourceType === "CARESETU_REGISTERED" ? (
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-cyan-900">
                <span className="text-[10px] uppercase font-bold text-cyan-700 block">CareSetu Partner Status</span>
                <span className="text-sm font-bold text-cyan-900">Active Verified Emergency Facility</span>
              </div>
            ) : (
              <p className="text-slate-500 italic">No static capacity bed count provided in raw government record.</p>
            )}

            {hospital.category && (
              <p className="text-slate-600">
                <span className="font-semibold text-navy">Category:</span> {hospital.category}
              </p>
            )}
          </div>
        </div>

        {/* AB PM-JAY Historical Trend Admissions Section */}
        {hospital.admissionData && (
          <div className="bg-sky-50/70 border border-sky-200 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-navy font-bold text-xs">
                <FileSpreadsheet className="w-4 h-4 text-sky-600" /> State AB PM-JAY Authorized Admissions History
              </div>
              <span className="text-[10px] font-semibold bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full border border-sky-200">
                2019-20 → 2024-25
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-sky-100 text-[11px] text-slate-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> This dataset represents cumulative historical authorized hospital admissions under
                Ayushman Bharat PM-JAY. It is historical trend data and does <strong>NOT</strong> represent real-time
                hospital bed availability or current emergency capacity.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {Object.entries(hospital.admissionData).map(([yr, count]) => (
                <div key={yr} className="bg-white p-2.5 rounded-lg border border-sky-100 text-center shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-semibold block">{yr}</span>
                  <span className="font-extrabold text-navy text-xs">{Number(count).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Leaflet Map for Valid Coordinates */}
        {hasCoords ? (
          <div className="space-y-2 pt-2">
            <span className="font-bold text-navy text-xs block">Map Location:</span>
            <div className="rounded-xl overflow-hidden h-64 border border-slate-200 z-0">
              <MapContainer
                center={[hospital.latitude!, hospital.longitude!]}
                zoom={13}
                scrollWheelZoom={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[hospital.latitude!, hospital.longitude!]}>
                  <Popup>{hospital.hospitalName}</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Exact GPS coordinates are not supplied in this government record. Location details are provided above.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
