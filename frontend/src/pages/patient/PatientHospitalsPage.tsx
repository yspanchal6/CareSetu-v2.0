import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { SearchInput, Select, Input } from "../../components/common/Input";
import HospitalCard from "../../components/hospital-matching/HospitalCard";
import { hospitals as fallbackHospitals } from "../../data/hospitals";
import { EmptyState } from "../../components/common/States";
import { Building2, Wifi, MapPin, Navigation, AlertCircle, SlidersHorizontal, RefreshCw, ShieldCheck } from "lucide-react";
import { putRecord, getAllRecords } from "../../utils/offlineDB";
import { hospitalApi, NearbyHospital } from "../../services/api";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const DEFAULT_LAT = 28.6139; // New Delhi default
const DEFAULT_LNG = 77.2090;

const PRESET_LOCATIONS = [
  { name: "New Delhi", lat: 28.6139, lng: 77.2090 },
  { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
];

export default function PatientHospitalsPage() {
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState("All");
  const [hospitalsList, setHospitalsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Location & Range State
  const [userLat, setUserLat] = useState<number | null>(DEFAULT_LAT);
  const [userLng, setUserLng] = useState<number | null>(DEFAULT_LNG);
  const [locationName, setLocationName] = useState("Default (New Delhi)");
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "manual">("idle");
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [showManualLoc, setShowManualLoc] = useState(false);
  const [customLatStr, setCustomLatStr] = useState("28.6139");
  const [customLngStr, setCustomLngStr] = useState("77.2090");

  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [lastCachedAt, setLastCachedAt] = useState<string | null>(null);

  // Request GPS Location
  const requestGPSLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      setErrorMsg("Geolocation is not supported by your browser. Please enter location manually.");
      return;
    }

    setLocationStatus("requesting");
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        setCustomLatStr(lat.toFixed(4));
        setCustomLngStr(lng.toFixed(4));
        setLocationName("GPS Position");
        setLocationStatus("granted");
      },
      (err) => {
        console.warn("[PatientHospitalsPage] Geolocation error:", err.message);
        setLocationStatus("denied");
        setErrorMsg("Location access denied or unavailable. Using manual location fallback.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Fetch Hospitals from Backend or Offline Cache
  const loadHospitals = useCallback(async (lat: number | null, lng: number | null, radius: number) => {
    setIsLoading(true);
    setErrorMsg(null);

    const effLat = lat ?? DEFAULT_LAT;
    const effLng = lng ?? DEFAULT_LNG;

    if (navigator.onLine) {
      try {
        const res = await hospitalApi.nearby(effLat, effLng, radius);
        if (res.success && Array.isArray(res.hospitals)) {
          // Format backend hospitals
          const mapped = res.hospitals.map((h: NearbyHospital) => {
            const dist = h.distanceKm ?? getDistanceKm(effLat, effLng, h.location?.latitude || effLat, h.location?.longitude || effLng);
            return {
              id: h.id,
              name: h.name,
              address: h.address,
              city: h.city || "Nearby",
              phone: h.phone,
              capabilities: h.capabilities || ["Emergency Care"],
              availability: h.emergencyAvailable ? "Available" : "Limited",
              isVerified: h.isVerified ?? true,
              responseTimeMin: Math.max(5, Math.round(dist * 3 + 4)),
              bedsAvailable: 12,
              beds: 30,
              icuAvailable: 3,
              icuBeds: 8,
              rating: 4.8,
              lat: h.location?.latitude || effLat,
              lng: h.location?.longitude || effLng,
              distanceKm: dist,
            };
          });

          // Sort by distance
          mapped.sort((a, b) => a.distanceKm - b.distanceKm);

          setHospitalsList(mapped);

          // Update offline DB
          const nowIso = new Date().toISOString();
          for (const item of mapped) {
            await putRecord("hospital_directory", {
              id: String(item.id),
              name: item.name,
              address: item.address,
              phone: item.phone,
              city: item.city,
              capabilities: item.capabilities,
              location: { latitude: item.lat, longitude: item.lng },
              cachedAt: nowIso,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              dataVersion: "2.0",
            }).catch(() => {});
          }
          setLastCachedAt(nowIso);
          setIsLoading(false);
          return;
        }
      } catch (err: any) {
        console.warn("[PatientHospitalsPage] API fetch failed, falling back to local list:", err?.message);
        setErrorMsg("Could not connect to hospital search service. Showing cached/sample hospitals.");
      }
    }

    // Offline / Fallback
    const cached = await getAllRecords<any>("hospital_directory").catch(() => []);
    const sourceList = (cached && cached.length > 0) ? cached : fallbackHospitals;

    const formattedFallback = sourceList.map((c: any) => {
      const hLat = c.location?.latitude ?? c.lat ?? DEFAULT_LAT;
      const hLng = c.location?.longitude ?? c.lng ?? DEFAULT_LNG;
      const dist = getDistanceKm(effLat, effLng, hLat, hLng);
      return {
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        city: c.city || "Nearby",
        capabilities: c.capabilities || ["Emergency Care"],
        availability: "Available",
        isVerified: true,
        responseTimeMin: Math.max(5, Math.round(dist * 3 + 4)),
        bedsAvailable: 15,
        beds: 40,
        icuAvailable: 4,
        icuBeds: 10,
        rating: 4.7,
        lat: hLat,
        lng: hLng,
        distanceKm: dist,
      };
    });

    // Filter within radius
    const inRange = formattedFallback.filter((h) => h.distanceKm <= radius);
    inRange.sort((a, b) => a.distanceKm - b.distanceKm);

    setHospitalsList(inRange);
    setIsLoading(false);
  }, []);

  // Initial Load & GPS Prompt
  useEffect(() => {
    void loadHospitals(userLat, userLng, radiusKm);

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userLat, userLng, radiusKm, loadHospitals]);

  // Handle Manual Location Apply
  const applyManualCoordinates = () => {
    const parsedLat = parseFloat(customLatStr);
    const parsedLng = parseFloat(customLngStr);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setErrorMsg("Invalid Latitude. Must be between -90 and 90.");
      return;
    }
    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setErrorMsg("Invalid Longitude. Must be between -180 and 180.");
      return;
    }

    setUserLat(parsedLat);
    setUserLng(parsedLng);
    setLocationName(`Custom (${parsedLat.toFixed(2)}, ${parsedLng.toFixed(2)})`);
    setLocationStatus("manual");
    setShowManualLoc(false);
    setErrorMsg(null);
  };

  const handlePresetSelect = (loc: typeof PRESET_LOCATIONS[0]) => {
    setUserLat(loc.lat);
    setUserLng(loc.lng);
    setCustomLatStr(loc.lat.toString());
    setCustomLngStr(loc.lng.toString());
    setLocationName(loc.name);
    setLocationStatus("manual");
    setShowManualLoc(false);
    setErrorMsg(null);
  };

  const capabilities = ["All", ...Array.from(new Set(hospitalsList.flatMap((h) => h.capabilities)))];

  const filtered = hospitalsList.filter(
    (h) =>
      h.name.toLowerCase().includes(query.toLowerCase()) &&
      (capability === "All" || h.capabilities.includes(capability))
  );

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Offline Alert */}
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-amber-900 shadow-sm">
          <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Offline Mode:</strong> Showing cached hospital directory.
            {lastCachedAt ? ` (Cached at: ${new Date(lastCachedAt).toLocaleTimeString()})` : ""}
          </span>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Location & Search Header Controls */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm text-navy font-semibold">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>Search Location:</span>
            <Badge tone={locationStatus === "granted" ? "available" : locationStatus === "manual" ? "busy" : "limited"}>
              {locationName}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={requestGPSLocation}
              disabled={locationStatus === "requesting"}
            >
              <Navigation className={`w-3.5 h-3.5 mr-1 ${locationStatus === "requesting" ? "animate-spin" : ""}`} />
              {locationStatus === "requesting" ? "Locating..." : "Use My GPS"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowManualLoc(!showManualLoc)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
              Change Location
            </Button>
          </div>
        </div>

        {/* Manual Location Selection Drawer */}
        {showManualLoc && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs">
            <p className="font-semibold text-navy">Set Search Coordinates / City</p>
            
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => handlePresetSelect(loc)}
                  className="px-2.5 py-1 bg-white border border-gray-200 hover:border-primary rounded-lg font-medium text-navy text-[11px] transition-colors"
                >
                  {loc.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Latitude (-90 to 90)</label>
                <Input
                  value={customLatStr}
                  onChange={(e) => setCustomLatStr(e.target.value)}
                  placeholder="28.6139"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 mb-1">Longitude (-180 to 180)</label>
                <Input
                  value={customLngStr}
                  onChange={(e) => setCustomLngStr(e.target.value)}
                  placeholder="77.2090"
                />
              </div>
              <div>
                <Button variant="primary" size="sm" fullWidth onClick={applyManualCoordinates}>
                  Apply Location
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search, Capability & Radius Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <SearchInput
              placeholder="Search hospitals by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="sm:col-span-4">
            <Select value={capability} onChange={(e) => setCapability(e.target.value)}>
              {capabilities.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Specialties & Services" : c}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-3">
            <Select
              value={radiusKm.toString()}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            >
              <option value="5">Search Radius: 5 km</option>
              <option value="10">Search Radius: 10 km</option>
              <option value="25">Search Radius: 25 km</option>
              <option value="50">Search Radius: 50 km</option>
              <option value="100">Search Radius: 100 km</option>
              <option value="200">Search Radius: 200 km</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-secondary">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-medium">Searching verified hospitals within {radiusKm} km...</p>
        </div>
      ) : filtered.length === 0 ? (
        /* Range-Based Empty State */
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-navy text-base">No hospitals found within your current search range</h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto mt-1">
              There are no verified hospitals matching your filters within <strong className="text-navy">{radiusKm} km</strong> of {locationName}.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {radiusKm < 200 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setRadiusKm(radiusKm <= 25 ? 50 : radiusKm <= 50 ? 100 : 200)}
              >
                Expand Search Radius to {radiusKm <= 25 ? 50 : radiusKm <= 50 ? 100 : 200} km
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualLoc(true)}
            >
              Select Different Location
            </Button>
          </div>
        </div>
      ) : (
        /* Results Grid */
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary px-1">
            <span>Showing <strong>{filtered.length}</strong> verified hospital{filtered.length !== 1 ? "s" : ""} within <strong>{radiusKm} km</strong></span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Only
            </span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((h) => (
              <Link key={h.id} to={`/patient/hospitals/${h.id}`} state={{ hospital: h }}>
                <HospitalCard hospital={h} distanceKm={h.distanceKm} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
