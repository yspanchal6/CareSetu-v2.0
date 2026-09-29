import React, { useState, useEffect, useCallback } from "react";
import {
  GitCompare,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  MapPin,
  Phone,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  Database,
  ShieldCheck,
  Info,
  Filter,
  X,
  HelpCircle,
  Check,
  Building
} from "lucide-react";
import {
  hospitalMatchingApi,
  hospitalDirectoryApi,
  HospitalMatchItem,
  HospitalMatchingStats
} from "../../services/api";
import { useToast } from "../../components/common/Toast";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import { Card } from "../../components/common/Card";

export default function AdminHospitalMatchingPage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  const [candidates, setCandidates] = useState<HospitalMatchItem[]>([]);
  const [stats, setStats] = useState<HospitalMatchingStats | null>(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });

  // Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");

  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);

  // Selected Candidate for Review Modal
  const [selectedCandidate, setSelectedCandidate] = useState<HospitalMatchItem | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Reject / Unmatch Action Modal
  const [actionModalType, setActionModalType] = useState<"REJECT" | "UNMATCH" | null>(null);
  const [actionReason, setActionReason] = useState("");

  // Load Filter Options
  useEffect(() => {
    hospitalDirectoryApi
      .getFilters()
      .then((res) => {
        if (res.success && res.filters?.states) {
          setAvailableStates(res.filters.states);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Candidates & Stats
  const fetchCandidates = useCallback(
    async (pageNum = 1) => {
      setLoading(true);
      try {
        const res = await hospitalMatchingApi.getCandidates({
          page: pageNum,
          limit: 12,
          search,
          status: statusFilter,
          confidenceLevel: confidenceFilter,
          source: sourceFilter,
          state: stateFilter
        });

        if (res.success) {
          setCandidates(res.candidates || []);
          setStats(res.stats);
          setPagination(res.pagination);
        }
      } catch (err: any) {
        showToast("error", err.message || "Failed to load matching candidates");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, confidenceFilter, sourceFilter, stateFilter, showToast]
  );

  useEffect(() => {
    fetchCandidates(1);
  }, [fetchCandidates]);

  // Run Candidate Evaluation
  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await hospitalMatchingApi.generateCandidates();
      if (res.success) {
        showToast("success", `Candidate evaluation complete. Evaluated ${res.evaluatedCount} pairs.`);
        fetchCandidates(1);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to run candidate evaluation");
    } finally {
      setEvaluating(false);
    }
  };

  // Approve Match
  const handleApprove = async (candidateId: string) => {
    setActionLoading(true);
    try {
      const res = await hospitalMatchingApi.approveMatch(candidateId);
      if (res.success) {
        showToast("success", "Hospital match successfully approved and linked!");
        setReviewModalOpen(false);
        setSelectedCandidate(null);
        fetchCandidates(pagination.page);
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to approve match");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Reject / Unmatch
  const handleConfirmAction = async () => {
    if (!selectedCandidate || !actionModalType) return;
    setActionLoading(true);
    try {
      if (actionModalType === "REJECT") {
        await hospitalMatchingApi.rejectMatch(selectedCandidate.id, actionReason || "Rejected by admin");
        showToast("info", "Match candidate rejected");
      } else if (actionModalType === "UNMATCH") {
        await hospitalMatchingApi.unmatch(selectedCandidate.id, actionReason || "Unmatched by admin");
        showToast("info", "Hospital match relationship unlinked");
      }
      setActionModalType(null);
      setActionReason("");
      setReviewModalOpen(false);
      setSelectedCandidate(null);
      fetchCandidates(pagination.page);
    } catch (err: any) {
      showToast("error", err.message || "Operation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const getConfidenceBadge = (level: string) => {
    switch (level) {
      case "HIGH":
        return <Badge tone="high" dot>HIGH CONFIDENCE</Badge>;
      case "MEDIUM":
        return <Badge tone="medium" dot>MEDIUM CONFIDENCE</Badge>;
      default:
        return <Badge tone="low" dot>LOW CONFIDENCE</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MATCHED":
        return <Badge tone="matched">✓ MATCHED</Badge>;
      case "REJECTED":
        return <Badge tone="rejected">✕ REJECTED</Badge>;
      case "UNMATCHED":
        return <Badge tone="neutral">UNMATCHED</Badge>;
      default:
        return <Badge tone="pending">PENDING REVIEW</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-slate-900 text-white p-6 rounded-card border border-slate-800 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
        
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400 border border-cyan-500/30 shrink-0">
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Hospital Matching</h1>
                <button
                  type="button"
                  onClick={() => setShowHelpTooltip(!showHelpTooltip)}
                  className="text-slate-400 hover:text-cyan-400 transition-colors p-1"
                  title="How candidate evaluation works"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-300 mt-0.5">
                Review and verify relationships between government open health records and CareSetu network hospitals.
              </p>
            </div>
          </div>

          {showHelpTooltip && (
            <div className="mt-3 p-3.5 bg-slate-800/90 rounded-xl border border-cyan-500/30 text-xs text-slate-300 space-y-1.5 animate-slideUp">
              <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Info className="w-4 h-4" /> Deterministic Candidate Evaluation
              </p>
              <p>
                The matching engine compares government datasets (DATA_GOV_IN, PM_JAY) against registered CareSetu hospitals based on normalized name distance, state, district, pincode, and geographic coordinates.
              </p>
            </div>
          )}
        </div>

        <div className="z-10 shrink-0">
          <Button
            variant="primary"
            size="md"
            loading={evaluating}
            icon={<RefreshCw className={`w-4 h-4 ${evaluating ? "animate-spin" : ""}`} />}
            onClick={handleRunEvaluation}
            className="shadow-glow"
          >
            {evaluating ? "Evaluating Pairs..." : "Run Candidate Evaluation"}
          </Button>
        </div>
      </div>

      {/* Top Statistics Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gov Records</p>
            <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.totalGovernmentRecords}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending</p>
            <p className="text-xl font-extrabold text-sky-500 mt-1">{stats.pendingReview}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">High Conf.</p>
            <p className="text-xl font-extrabold text-emerald-500 mt-1">{stats.highConfidence}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Med Conf.</p>
            <p className="text-xl font-extrabold text-amber-500 mt-1">{stats.mediumConfidence}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Low Conf.</p>
            <p className="text-xl font-extrabold text-slate-500 mt-1">{stats.lowConfidence}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Matched</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-1">{stats.matched}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rejected</p>
            <p className="text-xl font-extrabold text-rose-500 mt-1">{stats.rejected}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-card">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Unmatched</p>
            <p className="text-xl font-extrabold text-slate-400 mt-1">{stats.unmatched}</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-card border border-slate-200/80 dark:border-slate-800 shadow-card space-y-4">
        <div className="flex items-center justify-between md:hidden pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-500" /> Filter Candidates
          </span>
          <button
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className="text-xs text-sky-600 font-semibold"
          >
            {mobileFilterOpen ? "Hide Filters" : "Show Filters"}
          </button>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-5 gap-3 ${mobileFilterOpen ? "block" : "hidden md:grid"}`}>
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by hospital name, pincode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Status: All</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="MATCHED">Matched</option>
              <option value="REJECTED">Rejected</option>
              <option value="UNMATCHED">Unmatched</option>
            </select>
          </div>

          <div>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Confidence: All</option>
              <option value="HIGH">High Confidence</option>
              <option value="MEDIUM">Medium Confidence</option>
              <option value="LOW">Low Confidence</option>
            </select>
          </div>

          <div>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">State: All</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-card border border-slate-200/80 dark:border-slate-800 text-center space-y-3 shadow-card">
          <Database className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Matching Candidates Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Try adjusting your search filters or click "Run Candidate Evaluation" to generate potential matches.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white dark:bg-slate-900 hover:shadow-soft p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 transition-all duration-200 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  {getConfidenceBadge(candidate.confidenceLevel)}
                  {getStatusBadge(candidate.status)}
                </div>

                {/* Candidate Pair Visual Flow */}
                <div className="space-y-2.5 text-sm">
                  {/* Government Record Box */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>GOVERNMENT RECORD</span>
                      <span className="font-mono text-cyan-600 dark:text-cyan-400">{candidate.governmentRecord.source}</span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{candidate.governmentRecord.hospitalName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {candidate.governmentRecord.district}, {candidate.governmentRecord.state}
                    </p>
                  </div>

                  {/* Flow Arrow */}
                  <div className="flex justify-center -my-1 text-slate-400">
                    <ArrowRightLeft className="w-4 h-4 rotate-90 sm:rotate-0" />
                  </div>

                  {/* CareSetu Hospital Box */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>CARESETU REGISTERED</span>
                      {candidate.careSetuHospital.isVerified && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{candidate.careSetuHospital.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {candidate.careSetuHospital.city}, {candidate.careSetuHospital.state}
                    </p>
                  </div>
                </div>

                {/* Evidence & Distance Badges */}
                <div className="space-y-1.5 pt-1">
                  {candidate.distanceKm !== null && candidate.distanceKm !== undefined && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-500" />
                      Spatial Distance: <span className="font-semibold text-slate-700 dark:text-slate-200">{candidate.distanceKm} km apart</span>
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {candidate.matchReasons?.slice(0, 2).map((reason, idx) => (
                      <span key={idx} className="text-[11px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800/50 font-medium">
                        ✓ {reason}
                      </span>
                    ))}
                    {candidate.conflictReasons?.slice(0, 1).map((conflict, idx) => (
                      <span key={idx} className="text-[11px] px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800/50 font-medium">
                        ⚠ {conflict}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setSelectedCandidate(candidate);
                    setReviewModalOpen(true);
                  }}
                  icon={<ChevronRight className="w-4 h-4" />}
                >
                  Side-by-Side Review
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Side-by-Side Review Modal */}
      {reviewModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  Candidate Entity Resolution
                  {getStatusBadge(selectedCandidate.status)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Detailed side-by-side comparison between Government Open Data record and CareSetu Network Hospital.
                </p>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Field Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Government Column */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Government Open Data</span>
                    <span className="text-xs font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                      {selectedCandidate.governmentRecord.source}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Hospital Name</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedCandidate.governmentRecord.hospitalName}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Facility Type</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCandidate.governmentRecord.hospitalType || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">State / District</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {selectedCandidate.governmentRecord.district}, {selectedCandidate.governmentRecord.state}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Pincode</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCandidate.governmentRecord.pincode || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Coordinates</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {selectedCandidate.governmentRecord.latitude
                        ? `${selectedCandidate.governmentRecord.latitude}, ${selectedCandidate.governmentRecord.longitude}`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* CareSetu Column */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">CareSetu Hospital</span>
                    {selectedCandidate.careSetuHospital.isVerified && (
                      <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Verified Network
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Hospital Name</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedCandidate.careSetuHospital.name}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Phone</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCandidate.careSetuHospital.phone || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">State / City</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {selectedCandidate.careSetuHospital.city}, {selectedCandidate.careSetuHospital.state}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Address</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCandidate.careSetuHospital.address || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Evidence & Conflict Breakdown Panel */}
              <div className="bg-slate-100 dark:bg-slate-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Why was this candidate suggested?</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">Positive Deterministic Evidence</p>
                    <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                      {selectedCandidate.matchReasons?.map((reason, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-amber-600 dark:text-amber-400 mb-1.5">Potential Conflicts / Missing Data</p>
                    <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                      {selectedCandidate.conflictReasons?.length ? (
                        selectedCandidate.conflictReasons.map((conflict, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {conflict}
                          </li>
                        ))
                      ) : (
                        <li className="text-slate-400 italic">No field conflicts detected</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setReviewModalOpen(false)}>
                Close
              </Button>

              <div className="flex items-center gap-2">
                {selectedCandidate.status === "MATCHED" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={actionLoading}
                    onClick={() => setActionModalType("UNMATCH")}
                  >
                    Unlink Relationship
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={actionLoading}
                      onClick={() => setActionModalType("REJECT")}
                    >
                      Reject Match
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      loading={actionLoading}
                      onClick={() => handleApprove(selectedCandidate.id)}
                    >
                      {actionLoading ? "Approving..." : "Approve & Link Entity"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject / Unmatch Reason Modal */}
      {actionModalType && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {actionModalType === "REJECT" ? "Reject Match Candidate" : "Unlink Hospital Relationship"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please enter an optional reason for audit logging purposes.
            </p>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter audit reason..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setActionModalType(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" loading={actionLoading} onClick={handleConfirmAction}>
                {actionLoading ? "Processing..." : "Confirm Action"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
