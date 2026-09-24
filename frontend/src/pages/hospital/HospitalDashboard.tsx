import { Siren, ClipboardCheck, BedDouble, HeartPulse, Clock, Activity, Wifi, WifiOff, XCircle } from "lucide-react";
import { StatCard, Card } from "../../components/common/Card";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { hospitalApi } from "../../services/api";
import { useSocket } from "../../context/SocketContext";

import { useAuth } from "../../context/AuthContext";
import { RoleStatusBanner } from "../../components/common/RoleStatusBanner";

export default function HospitalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connected } = useSocket();

  const [cases, setCases] = useState<any[]>([]);
  const [myCases, setMyCases] = useState<any[]>([]);
  const [myCasesError, setMyCasesError] = useState(false);
  const [hospVerificationStatus, setHospVerificationStatus] = useState<string>("PENDING_REVIEW");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [showApprovalToast, setShowApprovalToast] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isFetchingRef = useRef(false);
  const backoffUntilRef = useRef<number>(0);

  const loadDashboardData = useCallback(async () => {
    // Only execute hospital API calls for authenticated HOSPITAL users
    if (!user || user.role?.toUpperCase() !== "HOSPITAL") return;
    if (isFetchingRef.current) return;
    if (Date.now() < backoffUntilRef.current) return;

    isFetchingRef.current = true;
    try {
      const [casesRes, statsRes, profRes] = await Promise.all([
        hospitalApi.pendingCases().catch((err: any) => {
          if (err?.status === 429) {
            const delay = (err.retryAfterSeconds || 30) * 1000;
            backoffUntilRef.current = Date.now() + delay;
          }
          return { cases: [] };
        }),
        hospitalApi.getStats().catch((err: any) => {
          if (err?.status === 429) {
            const delay = (err.retryAfterSeconds || 30) * 1000;
            backoffUntilRef.current = Date.now() + delay;
          }
          return { stats: null };
        }),
        hospitalApi.getProfile().catch((err: any) => {
          if (err?.status === 429) {
            const delay = (err.retryAfterSeconds || 30) * 1000;
            backoffUntilRef.current = Date.now() + delay;
          }
          return null;
        }),
      ]);
      setCases(casesRes.cases || []);
      setMyCases(casesRes.cases || []);
      setMyCasesError(false);
      if (statsRes.stats) {
        setStats(statsRes.stats);
      }
      if (profRes?.hospital) {
        setHospVerificationStatus(profRes.hospital.verificationStatus || "PENDING_REVIEW");
        if (profRes.hospital.rejectionReason) {
          setRejectionReason(profRes.hospital.rejectionReason);
        }
      }
    } catch (err) {
      console.error("[HospitalDashboard] Load error:", err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [user]);

  const refetchTimerRef = useRef<number | null>(null);

  const debouncedRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      window.clearTimeout(refetchTimerRef.current);
    }
    refetchTimerRef.current = window.setTimeout(() => {
      loadDashboardData();
    }, 500);
  }, [loadDashboardData]);

  useEffect(() => {
    if (!user || user.role?.toUpperCase() !== "HOSPITAL") return;
    loadDashboardData();

    // Controlled polling: 20s interval (realtime socket provides instant updates)
    const interval = setInterval(debouncedRefetch, 20000);
    return () => {
      clearInterval(interval);
      if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    };
  }, [loadDashboardData, user, debouncedRefetch]);

  // Check one-time approval event on initial mount
  useEffect(() => {
    if (!user || user.role?.toUpperCase() !== "HOSPITAL") return;
    hospitalApi.getApprovalEvent().then((res) => {
      if (res.success && res.hasUnseenApproval && res.eventId) {
        setApprovalMessage(res.message || "Congratulations! Admin has successfully approved your hospital registration. Your hospital portal is now active.");
        setShowApprovalToast(true);

        // Consume event in DB so it is never shown again on refresh/subsequent logins
        hospitalApi.consumeApprovalEvent(res.eventId).catch(() => {});

        // Auto-dismiss after 3 seconds
        const timer = setTimeout(() => {
          setShowApprovalToast(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }).catch(() => {});
  }, [user]);

  // Listen to custom window events triggered by SocketContext on real-time events
  useEffect(() => {
    const handleRefresh = () => {
      debouncedRefetch();
    };

    window.addEventListener("hospital:case:assigned-to-us", handleRefresh);
    window.addEventListener("hospital:case:closed-elsewhere", handleRefresh);
    window.addEventListener("hospital:case:rejected-by-us", handleRefresh);
    window.addEventListener("hospital:capacity-updated", handleRefresh);
    window.addEventListener("case-updated", handleRefresh);

    return () => {
      window.removeEventListener("hospital:case:assigned-to-us", handleRefresh);
      window.removeEventListener("hospital:case:closed-elsewhere", handleRefresh);
      window.removeEventListener("hospital:case:rejected-by-us", handleRefresh);
      window.removeEventListener("hospital:capacity-updated", handleRefresh);
      window.removeEventListener("case-updated", handleRefresh);
    };
  }, [debouncedRefetch]);

  const [processingCaseId, setProcessingCaseId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const getAcceptErrorMessage = (err: any): string => {
    if (err?.status === 401) return "Your session has expired. Please log in again.";
    if (err?.status === 403) return err.message || "You are not authorized to accept this emergency case.";
    if (err?.status === 409) return "This emergency case has already been accepted or is no longer available.";
    if (err?.status === 404) return "Emergency case not found.";
    return err?.message || "Unable to accept the emergency case. Please try again.";
  };

  const handleAccept = async (caseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (processingCaseId) return;
    setProcessingCaseId(caseId);
    setAcceptError(null);
    try {
      await hospitalApi.acceptCase(caseId);
      debouncedRefetch();
    } catch (err: any) {
      setAcceptError(getAcceptErrorMessage(err));
    } finally {
      setProcessingCaseId(null);
    }
  };

  const handleReject = async (caseId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const reason = prompt("Select or type reason (e.g. ICU unavailable):");
    try {
      await hospitalApi.rejectCase(caseId, reason || undefined);
      debouncedRefetch();
    } catch (err: any) {
      setAcceptError(err.message || "Failed to reject case");
    }
  };

  const incoming = cases;
  const [activityPage, setActivityPage] = useState(1);
  const HISTORY_PAGE_SIZE = 8;
  const activity = stats?.recentActivity?.length ? stats.recentActivity : [];
  const totalActivityPages = Math.max(1, Math.ceil(activity.length / HISTORY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, totalActivityPages);
  const visibleActivity = activity.slice(
    (safeActivityPage - 1) * HISTORY_PAGE_SIZE,
    safeActivityPage * HISTORY_PAGE_SIZE
  );
  const activeCases = (myCases || []).filter(
    (c: any) =>
      ["ACCEPTED", "TRANSFER", "TREATMENT", "IN_PROGRESS"].includes(
        String(c.status || "").toUpperCase()
      ) &&
      new Date(c.createdAt || c.requestedAt || Date.now()).getTime() >= Date.now() - 24 * 60 * 60 * 1000
  );

  const bedsAvailable = stats?.availableBeds ?? 40;
  const totalBeds = stats?.totalBeds ?? 100;
  const icuAvailable = stats?.availableICU ?? 5;
  const totalICU = stats?.totalICU ?? 20;
  const ventilatorsAvailable = stats?.availableVentilators ?? 3;
  const totalVentilators = stats?.totalVentilators ?? 10;
  const icuPct = totalICU > 0 ? Math.round((icuAvailable / totalICU) * 100) : 0;

  return (
    <div className="flex flex-col gap-6 relative">
      {/* One-Time 3-Second Approval Success Message */}
      {showApprovalToast && (
        <div
          role="status"
          aria-live="polite"
          className="bg-emerald-600 text-white rounded-2xl p-4 sm:p-5 shadow-2xl flex items-center justify-between gap-4 border border-emerald-500 animate-in fade-in slide-in-from-top-4 duration-300 motion-reduce:animate-none z-50"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base">Hospital Verified & Activated!</p>
              <p className="text-xs sm:text-sm text-emerald-100 mt-0.5">{approvalMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowApprovalToast(false)}
            className="p-2 rounded-xl text-emerald-100 hover:text-white hover:bg-emerald-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Dismiss approval notification"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {acceptError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-xs sm:text-sm font-medium">{acceptError}</p>
          </div>
          <button
            type="button"
            onClick={() => setAcceptError(null)}
            className="text-red-500 hover:text-red-800 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hospital Status Banners */}
      {hospVerificationStatus === "PENDING_REVIEW" && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-amber-950 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-navy leading-tight">Verification Request Pending Review</p>
              <p className="text-amber-800 mt-0.5">Your verification request is currently under Admin review.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/hospital/profile-verification")}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-sm transition-colors text-xs text-center"
          >
            View Verification Status →
          </button>
        </div>
      )}

      {hospVerificationStatus === "REJECTED" && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-rose-950 shadow-sm">
          <div className="flex items-start gap-3.5 flex-1">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <Activity className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-rose-950 leading-tight">Verification Request Requires Changes</p>
              <p className="text-rose-800">Your Admin verification request was not approved. Please review the feedback and update your documents or details.</p>
              {rejectionReason && (
                <p className="text-xs text-rose-900 bg-white/80 p-2.5 rounded-lg border border-rose-200 font-mono mt-1">
                  <strong>Feedback:</strong> {rejectionReason}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/hospital/profile-verification")}
            className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-sm transition-colors text-xs whitespace-nowrap text-center"
          >
            Update Documents & Resubmit →
          </button>
        </div>
      )}

      {hospVerificationStatus === "APPROVED" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 text-xs text-emerald-950 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-emerald-950 leading-tight">Your Hospital Has Been Successfully Verified</p>
            <p className="text-emerald-800 mt-0.5">Admin has approved your hospital registration. Your hospital portal is now active.</p>
          </div>
        </div>
      )}

      {hospVerificationStatus === "BLOCKED" && (
        <div className="bg-red-100 border border-red-300 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 text-xs text-red-950 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-700 flex items-center justify-center shrink-0">
            <Siren className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm text-red-950 leading-tight">Hospital Account Restricted</p>
            <p className="text-red-900 mt-0.5">Your hospital account is currently restricted. Please contact the authorized Admin.</p>
          </div>
        </div>
      )}

      {/* Real-time Connection Banner */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-semibold ${connected ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800 animate-pulse"}`}>
        <div className="flex items-center gap-2">
          {connected ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-amber-600" />}
          <span>{connected ? "🟢 Live Emergency Operations Connected" : "🟠 Connection Interrupted — Using Fallback Polling..."}</span>
        </div>
        <span className="text-[11px] text-slate-500 font-normal">
          Last synced: {new Date().toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Incoming Emergencies" value={stats?.incomingCount ?? incoming.length} icon={Siren} tone="emergency" />
        <StatCard label="Active Cases" value={stats?.activeCasesCount ?? 0} icon={Activity} />
        <StatCard label="Accepted Today" value={stats?.acceptedCasesToday ?? 0} icon={ClipboardCheck} tone="success" />
        <StatCard label="Available Beds" value={bedsAvailable} icon={BedDouble} sub={`of ${totalBeds} total`} />
        <StatCard label="ICU Availability" value={`${icuPct}%`} icon={HeartPulse} tone="accent" sub={`${icuAvailable} of ${totalICU} available`} />
        <StatCard label="Avg Response Time" value={stats?.avgResponseTime ?? "—"} icon={Clock} />
      </div>

      {/* ACTIVE CASES WORKSPACE — real accepted cases from hospitalApi.getMyCases() */}
      <section className="rounded-2xl border border-slate-100 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <h2 className="font-bold text-navy text-base">Active Emergency Cases</h2>
          <span className="text-xs font-semibold text-sky-600 bg-sky-50 border border-sky-100 rounded-full px-2.5 py-1">
            {stats?.activeCasesCount ?? myCases.length} Active
          </span>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <p className="text-sm text-text-secondary py-8 text-center px-4">
              Loading active cases...
            </p>
          ) : myCasesError ? (
            <p className="text-sm text-emergency py-8 text-center px-4">
              Unable to load active cases.
            </p>
          ) : activeCases.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center px-4">
              No active emergency cases.
            </p>
          ) : (
            activeCases.map((c: any) => (
              <div key={c.caseId || c.id || c.publicCaseId} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ${
                        String(c.severity || "").toUpperCase() === "CRITICAL"
                          ? "text-red-600 bg-red-50 border-red-200"
                          : String(c.severity || "").toUpperCase() === "HIGH"
                          ? "text-emergency bg-orange-50 border-orange-200"
                          : "text-sky-700 bg-sky-50 border-sky-100"
                      }`}
                    >
                      {c.severity || "Moderate"}
                    </span>
                    <span className="font-mono text-xs font-semibold text-navy">
                      {c.publicCaseId || c.caseId || c.id || "N/A"}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {c.status || "ACCEPTED"}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  {c.emergencyType || c.emergency_type || c.type || "Emergency"} ·{" "}
                  Patient: {c.patientName || c.patient?.name || "Authorized patient"}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Accepted:{" "}
                    {c.acceptedAt
                      ? new Date(c.acceptedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </p>
                  <button
                    onClick={() =>
                      navigate(`/hospital/emergencies/${c.publicCaseId || c.caseId || c.id}`)
                    }
                    className="text-xs font-semibold text-sky-600 hover:underline"
                  >
                    View Case
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="font-bold text-navy mb-3 flex items-center justify-between text-base">
            <span>Incoming emergency cases</span>
            <span className="text-xs font-normal text-slate-500">{incoming.length} requiring immediate action</span>
          </h3>
          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="text-sm text-text-secondary py-8 text-center bg-white rounded-xl border p-4">
                <div className="inline-block w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p>Loading real-time emergency cases...</p>
              </div>
            ) : incoming.length === 0 ? (
              <div className="text-sm text-slate-500 py-12 text-center bg-white rounded-xl border border-dashed p-6">
                <Siren className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-navy">No active emergency requests.</p>
                <p className="text-xs text-slate-400 mt-1">All systems ready for incoming emergency dispatches.</p>
              </div>
            ) : (
              incoming.map((c) => (
                <div key={c.caseId || c.id} className="cursor-pointer" onClick={() => navigate(`/hospital/emergencies/${c.caseId || c.id}`)}>
                  <EmergencyCaseCard
                    emergencyCase={c}
                    isProcessing={processingCaseId === (c.publicCaseId || c.caseId || c.id)}
                    onAccept={(e?: any) => handleAccept(c.publicCaseId || c.caseId || c.id, e)}
                    onReject={(e?: any) => handleReject(c.publicCaseId || c.caseId || c.id, e)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <p className="font-semibold text-navy text-sm mb-3 flex items-center justify-between">
              <span>Hospital capacity</span>
              <button onClick={() => navigate('/hospital/capacity')} className="text-xs text-sky-600 font-semibold hover:underline">Manage</button>
            </p>
            <CapacityBar label="Beds" value={bedsAvailable} total={totalBeds} />
            <CapacityBar label="ICU" value={icuAvailable} total={totalICU} />
            <CapacityBar label="Ventilators" value={ventilatorsAvailable} total={totalVentilators} />
          </Card>

          <Card>
            <p className="font-semibold text-navy text-sm mb-3">Recent activity log</p>
            {stats?.recentActivity?.length > 0 ? (
              <ul className="text-xs text-text-secondary space-y-2.5">
                {visibleActivity.map((log: any) => (
                  <li key={log.id} className="border-b border-slate-50 pb-2 last:border-none">
                    <span className="font-semibold text-navy">{log.action}:</span> {log.details}
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activity logged.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CapacityBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-semibold text-navy">{value}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${pct < 20 ? "bg-emergency" : pct < 50 ? "bg-accent" : "bg-success"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
