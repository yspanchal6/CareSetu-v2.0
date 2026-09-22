import { Siren, ClipboardCheck, BedDouble, HeartPulse, Clock, Activity, Wifi, WifiOff } from "lucide-react";
import { StatCard, Card } from "../../components/common/Card";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { hospitalApi } from "../../services/api";
import { useSocket } from "../../context/SocketContext";

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const { connected } = useSocket();

  const [cases, setCases] = useState<any[]>([]);
  const [myCases, setMyCases] = useState<any[]>([]);
  const [myCasesError, setMyCasesError] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const [casesRes, statsRes] = await Promise.all([
        hospitalApi.pendingCases().catch(() => ({ cases: [] })),
        hospitalApi.getStats().catch(() => ({ stats: null })),
      ]);
      setCases(casesRes.cases || []);
      setMyCases(casesRes.cases || []);
      setMyCasesError(false);
      if (statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error("[HospitalDashboard] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    loadDashboardData();

    // Authenticated fallback polling: 15s interval when connected, 5s when disconnected
    const pollMs = connected ? 15000 : 5000;
    const interval = setInterval(debouncedRefetch, pollMs);
    return () => {
      clearInterval(interval);
      if (refetchTimerRef.current) window.clearTimeout(refetchTimerRef.current);
    };
  }, [loadDashboardData, connected, debouncedRefetch]);

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

  const handleAccept = async (caseId: string) => {
    try {
      await hospitalApi.acceptCase(caseId);
      debouncedRefetch();
    } catch (err: any) {
      alert(err.message || "Failed to accept case");
    }
  };

  const handleReject = async (caseId: string) => {
    const reason = prompt("Select or type reason (e.g. ICU unavailable):");
    try {
      await hospitalApi.rejectCase(caseId, reason || undefined);
      debouncedRefetch();
    } catch (err: any) {
      alert(err.message || "Failed to reject case");
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
    <div className="flex flex-col gap-6">
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
                    onAccept={() => handleAccept(c.publicCaseId || c.caseId || c.id)}
                    onReject={() => handleReject(c.publicCaseId || c.caseId || c.id)}
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
