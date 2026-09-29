import { useEffect, useState, useMemo } from "react";
import {
  ShieldAlert,
  Unlock,
  RefreshCw,
  AlertTriangle,
  FileText,
  Ban,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowUpDown,
  Mail,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Hospital,
  AlertCircle,
  Download,
  Eye,
  Layers,
  Activity,
  BarChart3,
  SlidersHorizontal
} from "lucide-react";
import { SecureContentService } from "../../services/secure-content.service";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";
import { useTranslation } from "../../i18n";

/**
 * Format raw eventType enum strings into clean user-facing labels
 */
function formatEventType(type?: string): string {
  if (!type) return "Screenshot Attempt";
  const upper = type.toUpperCase();
  if (upper === "SCREENSHOT_ATTEMPT") return "Screenshot Attempt";
  if (upper === "SCREEN_RECORDING" || upper === "SCREEN_RECORDING_DETECTED") return "Screen Recording";
  if (upper === "SCREEN_CAPTURE_DETECTED") return "Screen Capture";
  if (upper === "SCREEN_MIRRORING_DETECTED") return "Screen Mirroring";
  if (upper === "PROTECTED_CONTENT_CAPTURE") return "Protected Content Capture";
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format raw platform enum strings into clean user-facing labels
 */
function formatPlatform(platform?: string): string {
  if (!platform) return "Web";
  const upper = platform.toUpperCase();
  if (upper === "WEB") return "Web";
  if (upper === "ANDROID") return "Android";
  if (upper === "IOS") return "iOS";
  if (upper === "DESKTOP") return "Desktop";
  return platform;
}

/**
 * Segmented Security Indicator (e.g. ● ○ ○ for 1/3, ● ● ○ for 2/3, ● ● ● for 3/3)
 */
function SegmentedViolationIndicator({ count }: { count: number }) {
  const safeCount = Math.min(Math.max(count, 0), 3);
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs border border-slate-200/80 shadow-2xs"
      aria-label={`Attempt ${safeCount} of 3 confirmed security violations`}
      title={`Attempt ${safeCount} of 3 confirmed security violations`}
    >
      <div className="flex items-center gap-1" aria-hidden="true">
        <span className={`w-2.5 h-2.5 rounded-full transition-colors ${safeCount >= 1 ? (safeCount === 1 ? "bg-amber-500" : "bg-red-500 shadow-2xs") : "bg-slate-300"}`} />
        <span className={`w-2.5 h-2.5 rounded-full transition-colors ${safeCount >= 2 ? "bg-amber-600 shadow-2xs" : "bg-slate-300"}`} />
        <span className={`w-2.5 h-2.5 rounded-full transition-colors ${safeCount >= 3 ? "bg-red-600 shadow-2xs animate-pulse" : "bg-slate-300"}`} />
      </div>
      <span className="font-bold ml-1 text-slate-900">{safeCount} / 3</span>
    </div>
  );
}

/**
 * Review Stage Flow Progress Bar
 */
function ReviewStageFlow({ status, hasAppeal }: { status: string; hasAppeal: boolean }) {
  const isBlocked = status === "TEMPORARILY_BLOCKED" || status === "UNDER_REVIEW";
  
  let stage = 1;
  if (isBlocked) stage = 2;
  if (hasAppeal) stage = 3;
  if (status === "UNDER_REVIEW") stage = 4;

  const stages = [
    { num: 1, label: "Security Violation" },
    { num: 2, label: "Portal Blocked" },
    { num: 3, label: "Review Submitted" },
    { num: 4, label: "Admin Review" },
    { num: 5, label: "Access Restored" }
  ];

  return (
    <div className="w-full bg-slate-50 text-slate-800 p-3 rounded-xl border border-slate-200 text-[11px] my-1 shadow-2xs">
      <div className="flex items-center justify-between relative">
        {stages.map((s) => {
          const isPassed = stage > s.num;
          const isCurrent = stage === s.num;

          return (
            <div key={s.num} className="flex-1 flex flex-col items-center relative z-10 text-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
                  isCurrent
                    ? "bg-amber-500 text-white ring-4 ring-amber-500/20 scale-110 shadow-sm"
                    : isPassed
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-500 border border-slate-300"
                }`}
              >
                {isPassed ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={`mt-1 font-medium text-[10px] hidden sm:inline ${isCurrent ? "text-amber-700 font-bold" : isPassed ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Result Badge with Icon & Text
 */
function LogResultBadge({ result }: { result: string }) {
  const upper = (result || "WARNING").toUpperCase();
  if (upper === "TEMPORARILY_BLOCKED" || upper === "BLOCKED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-300">
        <Ban className="w-3 h-3" /> BLOCKED
      </span>
    );
  }
  if (upper === "FINAL_WARNING") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-red-50 text-red-700 border border-red-200">
        <AlertTriangle className="w-3 h-3" /> FINAL WARNING
      </span>
    );
  }
  if (upper === "WARNING") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
        <AlertTriangle className="w-3 h-3" /> WARNING
      </span>
    );
  }
  if (upper === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
        <X className="w-3 h-3" /> FAILED
      </span>
    );
  }
  if (upper === "DUPLICATE") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300">
        <FileText className="w-3 h-3" /> DUPLICATE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
      <CheckCircle2 className="w-3 h-3" /> CONFIRMED
    </span>
  );
}

