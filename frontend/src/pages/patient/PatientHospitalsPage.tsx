import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { SearchInput } from "../../components/common/Input";
import { hospitalDirectoryApi, DirectoryHospitalItem } from "../../services/api";
import { useTranslation } from "../../i18n/I18nContext";
import {
  Building2,
  Database,
  ShieldCheck,
  MapPin,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Globe,
  CheckCircle2,
  Layers,
  Map as MapIcon,
  ListFilter,
  Phone,
  Calendar,
} from "lucide-react";
import Button from "../../components/common/Button";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function PatientHospitalsPage() {
  const { t } = useTranslation();
  // Query Filters
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("ALL");
  const [selectedState, setSelectedState] = useState("ALL");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);

  // Data & State
  const [hospitals, setHospitals] = useState<DirectoryHospitalItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    registeredCount: 0,
    governmentCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic Filter Options
  const [filterOptions, setFilterOptions] = useState<{
    sources: { label: string; value: string }[];
    states: string[];
    districts: string[];
    hospitalTypes: string[];
  }>({
    sources: [
      { label: "All Sources", value: "ALL" },
      { label: "CareSetu Registered", value: "CARESETU_REGISTERED" },
      { label: "Government Open Data", value: "GOVERNMENT_DATA" },
    ],
    states: [],
    districts: [],
    hospitalTypes: [],
  });

  const [showMap, setShowMap] = useState(false);

  // Fetch Filter Options
  const loadFilters = useCallback(async (stateParam?: string) => {
    try {
      const res = await hospitalDirectoryApi.getFilters(stateParam !== "ALL" ? stateParam : undefined);
      if (res.success) {
        setFilterOptions(res.filters);
      }
    } catch (err: any) {
      console.warn("[PatientHospitalsPage] Failed to load directory filter options:", err?.message);
    }
  }, []);

  // Fetch Directory Records
  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await hospitalDirectoryApi.getDirectory({
        page,
        limit: 12,
        search,
        state: selectedState !== "ALL" ? selectedState : undefined,
        district: selectedDistrict !== "ALL" ? selectedDistrict : undefined,
        type: selectedType !== "ALL" ? selectedType : undefined,
        source: source !== "ALL" ? source : undefined,
        sort,
      });

      if (res.success) {
        setHospitals(res.data);
        setPagination(res.pagination);
      }
    } catch (err: any) {
      console.error("[PatientHospitalsPage] Error loading hospital directory:", err);
      setErrorMsg(err.message || "Failed to load hospital directory records.");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedState, selectedDistrict, selectedType, source, sort]);

  useEffect(() => {
    loadFilters(selectedState);
  }, [selectedState, loadFilters]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Valid coordinates map markers
  const validMapMarkers = hospitals.filter(
    (h) => typeof h.latitude === "number" && typeof h.longitude === "number" && h.latitude !== 0 && h.longitude !== 0
  );

  const defaultCenterLat = validMapMarkers.length > 0 ? validMapMarkers[0].latitude! : 28.6139;
  const defaultCenterLng = validMapMarkers.length > 0 ? validMapMarkers[0].longitude! : 77.2090;

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-navy via-slate-900 to-navy p-6 rounded-2xl text-white shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">{t("hospital.directoryTitle")}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
              V2.0 Directory
            </span>
          </div>
          <p className="text-xs text-slate-300">
            {t("hospital.directorySubtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 text-xs">
            <div className="text-right border-r border-white/20 pr-3">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">{t("hospital.careSetuRegistered")}</span>
              <span className="font-bold text-emerald-400 text-sm">{pagination.registeredCount}</span>
            </div>
            <div className="text-left pl-1">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">{t("hospital.governmentData")}</span>
              <span className="font-bold text-cyan-300 text-sm">{pagination.governmentCount}</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMap(!showMap)}
            className="border-slate-700 text-white hover:bg-white/10 bg-slate-800/60"
          >
            {showMap ? <ListFilter className="w-4 h-4 mr-1.5" /> : <MapIcon className="w-4 h-4 mr-1.5" />}
            {showMap ? "Show List View" : "Show Map Markers"}
          </Button>
        </div>
      </div>

      {/* Filter & Search Control Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Bar */}
          <div className="sm:col-span-4">
            <SearchInput
              placeholder={t("hospital.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Source Filter */}
          <div className="sm:col-span-3">
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              {filterOptions.sources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* State Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("ALL");
                setPage(1);
              }}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="ALL">All States ({filterOptions.states.length})</option>
              {filterOptions.states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-semibold text-navy focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="ALL">All Districts ({filterOptions.districts.length})</option>
              {filterOptions.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map View Mode */}
      {showMap && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md">
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs text-navy font-semibold">
            <span>Map Markers ({validMapMarkers.length} hospitals with coordinates)</span>
            <span className="text-slate-400">Centered on active search results</span>
          </div>
          <div className="h-96 w-full">
            <MapContainer
              center={[defaultCenterLat, defaultCenterLng]}
              zoom={6}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {validMapMarkers.map((h) => (
                <Marker key={h.id} position={[h.latitude!, h.longitude!]}>
                  <Popup>
                    <div className="space-y-1 text-xs font-sans">
                      <div className="font-bold text-navy">{h.hospitalName}</div>
                      <div className="text-[10px] text-slate-500">{h.district}, {h.state}</div>
                      <div className="text-[10px] font-semibold text-cyan-700">Source: {h.source}</div>
                      <Link
                        to={`/patient/hospitals/${h.id}`}
                        className="block mt-1 text-[11px] font-bold text-cyan-800 underline"
                      >
                        View Details →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Directory Grid View */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 font-medium">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
          <p className="text-xs">Loading hospital directory records...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-xs">
          <p className="font-bold">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={() => loadDirectory()} className="mt-3">
            Try Again
          </Button>
        </div>
      ) : hospitals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-navy text-base">No matching hospitals found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No hospital records match your search filters. Try adjusting your state, district, or search query.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setSource("ALL");
              setSelectedState("ALL");
              setSelectedDistrict("ALL");
              setSelectedType("ALL");
            }}
          >
            Reset All Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-navy">{hospitals.length}</strong> of{" "}
              <strong className="text-navy">{pagination.total}</strong> directory records
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hospitals.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all hover:border-cyan-300 group"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    {h.sourceType === "CARESETU_REGISTERED" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> CareSetu Registered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <Database className="w-3.5 h-3.5 text-indigo-600" /> Government Data ({h.source})
                      </span>
                    )}

                    {h.isVerified && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        Verified Partner
                      </span>
                    )}
                  </div>

                  {/* Hospital Info */}
                  <div>
                    <h3 className="font-bold text-navy text-base group-hover:text-cyan-700 transition-colors line-clamp-1">
                      {h.hospitalName}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {h.district}, {h.state} {h.pincode ? `(${h.pincode})` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Description / Address */}
                  {h.address && (
                    <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {h.address}
                    </p>
                  )}

                  {/* Legitimate Verified Capacity or Admissions Info */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {h.bedCount !== null && h.bedCount !== undefined && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                        {h.bedCount} Verified Beds
                      </span>
                    )}

                    {h.admissionData && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                        AB PM-JAY Admissions Data
                      </span>
                    )}

                    {h.phone && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-mono">
                        <Phone className="w-3 h-3 text-slate-400" /> {h.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action & Timestamp */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {h.lastSyncedAt
                        ? `Synced: ${new Date(h.lastSyncedAt).toLocaleDateString("en-IN")}`
                        : "Updated recently"}
                    </span>
                  </div>

                  <Link to={`/patient/hospitals/${h.id}`}>
                    <Button variant="outline" size="sm" className="text-xs font-semibold hover:bg-slate-50">
                      View Directory Record →
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="text-xs text-slate-500">
              Page <span className="font-semibold text-navy">{pagination.page}</span> of{" "}
              <span className="font-semibold text-navy">{pagination.totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
