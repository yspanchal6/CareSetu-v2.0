import { useState, useEffect, useCallback } from "react";
import { govHealthDataApi, GovDatasetSummary, ApiSetuInfo } from "../../services/api";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { SearchInput } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import { useTranslation } from "../../i18n/I18nContext";
import {
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  ExternalLink,
  Layers,
  ShieldCheck,
  Globe,
  FileSpreadsheet,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  History,
  AlertTriangle,
  FileText,
  Search,
} from "lucide-react";

export function AdminGovHealthDataPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();

  // Summary & Datasets state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({});
  const [datasets, setDatasets] = useState<GovDatasetSummary[]>([]);
  const [apiSetu, setApiSetu] = useState<ApiSetuInfo | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Table records state
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecordsCount, setTotalRecordsCount] = useState(0);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [selectedState, setSelectedState] = useState("ALL");

  // Inspection Modals
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedSourceDetail, setSelectedSourceDetail] = useState<GovDatasetSummary | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Keyboard Escape Key listener for closing modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRecord(null);
        setSelectedSourceDetail(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch summary data
  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await govHealthDataApi.getSummary();
      if (res.success) {
        setDatasets(res.datasets);
        setApiSetu(res.apiSetu);
        setTotalRecords(res.totalRecords);
        setLastUpdated(new Date());
        if (isManualRefresh) {
          showToast("success", "Government health data summary refreshed.");
        }
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to load government health data summary");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  // Fetch paginated health records
  const fetchRecords = useCallback(async () => {
    try {
      setRecordsLoading(true);
      const res = await govHealthDataApi.getRecords({
        page,
        limit: 10,
        source: selectedSource,
        state: selectedState,
        search: debouncedSearch,
      });
      if (res.success) {
        setRecords(res.records);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalRecordsCount(res.pagination.total || 0);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to load health records");
    } finally {
      setRecordsLoading(false);
    }
  }, [page, selectedSource, selectedState, debouncedSearch, showToast]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Execute dataset sync
  const handleSync = async (datasetKey: string, datasetName: string) => {
    if (syncingMap[datasetKey]) return;
    try {
      setSyncingMap((prev) => ({ ...prev, [datasetKey]: true }));
      const res = await govHealthDataApi.syncDataset(datasetKey);
      if (res && res.success) {
        const count = res.result?.recordsImported ?? 0;
        const msg = count > 0 
          ? `Successfully synchronized ${datasetName} (${count} records imported).`
          : `${datasetName} is already up to date.`;
        showToast("success", msg);
        await fetchSummary();
        await fetchRecords();
      }
    } catch (err: any) {
      showToast("error", err.message || `Failed to sync ${datasetName}`);
    } finally {
      setSyncingMap((prev) => ({ ...prev, [datasetKey]: false }));
    }
  };

  // Helper for relative time string
  const getRelativeTimeString = (date: Date) => {
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSecs < 10) return "Just now";
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  // Status Badge Renderer
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
      case "CONNECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Connected & Synced
          </span>
        );
      case "SYNCING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" /> Syncing...
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Sync Failed
          </span>
        );
      case "STALE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Stale Data
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Not Configured
          </span>
        );
    }
  };

  const hasActiveFilters = search.trim() !== "" || selectedSource !== "ALL" || selectedState !== "ALL";

  const clearAllFilters = () => {
    setSearch("");
    setSelectedSource("ALL");
    setSelectedState("ALL");
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12 transition-all duration-200 motion-reduce:transition-none">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t("nav.governmentHealthData") || "Government Health Data"}
              </h1>
              <p className="text-sm text-slate-500">
                Manage verified government health datasets, synchronization status, provenance, and external health records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            Last updated: <span className="text-slate-600 font-semibold">{getRelativeTimeString(lastUpdated)}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing || loading}
            onClick={() => {
              fetchSummary(true);
              fetchRecords();
            }}
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-medium shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-navy ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* 2. Hero Card */}
      <div className="bg-gradient-to-r from-navy via-slate-900 to-navy p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 tracking-wider uppercase">
                CareSetu V2.0 • Step 1
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Verified External Provenance
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Official Open Government Health Datasets
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Normalized external datasets sourced from Open Government Data (data.gov.in) and API Setu discovery endpoints. All records remain segregated from CareSetu registered hospital accounts.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/15 text-right shadow-inner min-w-[170px]">
              <div className="text-[10px] text-slate-300 uppercase font-semibold tracking-wider">Total Verified Records</div>
              <div className="text-2xl font-extrabold text-cyan-300 tracking-tight">
                {loading ? "..." : totalRecords.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Data Source Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {datasets.map((ds) => {
          const isSyncing = syncingMap[ds.key] || ds.status === "SYNCING";
          const isPmjay = ds.key === "pmjay_admissions";

          return (
            <Card
              key={ds.key}
              className="p-5 flex flex-col justify-between border-slate-200 shadow-xs hover:shadow-md transition-all duration-200"
            >
              <div className="space-y-4">
                {/* Header & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPmjay
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-cyan-50 text-cyan-700 border-cyan-200"
                      }`}
                    >
                      {isPmjay ? <FileSpreadsheet className="w-5.5 h-5.5" /> : <Building2 className="w-5.5 h-5.5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{ds.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-slate-600">{ds.source}</span>
                        <span className="text-[11px] text-slate-400">• {ds.period}</span>
                      </div>
                    </div>
                  </div>
                  <div>{getStatusBadge(ds.status)}</div>
                </div>

                {/* Explicit Historical Warning Badge for PM-JAY */}
                {isPmjay && (
                  <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                    <History className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-amber-950 text-[11px] uppercase tracking-wide">
                        Historical Government Dataset (2019–2025)
                      </span>
                      <span className="text-[11px] text-amber-800 leading-snug block mt-0.5">
                        Historical admission counts represent past claim records, <strong>not current hospital bed availability</strong>.
                      </span>
                    </div>
                  </div>
                )}

                {/* Metrics Box */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">
                      Records Imported
                    </span>
                    <span className="font-bold text-slate-900 text-base">
                      {ds.records.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">
                      Last Synchronized
                    </span>
                    <span className="font-semibold text-slate-700">
                      {ds.lastSync
                        ? new Date(ds.lastSync).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Never"}
                    </span>
                  </div>
                </div>

                {/* Error Log Message */}
                {ds.lastLogMessage && ds.status === "FAILED" && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <span>{ds.lastLogMessage}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-4">
                <div className="flex items-center gap-3">
                  <a
                    href={ds.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 hover:underline"
                  >
                    <Globe className="w-3.5 h-3.5" /> Resource <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => setSelectedSourceDetail(ds)}
                    className="text-xs font-medium text-slate-600 hover:text-navy flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" /> Source Details
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={isSyncing}
                  onClick={() => handleSync(ds.key, ds.name)}
                  className="bg-navy hover:bg-slate-800 text-white font-medium shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 4. API Setu Framework Section */}
      {apiSetu && (
        <Card className="p-5 border-slate-800 bg-gradient-to-r from-slate-900 via-navy to-slate-900 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base tracking-wide">{apiSetu.name}</h3>
                <span className="px-2.5 py-0.5 text-[10px] rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 uppercase tracking-wider">
                  Discovery & Integration Mode
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">{apiSetu.purpose}</p>
              
              <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1">
                <div>
                  <span className="text-slate-400 font-medium">Publisher:</span> {apiSetu.publisher}
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Auth Mode:</span> {apiSetu.authentication}
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>{" "}
                  <span className="text-amber-300 font-bold px-2 py-0.5 bg-amber-400/10 rounded border border-amber-400/20">
                    {apiSetu.status === "CONFIGURED" ? "CONFIGURED" : "DISCOVERY ONLY"}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <a
                href={apiSetu.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors shadow-xs"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-300" /> API Documentation <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* 5. External Health Records Directory */}
      <Card className="p-5 space-y-4 border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">External Health Records Directory</h3>
            <p className="text-xs text-slate-500">
              Normalized external government datasets stored separately from CareSetu registered accounts.
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setPage(1);
                }}
                className="text-xs py-1.5 px-3 rounded-xl border border-slate-200 font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer"
              >
                <option value="ALL">All Sources</option>
                <option value="DATA_GOV_IN">DATA_GOV_IN (District Hospitals)</option>
                <option value="PM_JAY">PM_JAY (Historical Admissions)</option>
              </select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-rose-600 hover:bg-rose-50 font-medium"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-96 relative">
            <SearchInput
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by hospital, district or state..."
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-900">{records.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalRecordsCount}</span> records
          </div>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-3">Source & Provenance</th>
                <th className="p-3">Hospital / Entity Name</th>
                <th className="p-3">State & District</th>
                <th className="p-3">Category / Metric</th>
                <th className="p-3">Last Synced</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {recordsLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="p-3 text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Search className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">No Government Health Records Found</h4>
                      <p className="text-xs text-slate-500">
                        {hasActiveFilters
                          ? "No external records match your search query or selected filter criteria."
                          : "No external government health datasets are currently imported."}
                      </p>
                      {hasActiveFilters && (
                        <Button variant="outline" size="sm" onClick={clearAllFilters}>
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="space-y-0.5">
                        <span
                          className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] border ${
                            rec.source === "PM_JAY"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-cyan-50 text-cyan-800 border-cyan-200"
                          }`}
                        >
                          {rec.source}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                          {rec.sourceRecordId}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{rec.hospitalName}</div>
                      <div className="text-[11px] text-slate-500">{rec.hospitalType || "Government Health Facility"}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{rec.state}</div>
                      <div className="text-[11px] text-slate-400">{rec.district || rec.pincode || "State Level"}</div>
                    </td>
                    <td className="p-3">
                      {rec.bedCount !== null && rec.bedCount !== undefined ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-100">
                          {rec.bedCount} Total Beds
                        </span>
                      ) : rec.admissionData ? (
                        <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                          Historical Admissions
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">{rec.category || "N/A"}</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {rec.lastSyncedAt ? new Date(rec.lastSyncedAt).toLocaleDateString("en-IN") : "N/A"}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRecord(rec)}
                        className="text-xs text-navy hover:bg-slate-100 font-semibold"
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-xs font-medium"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="text-xs font-medium"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* 6. Source Details Inspection Modal */}
      {selectedSourceDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 border border-slate-100 flex flex-col gap-4 max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedSourceDetail.name}</h3>
                  <p className="text-xs text-slate-500">Government Data Source Metadata</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSourceDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SOURCE CODE</span>
                  <span className="font-bold text-slate-900">{selectedSourceDetail.source}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">DATASET KEY</span>
                  <span className="font-mono text-slate-700">{selectedSourceDetail.key}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">PERIOD COVERED</span>
                  <span className="font-semibold text-slate-800">{selectedSourceDetail.period}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">RECORDS COUNT</span>
                  <span className="font-bold text-slate-900">{selectedSourceDetail.records.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {selectedSourceDetail.key === "pmjay_admissions" && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Historical Data Classification
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This dataset aggregates historical authorized hospital admissions under AB PM-JAY from 2019–20 through 2024–25. It serves for retrospective analytics and historical transparency, and does not represent live bed availability.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-xs">Provenance & Governance:</h4>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                  <div><strong>Publisher / Provider:</strong> Open Government Data (OGD) Platform India</div>
                  <div><strong>Attribution License:</strong> Open Government Data License - India (OGDL)</div>
                  <div><strong>Resource Link:</strong> <a href={selectedSourceDetail.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:underline">{selectedSourceDetail.sourceUrl}</a></div>
                  <div><strong>Isolation Rules:</strong> Stored strictly in <code>GovernmentHealthRecord</code> SQL entities; completely detached from CareSetu hospital login credentials.</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedSourceDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-100 flex flex-col gap-4 max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-navy/10 text-navy flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedRecord.hospitalName}</h3>
                  <p className="text-xs text-slate-500">Government Health Record Details</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 text-xs">
              {/* Provenance Badge */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold px-2 py-0.5 rounded text-xs bg-cyan-100 text-cyan-800">
                    Source: {selectedRecord.source}
                  </span>
                  <span className="text-slate-400 text-[11px] font-mono">ID: {selectedRecord.sourceRecordId}</span>
                </div>
                <span className="text-slate-500 text-[11px]">
                  Synced: {selectedRecord.lastSyncedAt ? new Date(selectedRecord.lastSyncedAt).toLocaleDateString("en-IN") : "N/A"}
                </span>
              </div>

              {/* Facility Meta */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">STATE</span>
                  <span className="font-bold text-slate-900">{selectedRecord.state}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">DISTRICT / PIN</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.district || selectedRecord.pincode || "State Level"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">FACILITY TYPE</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.hospitalType || "Government Facility"}</span>
                </div>
                {selectedRecord.bedCount !== null && selectedRecord.bedCount !== undefined && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TOTAL BED COUNT</span>
                    <span className="font-bold text-emerald-700 text-sm">{selectedRecord.bedCount} Beds</span>
                  </div>
                )}
              </div>

              {/* Historical Admissions Table if PM-JAY */}
              {selectedRecord.admissionData && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-600" /> Historical Admissions Breakdown (PM-JAY):
                  </span>
                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 overflow-x-auto">
                    <pre className="text-amber-950 font-mono text-[11px]">
                      {JSON.stringify(selectedRecord.admissionData, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-900 text-xs block">Raw Unmodified Source Payload:</span>
                <pre className="bg-slate-900 text-cyan-300 p-3.5 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-48">
                  {JSON.stringify(selectedRecord.rawData || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminGovHealthDataPage;