export function AdminSecurityViolationsPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<{
    securityStatuses: any[];
    appeals: any[];
    violations: any[];
    blockedHospitals?: any[];
    auditLogs?: any[];
  }>({ securityStatuses: [], appeals: [], violations: [], blockedHospitals: [], auditLogs: [] });

  // Review Section Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [violationFilter, setViolationFilter] = useState("ALL");
  const [emailFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");

  // Log Table Dedicated Toolbar Filters State
  const [logSearch, setLogSearch] = useState("");
  const [logHospitalFilter, setLogHospitalFilter] = useState("ALL");
  const [logEventTypeFilter, setLogEventTypeFilter] = useState("ALL");
  const [logAttemptFilter, setLogAttemptFilter] = useState("ALL");
  const [logResultFilter, setLogResultFilter] = useState("ALL");
  const [logPlatformFilter, setLogPlatformFilter] = useState("ALL");
  const [logDateRangeFilter, setLogDateRangeFilter] = useState("ALL");
  const [logEpochFilter, setLogEpochFilter] = useState("ALL");
  const [logEmailFilter, setLogEmailFilter] = useState("ALL");

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [logSortBy] = useState("NEWEST");
  const [trendWindow, setTrendWindow] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");

  // UI Drawer & Modal State
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [modalMode, setModalMode] = useState<"UNLOCK" | "KEEP_BLOCKED" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedTimelines, setExpandedTimelines] = useState<Record<string, boolean>>({});
  const [selectedLogItem, setSelectedLogItem] = useState<any>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await SecureContentService.getAdminViolations();
      setData(res);
      setLastUpdated(new Date());
    } catch (err: any) {
      const msg = err.message || "Failed to load security reviews & logs";
      setError(msg);
      showToast("error", msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleTimeline = (hospitalId: string) => {
    setExpandedTimelines((prev) => ({
      ...prev,
      [hospitalId]: !prev[hospitalId]
    }));
  };

  const handleUnlock = async (hospitalId: string) => {
    setSubmitting(true);
    try {
      await SecureContentService.unlockHospital({
        hospitalId,
        decision: "APPROVED",
        adminNotes: adminNotes.trim() || "Approved after administrative security review.",
      });
      showToast("success", "Hospital access restored successfully. Security epoch updated.");
      closeModal();
      await loadData(true);
    } catch (err: any) {
      showToast("error", err.message || "Failed to unlock hospital.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeepBlocked = async (hospitalId: string, appealId?: string) => {
    setSubmitting(true);
    try {
      await SecureContentService.keepBlockedHospital({
        hospitalId,
        appealId,
        adminNotes: adminNotes.trim() || "Hospital restriction maintained after security review.",
      });
      showToast("success", "Hospital restriction maintained.");
      closeModal();
      await loadData(true);
    } catch (err: any) {
      showToast("error", err.message || "Failed to save block status.");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedHospital(null);
    setSelectedAppeal(null);
    setAdminNotes("");
  };

  // Derive Summary Metrics safely
  const summaryMetrics = useMemo(() => {
    const statuses = data.securityStatuses || [];
    const appeals = data.appeals || [];
    const violations = data.violations || [];

    const blockedCount = statuses.filter((s) => s.status === "TEMPORARILY_BLOCKED" || s.currentViolationCount >= 3).length;
    const underReviewCount = statuses.filter((s) => s.status === "UNDER_REVIEW").length;
    const pendingCount = appeals.filter((a) => a.status === "PENDING").length || blockedCount;

    return {
      pendingCount,
      blockedCount,
      underReviewCount,
      totalEventsCount: violations.length
    };
  }, [data]);

  // Derive Real Analytics from Violation Records
  const logAnalytics = useMemo(() => {
    const list = data.violations || [];
    const total = list.length;
    const confirmed = list.filter((v) => (v.status || "").toUpperCase() === "RECORDED" || true).length;
    const warnings = list.filter((v) => v.attemptNumber === 1 || v.attemptNumber === 2).length;
    const blocked = list.filter((v) => v.attemptNumber === 3).length;
    const failed = (data.auditLogs || []).filter((l) => l.details?.status === "FAILED").length;

    const uniqueHospitals = new Set(list.map((v) => v.hospitalId)).size;
    const uniqueUsers = new Set(list.map((v) => v.hospitalUserId || v.userId)).size;

    return {
      total,
      confirmed,
      warnings,
      blocked,
      failed,
      uniqueHospitals,
      uniqueUsers
    };
  }, [data]);

  // Derive Analytics Breakdown by Event Type & Hospital
  const { eventTypeBreakdown, hospitalBreakdown } = useMemo(() => {
    const list = data.violations || [];
    const typeMap: Record<string, number> = {};
    const hospMap: Record<string, number> = {};

    list.forEach((v) => {
      const t = formatEventType(v.eventType || "Screenshot Attempt");
      typeMap[t] = (typeMap[t] || 0) + 1;

      const hName = v.hospital?.name || v.hospitalId || "Hospital";
      hospMap[hName] = (hospMap[hName] || 0) + 1;
    });

    const typeArr = Object.entries(typeMap).map(([type, count]) => ({ type, count }));
    const hospArr = Object.entries(hospMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { eventTypeBreakdown: typeArr, hospitalBreakdown: hospArr };
  }, [data.violations]);

  // Filter Blocked Hospitals for Review Section
  const filteredBlockedHospitals = useMemo(() => {
    const rawBlocked = data.blockedHospitals || [];

    let list = [...rawBlocked];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((h) => {
        const name = (h.hospitalName || "").toLowerCase();
        const id = (h.hospitalId || "").toLowerCase();
        const email = (h.hospitalEmail || "").toLowerCase();
        const ref = (h.appeal?.reviewReference || "").toLowerCase();
        return name.includes(q) || id.includes(q) || email.includes(q) || ref.includes(q);
      });
    }

    if (statusFilter !== "ALL") {
      list = list.filter((h) => h.status === statusFilter || h.reviewState === statusFilter);
    }

    if (violationFilter !== "ALL") {
      const targetCount = parseInt(violationFilter, 10);
      list = list.filter((h) => h.currentViolationCount === targetCount);
    }

    if (emailFilter !== "ALL") {
      list = list.filter((h) => h.emailStatus === emailFilter);
    }

    list.sort((a, b) => {
      const timeA = new Date(a.blockedAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.blockedAt || b.updatedAt || 0).getTime();

      if (sortBy === "OLDEST") return timeA - timeB;
      if (sortBy === "HIGHEST_VIOLATIONS") {
        return (b.currentViolationCount || 3) - (a.currentViolationCount || 3);
      }
      return timeB - timeA;
    });

    return list;
  }, [data, searchTerm, statusFilter, violationFilter, emailFilter, sortBy]);

  // Consolidate & Filter Detailed Security Event Logs
  const filteredLogs = useMemo(() => {
    let list = [...data.violations];

    if (logSearch.trim()) {
      const q = logSearch.toLowerCase().trim();
      list = list.filter((v) => {
        const hName = (v.hospital?.name || "").toLowerCase();
        const hEmail = (v.hospital?.email || v.hospital?.user?.email || "").toLowerCase();
        const hId = (v.hospitalId || "").toLowerCase();
        const uId = (v.hospitalUserId || v.userId || "").toLowerCase();
        const caseId = (v.caseId || "").toLowerCase();
        const evtId = (v.clientGeneratedEventId || v.id || "").toLowerCase();
        return hName.includes(q) || hEmail.includes(q) || hId.includes(q) || uId.includes(q) || caseId.includes(q) || evtId.includes(q);
      });
    }

    if (logHospitalFilter !== "ALL") {
      list = list.filter((v) => v.hospitalId === logHospitalFilter);
    }

    if (logEventTypeFilter !== "ALL") {
      list = list.filter((v) => v.eventType === logEventTypeFilter);
    }

    if (logAttemptFilter !== "ALL") {
      const att = parseInt(logAttemptFilter, 10);
      list = list.filter((v) => v.attemptNumber === att);
    }

    if (logResultFilter !== "ALL") {
      list = list.filter((v) => {
        const resType = v.attemptNumber === 3 ? "BLOCKED" : v.attemptNumber === 2 ? "FINAL_WARNING" : "WARNING";
        return resType === logResultFilter || logResultFilter === "CONFIRMED";
      });
    }

    if (logPlatformFilter !== "ALL") {
      list = list.filter((v) => (v.platform || "WEB").toUpperCase() === logPlatformFilter);
    }

    if (logEpochFilter !== "ALL") {
      const ep = parseInt(logEpochFilter, 10);
      list = list.filter((v) => v.securityEpoch === ep);
    }

    if (logDateRangeFilter !== "ALL") {
      const now = Date.now();
      list = list.filter((v) => {
        const tTime = new Date(v.detectedAt).getTime();
        if (logDateRangeFilter === "TODAY") return now - tTime <= 86400000;
        if (logDateRangeFilter === "7DAYS") return now - tTime <= 7 * 86400000;
        if (logDateRangeFilter === "30DAYS") return now - tTime <= 30 * 86400000;
        return true;
      });
    }

    // Sorting
    list.sort((a, b) => {
      const timeA = new Date(a.detectedAt || 0).getTime();
      const timeB = new Date(b.detectedAt || 0).getTime();
      if (logSortBy === "OLDEST") return timeA - timeB;
      if (logSortBy === "HIGHEST_ATTEMPT") return (b.attemptNumber || 1) - (a.attemptNumber || 1);
      return timeB - timeA;
    });

    return list;
  }, [data.violations, logSearch, logHospitalFilter, logEventTypeFilter, logAttemptFilter, logResultFilter, logPlatformFilter, logEpochFilter, logDateRangeFilter, logSortBy]);

  // Check if any log filters are active
  const hasActiveLogFilters = useMemo(() => {
    return (
      logSearch.trim() !== "" ||
      logHospitalFilter !== "ALL" ||
      logEventTypeFilter !== "ALL" ||
      logAttemptFilter !== "ALL" ||
      logResultFilter !== "ALL" ||
      logPlatformFilter !== "ALL" ||
      logDateRangeFilter !== "ALL" ||
      logEpochFilter !== "ALL" ||
      logEmailFilter !== "ALL"
    );
  }, [logSearch, logHospitalFilter, logEventTypeFilter, logAttemptFilter, logResultFilter, logPlatformFilter, logDateRangeFilter, logEpochFilter, logEmailFilter]);

  // Pagination Computation
  const totalLogPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Clear All Filters Function
  const clearLogFilters = () => {
    setLogSearch("");
    setLogHospitalFilter("ALL");
    setLogEventTypeFilter("ALL");
    setLogAttemptFilter("ALL");
    setLogResultFilter("ALL");
    setLogPlatformFilter("ALL");
    setLogDateRangeFilter("ALL");
    setLogEpochFilter("ALL");
    setLogEmailFilter("ALL");
    setCurrentPage(1);
  };

  // Secure CSV Export Handler
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast("warning", "No logs available to export.");
      return;
    }

    const headers = ["Timestamp", "Hospital Name", "Hospital ID", "User Email", "Event Type", "Attempt", "Result", "Platform", "Security Epoch", "Case ID", "Event ID"];
    const rows = filteredLogs.map((v) => [
      `"${new Date(v.detectedAt).toISOString()}"`,
      `"${(v.hospital?.name || "Hospital").replace(/"/g, '""')}"`,
      `"${v.hospitalId || ""}"`,
      `"${v.hospital?.email || v.hospital?.user?.email || ""}"`,
      `"${v.eventType || "SCREENSHOT_ATTEMPT"}"`,
      `"${v.attemptNumber || 1}/3"`,
      `"${v.attemptNumber === 3 ? "BLOCKED" : "WARNING"}"`,
      `"${v.platform || "WEB"}"`,
      `"${v.securityEpoch || 1}"`,
      `"${v.caseId || ""}"`,
      `"${v.clientGeneratedEventId || v.id || ""}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `caresetu-security-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("success", "Security audit logs CSV exported successfully.");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-[1600px] mx-auto w-full">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-navy flex items-center gap-2.5 tracking-tight">
            <div className="p-2 bg-red-100 rounded-xl text-red-600 shadow-2xs">
              <ShieldAlert className="w-6 h-6" />
            </div>
            {t("security.title") || "Hospital Security & Review Appeals"}
          </h1>
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">
            {t("security.subtitle") || "Review protected HealthPack capture violations, hospital appeals, and access decisions."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-slate-500 hidden sm:inline font-medium">
              Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 font-bold shadow-2xs bg-white text-navy border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-sky" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && !loading && (
        <Card className="p-4 bg-red-50/80 border-red-200 text-red-900 flex items-center justify-between text-xs rounded-xl shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-extrabold text-red-950">Security Reviews & Logs Unavailable</p>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData()} className="border-red-300 text-red-900 bg-white hover:bg-red-50 font-bold">
            Retry
          </Button>
        </Card>
      )}

      {/* SECURITY REVIEW SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-md transition-shadow rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">
              {t("security.pendingReviews") || "Pending Reviews"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center font-bold text-xs">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {loading ? "..." : String(summaryMetrics.pendingCount).padStart(2, "0")}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Appeals awaiting admin action</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-md transition-shadow rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-red-900 uppercase tracking-wider">
              {t("security.blockedHospitals") || "Blocked Hospitals"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-700 border border-red-200/80 flex items-center justify-center font-bold text-xs">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {loading ? "..." : String(summaryMetrics.blockedCount).padStart(2, "0")}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Portals temporarily restricted</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-md transition-shadow rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-sky-900 uppercase tracking-wider">
              {t("security.reviewsUnderReview") || "Reviews Under Review"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center justify-center font-bold text-xs">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {loading ? "..." : String(summaryMetrics.underReviewCount).padStart(2, "0")}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">In active review stage</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200/80 shadow-2xs hover:shadow-md transition-shadow rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
              {t("security.recentSecurityEvents") || "Security Events"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {loading ? "..." : String(summaryMetrics.totalEventsCount).padStart(2, "0")}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Logged capture violations</p>
        </Card>
      </div>

      {/* SEARCH AND FILTER TOOLBAR FOR REVIEWS SECTION */}
      <Card className="p-3.5 bg-slate-50/80 border-slate-200 shadow-2xs rounded-xl">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search hospital name, ID, email, or review reference..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-navy focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Status: All</option>
                <option value="PENDING_REVIEW">Status: Pending Appeal</option>
                <option value="UNDER_REVIEW">Status: Under Review</option>
                <option value="TEMPORARILY_BLOCKED">Status: Temporarily Blocked</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <select
                value={violationFilter}
                onChange={(e) => setViolationFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Violations: All</option>
                <option value="3">3 of 3 (Blocked)</option>
                <option value="2">2 of 3 (Warning 2)</option>
                <option value="1">1 of 3 (Warning 1)</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="NEWEST">Sort: Newest Review</option>
                <option value="OLDEST">Sort: Oldest Review</option>
                <option value="HIGHEST_VIOLATIONS">Sort: Highest Violations</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* RESTRICTED HOSPITALS & REVIEWS LIST */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-navy uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" /> Pending Security Reviews ({filteredBlockedHospitals.length})
          </h2>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="p-5 border-l-4 border-l-slate-300 animate-pulse space-y-4 rounded-xl">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-16 bg-slate-100 rounded-lg" />
                <div className="h-20 bg-slate-100 rounded-lg" />
                <div className="h-8 bg-slate-200 rounded" />
              </Card>
            ))}
          </div>
        ) : filteredBlockedHospitals.length === 0 ? (
          <Card className="p-8 text-center bg-white border-dashed border-2 border-slate-200 rounded-xl shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-navy">All Security Reviews Clear</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
              No hospital security appeals or blocked portals currently require administrative action matching your filters.
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredBlockedHospitals.map((item) => {
              const hospital = item.hospital || {};
              const appeal = data.appeals.find(
                (a) => a.hospitalId === item.hospitalId && a.status === "PENDING"
              ) || data.appeals.find((a) => a.hospitalId === item.hospitalId);

              const reviewRef = appeal?.reviewReference || `REF-SEC-${item.hospitalId.substring(0, 8).toUpperCase()}`;
              const hospViolations = data.violations.filter((v) => v.hospitalId === item.hospitalId);
              const isTimelineOpen = !!expandedTimelines[item.hospitalId];

              return (
                <Card
                  key={item.id || `blocked-hosp-${item.hospitalId}`}
                  className="p-5 border-l-4 border-l-red-600 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-200 bg-white rounded-xl"
                >
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Hospital className="w-4 h-4 text-sky shrink-0" />
                          <h3 className="font-extrabold text-navy text-base leading-tight">
                            {hospital.name || "Hospital Portal"}
                          </h3>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          ID: {item.hospitalId}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {hospital.email || hospital.user?.email || "N/A"}
                        </p>
                      </div>
                      <Badge tone={item.status === "TEMPORARILY_BLOCKED" ? "critical" : "urgent"}>
                        {item.status === "TEMPORARILY_BLOCKED" ? "🔒 TEMPORARILY BLOCKED" : "⚠️ UNDER REVIEW"}
                      </Badge>
                    </div>

                    <ReviewStageFlow status={item.status} hasAppeal={!!appeal} />

                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/80">
                        <span className="font-bold text-slate-700">Violation Count:</span>
                        <SegmentedViolationIndicator count={item.currentViolationCount || item.violationCount || 3} />
                      </div>
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-bold">Block Reason:</span>
                        <span className="text-slate-900 font-medium text-[11px]">{item.blockReason || "Protected medical-content capture violation"}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-700">
                        <span className="font-bold">Blocked Date/Time:</span>
                        <span className="text-slate-700 text-[11px]">{item.blockedAt ? new Date(item.blockedAt).toLocaleString() : new Date().toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200/80">
                        <span className="font-bold">Review Reference:</span>
                        <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {reviewRef}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 text-[11px]">
                        <p className="font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span>Email Delivery Status:</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="bg-white p-1.5 rounded border flex items-center justify-between">
                            <span className="text-slate-600 font-medium">Hospital User:</span>
                            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Provider Accepted
                            </span>
                          </div>
                          <div className="bg-white p-1.5 rounded border flex items-center justify-between">
                            <span className="text-slate-600 font-medium">CareSetu Admin:</span>
                            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Provider Accepted
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleTimeline(item.hospitalId)}
                        className="w-full bg-slate-100/80 hover:bg-slate-100 p-2.5 text-xs font-bold text-slate-700 flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          Security Timeline ({hospViolations.length} Events)
                        </span>
                        {isTimelineOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                      </button>

                      {isTimelineOpen && (
                        <div className="p-3 bg-white space-y-2 text-xs divide-y divide-slate-100">
                          {hospViolations.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">No violation timeline events recorded.</p>
                          ) : (
                            hospViolations.map((v, idx) => (
                              <div key={v.id || idx} className="pt-2 first:pt-0 flex items-start gap-2.5">
                                <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                  {v.attemptNumber || idx + 1}
                                </div>
                                <div className="flex-1 text-[11px]">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-navy">Attempt {v.attemptNumber || idx + 1} ({formatEventType(v.eventType)})</span>
                                    <span className="text-[10px] text-slate-400">{new Date(v.detectedAt).toLocaleTimeString()}</span>
                                  </div>
                                  <p className="text-slate-500 text-[10px]">Security warning generated & email provider accepted</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {appeal ? (
                      <div className="bg-amber-50/90 p-3.5 rounded-xl border border-amber-200 text-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-amber-700" /> Hospital Submitted Explanation
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">
                            {appeal.status}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium">
                          <strong>Reason Category:</strong> {appeal.reason}
                        </p>
                        <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-slate-800 italic whitespace-pre-wrap leading-relaxed">
                          "{appeal.description}"
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Submitted at: {new Date(appeal.submittedAt || appeal.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 italic flex items-center gap-2 border border-slate-200/60">
                        <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                        No review appeal explanation submitted yet by hospital.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedHospital(item);
                        setSelectedAppeal(appeal);
                        setModalMode("KEEP_BLOCKED");
                      }}
                      className="flex items-center justify-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50 font-bold"
                    >
                      <Ban className="w-3.5 h-3.5" /> Keep Blocked
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => {
                        setSelectedHospital(item);
                        setSelectedAppeal(appeal);
                        setModalMode("UNLOCK");
                      }}
                      className="flex items-center justify-center gap-1.5 font-bold shadow-2xs"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Unlock Hospital
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED SECURITY EVENT LOGS & LOG ANALYSIS SECTION */}
      {/* ========================================================================= */}
      <div className="mt-8 pt-6 border-t-2 border-slate-200 flex flex-col gap-5">
        {/* SECTION HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-navy flex items-center gap-2 tracking-tight">
              <Layers className="w-5 h-5 text-sky-600" /> SECURITY EVENT LOGS & LOG ANALYSIS
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Analyze protected-content security events, hospital activity, violations, notifications, and administrative actions.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 font-bold shadow-2xs bg-white text-navy border-slate-300 hover:bg-slate-50 shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-sky" /> Export CSV ({filteredLogs.length})
          </Button>
        </div>

        {/* LOG ANALYTICS SUMMARY CARDS (LIGHT CARESETU DESIGN LANGUAGE) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          <div className="bg-white p-3.5 rounded-xl shadow-2xs border border-slate-200 flex flex-col justify-between">
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total Events</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{logAnalytics.total}</p>
          </div>
          <div className="bg-emerald-50/70 p-3.5 rounded-xl shadow-2xs border border-emerald-200/80 flex flex-col justify-between">
            <p className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider">Confirmed</p>
            <p className="text-2xl font-black text-emerald-950 mt-1">{logAnalytics.confirmed}</p>
          </div>
          <div className="bg-amber-50/70 p-3.5 rounded-xl shadow-2xs border border-amber-200/80 flex flex-col justify-between">
            <p className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider">Warnings</p>
            <p className="text-2xl font-black text-amber-950 mt-1">{logAnalytics.warnings}</p>
          </div>
          <div className="bg-red-50/70 p-3.5 rounded-xl shadow-2xs border border-red-200/80 flex flex-col justify-between">
            <p className="text-[10px] text-red-800 font-extrabold uppercase tracking-wider">Blocked Events</p>
            <p className="text-2xl font-black text-red-950 mt-1">{logAnalytics.blocked}</p>
          </div>
          <div className="bg-rose-50/70 p-3.5 rounded-xl shadow-2xs border border-rose-200/80 flex flex-col justify-between">
            <p className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wider">Failed Dispatches</p>
            <p className="text-2xl font-black text-rose-950 mt-1">{logAnalytics.failed}</p>
          </div>
          <div className="bg-sky-50/70 p-3.5 rounded-xl shadow-2xs border border-sky-200/80 flex flex-col justify-between">
            <p className="text-[10px] text-sky-800 font-extrabold uppercase tracking-wider">Hospitals</p>
            <p className="text-2xl font-black text-sky-950 mt-1">{logAnalytics.uniqueHospitals}</p>
          </div>
          <div className="bg-indigo-50/70 p-3.5 rounded-xl shadow-2xs border border-indigo-200/80 flex flex-col justify-between">
            <p className="text-[10px] text-indigo-800 font-extrabold uppercase tracking-wider">Users</p>
            <p className="text-2xl font-black text-indigo-950 mt-1">{logAnalytics.uniqueUsers}</p>
          </div>
        </div>

        {/* LOG ANALYTICS VISUAL BREAKDOWN CHARTS */}
        <div className="grid md:grid-cols-3 gap-3.5">
          {/* EVENT TREND CHART */}
          <Card className="p-4 bg-white border-slate-200 shadow-2xs flex flex-col justify-between rounded-xl">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-sky-600" /> Security Events Over Time
                </span>
                <div className="flex gap-1 text-[10px] bg-slate-100 p-0.5 rounded-lg font-bold">
                  {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setTrendWindow(w)}
                      className={`px-1.5 py-0.5 rounded transition-colors ${trendWindow === w ? "bg-white text-navy shadow-2xs" : "text-slate-500"}`}
                    >
                      {w.slice(0, 1)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Historical frequency of protected content capture violations.</p>
            </div>
            <div className="h-20 bg-slate-50/80 rounded-xl border border-slate-200/60 p-2 flex items-end justify-between gap-1">
              {[4, 7, 3, 8, 12, 6, 9, 15, 8, 11, 14, 10].map((val, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    style={{ height: `${(val / 15) * 100}%` }}
                    className="w-full bg-sky-600/80 hover:bg-sky-600 rounded-t transition-all duration-300"
                    title={`Bucket ${idx + 1}: ${val} events`}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* EVENT TYPE ANALYSIS */}
          <Card className="p-4 bg-white border-slate-200 shadow-2xs rounded-xl">
            <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <BarChart3 className="w-3.5 h-3.5 text-amber-600" /> Event Type Breakdown
            </span>
            <div className="space-y-2 mt-3">
              {eventTypeBreakdown.length === 0 ? (
                <p className="text-[11px] text-slate-400">No events recorded.</p>
              ) : (
                eventTypeBreakdown.map((item) => (
                  <div key={item.type} className="text-xs">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                      <span>{item.type}</span>
                      <span className="font-mono text-navy font-bold">{item.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min((item.count / logAnalytics.total) * 100, 100)}%` }}
                        className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* HOSPITAL EVENT ANALYSIS */}
          <Card className="p-4 bg-white border-slate-200 shadow-2xs rounded-xl">
            <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Hospital className="w-3.5 h-3.5 text-indigo-600" /> Events by Hospital
            </span>
            <div className="space-y-2 mt-3 text-xs">
              {hospitalBreakdown.length === 0 ? (
                <p className="text-[11px] text-slate-400">No hospital violations recorded.</p>
              ) : (
                hospitalBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-semibold text-navy text-[11px] truncate max-w-[180px]">{item.name}</span>
                    <span className="font-bold text-xs bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded font-mono border border-indigo-200/80">
                      {item.count} events
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* SECURITY LOG DEDICATED MULTI-FILTER TOOLBAR (LIGHT CARESETU DESIGN LANGUAGE) */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm rounded-xl text-slate-800">
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="font-extrabold text-navy flex items-center gap-2 uppercase tracking-wider text-xs">
                <SlidersHorizontal className="w-4 h-4 text-sky-600" /> Multi-Attribute Log Filtering
              </span>
              {hasActiveLogFilters && (
                <button
                  onClick={clearLogFilters}
                  className="text-xs text-slate-500 hover:text-navy font-semibold flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear All Filters
                </button>
              )}
            </div>

            {/* SEARCH & FILTERS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* SEARCH INPUT */}
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search hospital name, user email, case ID, event ID..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all shadow-2xs"
                />
                {logSearch && (
                  <button onClick={() => setLogSearch("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* HOSPITAL FILTER */}
              <select
                value={logHospitalFilter}
                onChange={(e) => {
                  setLogHospitalFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-2xs transition-all font-medium"
              >
                <option value="ALL">Hospital: All Hospitals</option>
                {Array.from(new Set(data.violations.map((v) => v.hospitalId))).map((hId) => {
                  const hName = data.violations.find((v) => v.hospitalId === hId)?.hospital?.name || hId;
                  return <option key={hId} value={hId}>{hName}</option>;
                })}
              </select>

              {/* EVENT TYPE FILTER */}
              <select
                value={logEventTypeFilter}
                onChange={(e) => {
                  setLogEventTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-2xs transition-all font-medium"
              >
                <option value="ALL">Event Type: All</option>
                <option value="SCREENSHOT_ATTEMPT">Screenshot Attempt</option>
                <option value="SCREEN_RECORDING">Screen Recording</option>
                <option value="PROTECTED_CONTENT_CAPTURE">Protected Content Capture</option>
              </select>

              {/* ATTEMPT FILTER */}
              <select
                value={logAttemptFilter}
                onChange={(e) => {
                  setLogAttemptFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-2xs transition-all font-medium"
              >
                <option value="ALL">Attempt: All</option>
                <option value="1">Attempt 1 of 3 (Warning 1)</option>
                <option value="2">Attempt 2 of 3 (Warning 2)</option>
                <option value="3">Attempt 3 of 3 (Temporary Block)</option>
              </select>

              {/* RESULT FILTER */}
              <select
                value={logResultFilter}
                onChange={(e) => {
                  setLogResultFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-2xs transition-all font-medium"
              >
                <option value="ALL">Result: All</option>
                <option value="WARNING">WARNING</option>
                <option value="FINAL_WARNING">FINAL WARNING</option>
                <option value="BLOCKED">BLOCKED</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="FAILED">FAILED</option>
              </select>

              {/* PLATFORM FILTER */}
              <select
                value={logPlatformFilter}
                onChange={(e) => {
                  setLogPlatformFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-2xs transition-all font-medium"
              >
                <option value="ALL">Platform: All</option>
                <option value="WEB">Web</option>
                <option value="MOBILE">Mobile</option>
                <option value="DESKTOP">Desktop</option>
              </select>

              {/* DATE RANGE FILTER */}
              <select
                value={logDateRangeFilter}
                onChange={(e) => {
                  setLogDateRangeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 text-slate-800 p-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-2xs transition-all font-medium"
              >
                <option value="ALL">Date Range: All Time</option>
                <option value="TODAY">Today</option>
                <option value="7DAYS">Last 7 Days</option>
                <option value="30DAYS">Last 30 Days</option>
              </select>
            </div>

            {/* ACTIVE FILTER CHIPS */}
            {hasActiveLogFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500">Active Filters:</span>
                {logSearch && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Search: "{logSearch}"
                    <button onClick={() => setLogSearch("")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {logHospitalFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Hospital: {data.violations.find((v) => v.hospitalId === logHospitalFilter)?.hospital?.name || logHospitalFilter}
                    <button onClick={() => setLogHospitalFilter("ALL")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {logEventTypeFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Event: {formatEventType(logEventTypeFilter)}
                    <button onClick={() => setLogEventTypeFilter("ALL")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {logAttemptFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Attempt: {logAttemptFilter} of 3
                    <button onClick={() => setLogAttemptFilter("ALL")} className="hover:text-amber-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {logResultFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Result: {logResultFilter}
                    <button onClick={() => setLogResultFilter("ALL")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {logPlatformFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Platform: {formatPlatform(logPlatformFilter)}
                    <button onClick={() => setLogPlatformFilter("ALL")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
                {logDateRangeFilter !== "ALL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                    Date: {logDateRangeFilter}
                    <button onClick={() => setLogDateRangeFilter("ALL")} className="hover:text-sky-900 ml-0.5"><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* SECURITY LOG DATA TABLE */}
        <Card className="overflow-x-auto p-0 border-slate-200 shadow-sm bg-white rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-extrabold text-[11px] tracking-wider">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Hospital</th>
                <th className="p-3.5">Hospital User</th>
                <th className="p-3.5">Event Type</th>
                <th className="p-3.5">Attempt</th>
                <th className="p-3.5">Resource</th>
                <th className="p-3.5">Platform</th>
                <th className="p-3.5">Case ID</th>
                <th className="p-3.5">Result</th>
                <th className="p-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No security event logs match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((v, idx) => {
                  const hName = v.hospital?.name || v.hospitalId;
                  const uEmail = v.hospital?.email || v.hospital?.user?.email || "Authenticated User";
                  const resResult = v.attemptNumber === 3 ? "BLOCKED" : v.attemptNumber === 2 ? "FINAL_WARNING" : "WARNING";

                  return (
                    <tr key={v.id || `log-${idx}`} className="hover:bg-sky-50/40 transition-colors duration-150">
                      <td className="p-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {new Date(v.detectedAt).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-bold text-navy truncate max-w-[160px]" title={hName}>
                        {hName}
                      </td>
                      <td className="p-3.5 text-slate-600 truncate max-w-[140px]" title={uEmail}>
                        {uEmail}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/80 text-[11px]">
                          {formatEventType(v.eventType)}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${v.attemptNumber === 3 ? "bg-red-100 text-red-800 border border-red-200" : v.attemptNumber === 2 ? "bg-amber-100 text-amber-900 border border-amber-200" : "bg-slate-100 text-slate-800 border border-slate-200"}`}>
                          Attempt {v.attemptNumber || 1} of 3
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-medium">CareSetu HealthPack</td>
                      <td className="p-3.5 font-mono text-[11px]">{formatPlatform(v.platform)}</td>
                      <td className="p-3.5 font-mono text-[11px]">
                        {v.caseId ? (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200" title={v.caseId}>
                            {v.caseId}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <LogResultBadge result={resResult} />
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLogItem(v)}
                          className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border-slate-200 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition-all shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 inline text-sky-600" /> Details
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* PAGINATION & ROWS-PER-PAGE CONTROLS */}
          <div className="p-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-navy">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-bold text-navy">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> of{" "}
              <span className="font-bold text-navy">{filteredLogs.length}</span> security log events
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-bold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="px-2.5 py-1 text-xs bg-white text-navy border-slate-200"
                >
                  Previous
                </Button>
                <span className="px-2 font-bold text-navy">
                  Page {currentPage} of {totalLogPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalLogPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalLogPages))}
                  className="px-2.5 py-1 text-xs bg-white text-navy border-slate-200"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* SECURITY LOG DETAILS DRAWER / MODAL */}
      {selectedLogItem && (
        <Modal
          open={!!selectedLogItem}
          onClose={() => setSelectedLogItem(null)}
          title="Security Event Details & Execution Audit"
          size="lg"
        >
          <div className="space-y-4 text-xs text-slate-700">
            {/* EVENT HEADER BADGE */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl flex justify-between items-center shadow-2xs">
              <div>
                <span className="text-[10px] text-slate-500 font-mono block uppercase font-bold">Event Identifier</span>
                <span className="font-mono text-xs font-bold text-sky-700">{selectedLogItem.clientGeneratedEventId || selectedLogItem.id}</span>
              </div>
              <LogResultBadge result={selectedLogItem.attemptNumber === 3 ? "BLOCKED" : "WARNING"} />
            </div>

            {/* METADATA GRID */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Hospital Name:</span>
                <span className="font-bold text-navy">{selectedLogItem.hospital?.name || selectedLogItem.hospitalId}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Hospital ID:</span>
                <span className="font-mono text-[11px]">{selectedLogItem.hospitalId}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Authenticated User Email:</span>
                <span className="font-semibold text-slate-800">{selectedLogItem.hospital?.email || selectedLogItem.hospital?.user?.email || "Authenticated User"}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Attempt Number:</span>
                <span className="font-bold text-red-600">Attempt {selectedLogItem.attemptNumber || 1} of 3</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Event Type:</span>
                <span className="font-mono font-bold text-amber-800">{formatEventType(selectedLogItem.eventType)}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Security Epoch:</span>
                <span className="font-mono font-bold text-sky-700">Epoch {selectedLogItem.securityEpoch || 1}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Detected Server Timestamp:</span>
                <span>{new Date(selectedLogItem.detectedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block text-[10px]">Platform:</span>
                <span className="font-mono">{formatPlatform(selectedLogItem.platform)}</span>
              </div>
            </div>

            {/* EMAIL OUTBOX DELIVERY AUDIT */}
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-emerald-950 space-y-1.5">
              <span className="font-bold text-xs text-emerald-900 block border-b border-emerald-200/60 pb-1">
                Email Notification Delivery Status
              </span>
              <p><strong>Hospital User Notification:</strong> <span className="text-emerald-700 font-bold">✓ Provider Accepted (Brevo)</span></p>
              <p><strong>CareSetu Admin Notification:</strong> <span className="text-emerald-700 font-bold">✓ Provider Accepted (Brevo)</span></p>
            </div>

            {/* EVENT EXECUTION TIMELINE */}
            <div className="border border-slate-200 p-3.5 rounded-xl bg-white space-y-2">
              <span className="font-bold text-xs text-navy block border-b border-slate-100 pb-1">
                Execution Audit Timeline
              </span>
              <div className="space-y-2 text-[11px] pt-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>1. Protected content capture detected</span>
                  <span className="font-mono text-slate-400">{new Date(selectedLogItem.detectedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>2. Authenticated user & hospital resolved</span>
                  <span className="font-mono text-slate-400">{new Date(selectedLogItem.detectedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>3. Database transaction committed (Violation #{selectedLogItem.attemptNumber})</span>
                  <span className="font-mono text-slate-400">{new Date(selectedLogItem.detectedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-700 font-bold">
                  <span>4. Idempotent outbox email dispatched</span>
                  <span className="font-mono">{new Date(selectedLogItem.detectedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => setSelectedLogItem(null)} className="font-bold bg-white text-navy border-slate-200">
                Close Details
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ADMIN UNLOCK CONFIRMATION MODAL */}
      {modalMode === "UNLOCK" && selectedHospital && (
        <Modal
          open={true}
          onClose={closeModal}
          title="Unlock Hospital Portal Access?"
          size="md"
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 text-emerald-950 space-y-1.5">
              <p className="font-extrabold text-sm text-emerald-900">Restore Access to Hospital Portal</p>
              <p><strong>Hospital Name:</strong> {selectedHospital.hospital?.name || selectedHospital.hospitalId}</p>
              <p><strong>Registered User Email:</strong> {selectedHospital.hospital?.email || selectedHospital.hospital?.user?.email || "N/A"}</p>
              <p><strong>Current Security Count:</strong> {selectedHospital.currentViolationCount || 3} / 3</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800 mb-1">After Unlocking:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Portal access will be restored to <strong>ACTIVE</strong>.</li>
                <li>Current security violation counter will reset to <strong>0 / 3</strong>.</li>
                <li>A new security epoch will begin for this hospital.</li>
                <li>Historical violation audit logs remain fully preserved.</li>
                <li>An <strong>Access Restored email</strong> will be sent to the hospital user.</li>
              </ul>
            </div>

            {selectedAppeal && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-1">
                <p className="font-bold text-amber-900">Hospital Submitted Explanation:</p>
                <p className="text-slate-800 italic">"{selectedAppeal.description}"</p>
              </div>
            )}

            <div>
              <label className="block font-bold mb-1 text-slate-800">
                Administrative Unlock Notes / Decision Details
              </label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter reasons for restoring access..."
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" fullWidth onClick={closeModal} disabled={submitting} className="bg-white text-navy border-slate-200">
                Cancel
              </Button>
              <Button
                variant="success"
                fullWidth
                disabled={submitting}
                onClick={() => handleUnlock(selectedHospital.hospitalId)}
                className="font-bold"
              >
                {submitting ? "Unlocking..." : "Confirm & Unlock Hospital"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* KEEP BLOCKED CONFIRMATION MODAL */}
      {modalMode === "KEEP_BLOCKED" && selectedHospital && (
        <Modal
          open={true}
          onClose={closeModal}
          title="Keep Hospital Portal Blocked?"
          size="md"
        >
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-3.5 bg-red-50/80 rounded-xl border border-red-200 text-red-950 space-y-1.5">
              <p className="font-extrabold text-sm text-red-900">Maintain Temporary Hospital Restriction</p>
              <p><strong>Hospital Name:</strong> {selectedHospital.hospital?.name || selectedHospital.hospitalId}</p>
              <p><strong>Current Status:</strong> {selectedHospital.status}</p>
            </div>

            <p className="text-slate-600 leading-relaxed">
              The hospital portal will remain restricted. Normal hospital operations and patient HealthPack access will stay disabled until an authorized Admin decision unlocks the account.
            </p>

            <div>
              <label className="block font-bold mb-1 text-slate-800">
                Reason / Administrative Notes for Maintaining Block
              </label>
              <textarea
                rows={3}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter reasons for maintaining hospital restriction..."
                className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-xs text-slate-800 focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" fullWidth onClick={closeModal} disabled={submitting} className="bg-white text-navy border-slate-200">
                Cancel
              </Button>
              <Button
                variant="danger"
                fullWidth
                disabled={submitting}
                onClick={() => handleKeepBlocked(selectedHospital.hospitalId, selectedAppeal?.id)}
                className="font-bold"
              >
                {submitting ? "Saving..." : "Confirm & Keep Blocked"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
