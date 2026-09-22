import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SearchInput } from "../../components/common/Input";
import { Select } from "../../components/common/Input";
import HospitalCard from "../../components/hospital-matching/HospitalCard";
import { hospitals as fallbackHospitals } from "../../data/hospitals";
import { EmptyState } from "../../components/common/States";
import { Building2, Wifi } from "lucide-react";
import { putRecord, getAllRecords } from "../../utils/offlineDB";

export default function PatientHospitalsPage() {
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState("All");
  const [hospitalsList, setHospitalsList] = useState<any[]>(fallbackHospitals);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [lastCachedAt, setLastCachedAt] = useState<string | null>(null);

  useEffect(() => {
    const syncHospitalsCache = async () => {
      if (navigator.onLine) {
        // Cache public hospital data into IndexedDB store hospital_directory
        const nowIso = new Date().toISOString();
        const expiresIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        for (const h of fallbackHospitals) {
          await putRecord("hospital_directory", {
            id: String(h.id),
            name: h.name,
            address: h.address,
            phone: h.phone,
            city: h.city,
            capabilities: h.capabilities,
            location: { latitude: h.lat, longitude: h.lng },
            cachedAt: nowIso,
            expiresAt: expiresIso,
            dataVersion: "1.0",
          }).catch(console.warn);
        }
        setLastCachedAt(nowIso);
      } else {
        // Load from IndexedDB when offline
        const cached = await getAllRecords<any>("hospital_directory");
        if (cached && cached.length > 0) {
          setHospitalsList(
            cached.map((c) => ({
              id: c.id,
              name: c.name,
              address: c.address,
              phone: c.phone,
              city: c.city || "Nearby",
              capabilities: c.capabilities || [],
              lat: c.location?.latitude || 0,
              lng: c.location?.longitude || 0,
            }))
          );
          setLastCachedAt(cached[0]?.cachedAt || null);
        }
      }
    };

    void syncHospitalsCache();

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const capabilities = ["All", ...Array.from(new Set(hospitalsList.flatMap((h) => h.capabilities)))];

  const filtered = hospitalsList.filter(
    (h) =>
      h.name.toLowerCase().includes(query.toLowerCase()) &&
      (capability === "All" || h.capabilities.includes(capability))
  );

  return (
    <div className="flex flex-col gap-4 pb-6">
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-amber-900 shadow-sm">
          <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Offline Mode:</strong> Showing previously cached hospital information.
            {lastCachedAt ? ` (Last updated: ${new Date(lastCachedAt).toLocaleDateString()})` : ""}
            {" "}Real-time hospital bed availability revalidates upon reconnection.
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput placeholder="Search hospitals..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={capability} onChange={(e) => setCapability(e.target.value)} className="sm:w-56">
          {capabilities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No hospitals found" message="Try adjusting your search or filters." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((h) => (
            <Link key={h.id} to={`/patient/hospitals/${h.id}`}>
              <HospitalCard hospital={h} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

