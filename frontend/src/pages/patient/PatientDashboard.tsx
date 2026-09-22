import { Link } from "react-router-dom";
import { Siren, MapPin, Building2, ShieldCheck, ChevronRight, Wifi, BrainCircuit, CalendarDays, UploadCloud } from "lucide-react";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import { useAuth } from "../../context/AuthContext";
import { hospitals } from "../../data/hospitals";
import { emergencyApi } from "../../services/api";
import { EmptyState } from "../../components/common/States";
import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

const severityTone = { Critical: "critical", CRITICAL: "critical", Urgent: "urgent", HIGH: "urgent", Stable: "stable", LOW: "stable" } as const;

export default function PatientDashboard() {
  const { user } = useAuth();
  const nearby = hospitals.slice(0, 3);
  
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await emergencyApi.getMyCases();
        setCases(res.cases || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const recentCase = cases.length > 0 ? cases[0] : null;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary">Good morning,</p>
          <h2 className="text-2xl font-extrabold text-navy">{user?.name?.split(" ")[0] ?? "there"}</h2>
        </div>
        <Link
          to="/patient/upload-documents"
          className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-navy bg-white border border-slate-200 rounded-xl px-4 py-2.5 hover:border-sky shadow-soft"
        >
          <UploadCloud className="w-4 h-4" /> Upload Doc
        </Link>
      </div>

      <Link
        to="/patient/emergency"
        className="relative overflow-hidden bg-emergency rounded-2xl p-5 flex items-center justify-between text-white shadow-lg active:scale-[0.99] transition-transform"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Hold to report</p>
          <p className="text-xl font-extrabold mt-1">Report Emergency</p>
        </div>
        <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center animate-pulseRing">
          <Siren className="w-7 h-7" />
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/patient/doctor-ai">
          <Card className="flex items-center gap-3 hover:border-sky border border-transparent transition-colors">
            <div className="w-10 h-10 rounded-xl bg-lightblue flex items-center justify-center shrink-0">
              <BrainCircuit className="w-5 h-5 text-navy-dark" />
            </div>
            <div>
              <p className="font-bold text-navy text-sm leading-tight">Doctor AI</p>
              <p className="text-xs text-text-secondary">Ask a health question</p>
            </div>
          </Card>
        </Link>
        <Link to="/patient/book-sessions">
          <Card className="flex items-center gap-3 hover:border-sky border border-transparent transition-colors">
            <div className="w-10 h-10 rounded-xl bg-lightblue flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-navy-dark" />
            </div>
            <div>
              <p className="font-bold text-navy text-sm leading-tight">Book Sessions</p>
              <p className="text-xs text-text-secondary">Consult a doctor</p>
            </div>
          </Card>
        </Link>
      </div>

      <Link to="/patient/upload-documents" className="sm:hidden">
        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lightblue flex items-center justify-center">
              <UploadCloud className="w-5 h-5 text-navy-dark" />
            </div>
            <p className="font-bold text-navy text-sm">Upload your documents</p>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-slate-300" />
        </Card>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lightblue flex items-center justify-center shrink-0">
            <MapPin className="w-4.5 h-4.5 text-navy-dark" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">Location</p>
            <p className="text-sm font-bold text-navy">Vadodara, GJ</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Wifi className="w-4.5 h-4.5 text-success" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">Sync status</p>
            <p className="text-sm font-bold text-navy">Online</p>
          </div>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-navy">Nearby hospitals</h3>
          <Link to="/patient/hospitals" className="text-xs font-semibold text-sky flex items-center gap-0.5">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {nearby.map((h) => (
            <Link key={h.id} to={`/patient/hospitals/${h.id}`}>
              <Card className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-paleblue flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-navy-dark" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy text-sm">{h.name}</p>
                    <p className="text-xs text-text-secondary">{h.responseTimeMin} min away</p>
                  </div>
                </div>
                <Badge tone={h.availability === "Available" ? "available" : h.availability === "Limited" ? "limited" : "unavailable"}>
                  {h.availability}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-navy">Recent emergency cases</h3>
          <Link to="/patient/cases" className="text-xs font-semibold text-sky flex items-center gap-0.5">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="p-4 text-sm text-text-secondary">Loading cases...</div>
        ) : recentCase ? (
          <Link to={`/patient/cases/${recentCase.id || recentCase.caseId}`}>
            <Card className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-navy text-sm">{recentCase.id || recentCase.caseId}</p>
                <p className="text-xs text-text-secondary mt-0.5">{recentCase.symptoms}</p>
              </div>
              <Badge tone={(severityTone as any)[recentCase.severity] || "urgent"}>{recentCase.severity || "Urgent"}</Badge>
            </Card>
          </Link>
        ) : (
          <Card>
            <EmptyState icon={Inbox} title="No active cases" message="You don't have any ongoing emergency cases." />
          </Card>
        )}
      </div>

      <Link to="/patient/health-pack">
        <Card className="flex items-center justify-between bg-navy border-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-sky" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Health Pack</p>
              <p className="text-xs text-white/60">Encrypted · Consent-based sharing</p>
            </div>
          </div>
          <ChevronRight className="w-4.5 h-4.5 text-white/60" />
        </Card>
      </Link>
    </div>
  );
}
