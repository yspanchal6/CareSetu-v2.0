import { Link, useNavigate } from "react-router-dom";
import {
  Phone,
  MapPin,
  BrainCircuit,
  Search,
  CheckCircle2,
  Ambulance,
  ShieldCheck,
  ArrowRight,
  Building2,
  Users,
  Clock,
  TrendingUp,
  User,
  Stethoscope,
  Sparkles,
  Zap,
  Activity,
} from "lucide-react";
import Button from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect, useRef } from "react";

const journeySteps = [
  { icon: Phone, label: "Report Emergency", desc: "Instant SOS trigger" },
  { icon: MapPin, label: "Capture Location", desc: "GPS coordinates" },
  { icon: BrainCircuit, label: "AI Case Structuring", desc: "Triage & summary" },
  { icon: Search, label: "Find Hospital", desc: "Real-time capacity match" },
  { icon: CheckCircle2, label: "Hospital Accepts", desc: "Instant reservation" },
  { icon: Ambulance, label: "Patient Transfer", desc: "En-route telemetry" },
];

const features = [
  {
    icon: Phone,
    title: "Emergency SOS + AI Triage",
    desc: "One press starts a guided emergency report, structured instantly by AI for faster hospital response and dispatch readiness.",
    badge: "Instant Action",
    glowColor: "from-rose-500/20 to-amber-500/20",
  },
  {
    icon: MapPin,
    title: "Smart Hospital Matching",
    desc: "Intelligently matches patients to nearest hospitals by distance, live ICU/bed availability, and required specialist capability.",
    badge: "Live Telemetry",
    glowColor: "from-sky-500/20 to-blue-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Secure Health Pack",
    desc: "Encrypted medical history shared only with explicit patient consent, ensuring privacy while delivering critical clinical data.",
    badge: "256-bit Encrypted",
    glowColor: "from-emerald-500/20 to-teal-500/20",
  },
];

const stats = [
  { icon: Building2, value: "480+", label: "Connected hospitals", change: "+12 this month" },
  { icon: Clock, value: "2.3 min", label: "Average match time", change: "40% faster" },
  { icon: Users, value: "12,000+", label: "Cases coordinated", change: "99.9% uptime" },
  { icon: TrendingUp, value: "94%", label: "Acceptance rate", change: "Verified routing" },
];

const signupRoles = [
  {
    role: "patient",
    icon: User,
    title: "Sign up as Patient",
    desc: "Get matched with the right hospital and access Doctor AI during emergencies.",
    gradient: "from-sky-500 to-blue-600",
    bgAccent: "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400",
  },
  {
    role: "doctor",
    icon: Stethoscope,
    title: "Sign up as Doctor",
    desc: "Review assigned patients, AI case summaries, and coordinate treatment.",
    gradient: "from-indigo-500 to-purple-600",
    bgAccent: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400",
  },
  {
    role: "admin",
    icon: ShieldCheck,
    title: "Sign up as Admin",
    desc: "Oversee the CareSetu network, hospitals, and system health.",
    gradient: "from-emerald-500 to-teal-600",
    bgAccent: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, startGuestSession } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  // Auto-cycle orbit active step
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % journeySteps.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Parallax mouse movement listener
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x: x * 20, y: y * 20 });
  };

  const handleEmergencyClick = async () => {
    if (loadingAction) return;
    try {
      setLoadingAction("emergency");
      if (!isAuthenticated) {
        await startGuestSession();
      }
      navigate("/patient/emergency");
    } catch (err) {
      console.error("[Landing] Guest emergency failed:", err);
      navigate("/patient/emergency");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDoctorAiClick = async () => {
    if (loadingAction) return;
    try {
      setLoadingAction("doctor-ai");
      if (!isAuthenticated) {
        await startGuestSession();
      }
      navigate("/patient/doctor-ai");
    } catch (err) {
      console.error("[Landing] Guest doctor AI failed:", err);
      navigate("/patient/doctor-ai");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
      {/* HERO SECTION */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden bg-gradient-to-b from-sky-50/70 via-slate-50 to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 pt-12 pb-24 border-b border-slate-200/60 dark:border-slate-800/60"
      >
        {/* Background glowing gradient circles */}
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-sky-400/20 dark:bg-sky-500/10 blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{ transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)` }}
        />
        <div
          className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-rose-400/15 dark:bg-rose-500/10 blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{ transform: `translate(${-mousePos.x * 0.5}px, ${-mousePos.y * 0.5}px)` }}
        />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left Text Column */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100/80 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 text-xs font-bold tracking-wide shadow-sm animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
              </span>
              <Sparkles className="w-3.5 h-3.5 text-sky-500 animate-spin-slow" />
              <span>Next-Gen Emergency Care Coordination</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white leading-[1.08] tracking-tight">
              <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 dark:from-sky-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                Right Care.
              </span>
              <br />
              <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 dark:from-rose-400 dark:via-pink-400 dark:to-amber-400 bg-clip-text text-transparent">
                Right Time.
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 dark:from-emerald-400 dark:via-teal-400 dark:to-sky-400 bg-clip-text text-transparent">
                Right Place.
              </span>
            </h1>

            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed font-medium">
              CareSetu connects patients with the right healthcare facility during emergencies using intelligent hospital matching, secure health information sharing, and AI-assisted triage.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleEmergencyClick}
                disabled={loadingAction === "emergency"}
                className="group relative inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-base shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-rose-500/40"
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
                <Phone className="w-5 h-5 group-hover:animate-bounce" />
                <span>{loadingAction === "emergency" ? "Initializing SOS..." : "Report Emergency"}</span>
              </button>

              <button
                type="button"
                onClick={handleDoctorAiClick}
                disabled={loadingAction === "doctor-ai"}
                className="group inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-sky-400/80 dark:border-sky-600/80 text-sky-600 dark:text-sky-300 font-extrabold text-base shadow-md hover:shadow-sky-500/20 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-sky-500/30"
              >
                <BrainCircuit className="w-5 h-5 text-sky-500 group-hover:rotate-12 transition-transform duration-300" />
                <span>{loadingAction === "doctor-ai" ? "Starting Doctor AI..." : "Doctor AI Assistant"}</span>
              </button>
            </div>

            {/* Micro Flow Pipeline Indicator */}
            <div className="flex items-center gap-2 pt-4 text-xs font-bold text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="px-2.5 py-1 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200">Patient</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300">SOS Triage</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2.5 py-1 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300">AI Matching</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300">Hospital Acceptance</span>
            </div>
          </div>

          {/* Right Interactive Orbit Visual */}
          <div
            className="relative aspect-square max-w-md mx-auto w-full transition-transform duration-300 ease-out"
            style={{ transform: `translate(${mousePos.x * -0.3}px, ${mousePos.y * -0.3}px)` }}
          >
            {/* Outer Orbit Rings */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-sky-400/30 dark:border-sky-500/20 animate-[spin_50s_linear_infinite]" />
            <div className="absolute inset-6 rounded-full border border-slate-200 dark:border-slate-800 animate-[spin_35s_linear_infinite_reverse]" />

            {/* Orbit Node Cards */}
            {journeySteps.map((s, i) => {
              const angle = (i / journeySteps.length) * 2 * Math.PI - Math.PI / 2;
              const r = 42;
              const x = 50 + r * Math.cos(angle);
              const y = 50 + r * Math.sin(angle);
              const isActive = activeStep === i;

              return (
                <div
                  key={s.label}
                  onClick={() => setActiveStep(i)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all duration-500 group ${
                    isActive ? "scale-110 z-20" : "scale-100 opacity-85 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div
                    className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md ${
                      isActive
                        ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 ring-4 ring-sky-300/50 dark:ring-sky-700/50"
                        : "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-slate-800 group-hover:border-sky-300"
                    }`}
                  >
                    <s.icon className={`w-5 h-5 ${isActive ? "animate-pulse" : "group-hover:scale-110"}`} />
                  </div>
                  <span
                    className={`text-[11px] font-bold text-center mt-1.5 px-2 py-0.5 rounded-full transition-colors max-w-[100px] leading-tight ${
                      isActive
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}

            {/* Central Pulse Hub */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
              <div className="relative">
                <span className="animate-ping absolute inset-0 rounded-full bg-rose-500 opacity-50" />
                <button
                  type="button"
                  onClick={handleEmergencyClick}
                  className="relative w-22 h-22 rounded-full bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 text-white flex flex-col items-center justify-center shadow-xl shadow-rose-600/40 hover:scale-110 active:scale-95 transition-all duration-300 group"
                >
                  <Ambulance className="w-9 h-9 text-white group-hover:animate-bounce" />
                  <span className="text-[10px] font-black tracking-wider uppercase mt-1">SOS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-8 -mt-10 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((s) => (
            <Card
              key={s.label}
              className="p-5 text-center group hover:-translate-y-1 hover:shadow-xl hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{s.value}</p>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">{s.label}</p>
              <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mt-2">
                {s.change}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* ROLE SELECTION SECTION */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950 px-3 py-1 rounded-full">
            Tailored Onboarding
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Get started on CareSetu</h2>
          <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
            Create an account tailored to your role in the emergency care network.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {signupRoles.map((r) => (
            <Card
              key={r.role}
              className="flex flex-col p-6 hover:-translate-y-1.5 hover:shadow-2xl hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300 group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${r.bgAccent} group-hover:scale-110 transition-transform`}>
                <r.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {r.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed flex-1">{r.desc}</p>

              <Link to={`/register?role=${r.role}`} className="mt-6">
                <Button variant="outline" size="md" fullWidth icon={<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}>
                  Continue as {r.role}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS / FEATURES SECTION */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 bg-slate-100/60 dark:bg-slate-900/40 rounded-3xl my-8 border border-slate-200/60 dark:border-slate-800/60">
        <div className="max-w-2xl mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-3 py-1 rounded-full">
            Core Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">How CareSetu Works</h2>
          <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
            Three connected capabilities move a patient from crisis to treatment with as little friction as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <Card
              key={f.title}
              className="p-7 relative overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
            >
              <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${f.glowColor} blur-2xl group-hover:scale-150 transition-transform duration-500`} />
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  Step 0{i + 1}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white relative z-10">{f.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* HOSPITAL NETWORK BANNER */}
      <section className="bg-gradient-to-br from-slate-900 via-navy-dark to-slate-950 py-20 text-white relative overflow-hidden my-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Hospital Network Integration
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">Built for hospitals under pressure</h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Review incoming emergency cases with full AI triage context, accept or reject in one tap, and maintain live bed, ICU, and specialist availability for the entire regional network.
            </p>
            <div className="pt-2">
              <Link to="/register?role=hospital">
                <Button variant="primary" size="lg" className="shadow-lg shadow-sky-500/30">
                  Register Your Hospital
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              "Real-time ICU capacity tracking",
              "AI-suggested hospital matching",
              "Consent-based encrypted records",
              "Audit-ready emergency logs",
            ].map((featureText) => (
              <div
                key={featureText}
                className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 hover:bg-white/10 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-sky-400 mb-2.5" />
                <p className="text-sm font-semibold text-slate-100">{featureText}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center relative">
        <div className="space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Every second is coordinated.</h2>
          <p className="text-slate-600 dark:text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
            Join the network connecting patients, hospitals, and emergency doctors when every second counts.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 pt-6">
            <button
              type="button"
              onClick={handleEmergencyClick}
              disabled={loadingAction === "emergency"}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-base shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Zap className="w-5 h-5" />
              <span>{loadingAction === "emergency" ? "Initializing..." : "Report Emergency"}</span>
            </button>
            <Link to="/register">
              <Button variant="outline" size="lg" className="px-7 py-4 rounded-2xl">
                Create An Account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
