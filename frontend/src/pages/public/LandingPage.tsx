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
  Navigation,
  BellRing,
  CheckCircle,
  Eye,
  Info,
} from "lucide-react";
import Button from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { useAuth } from "../../context/AuthContext";
import { useState, useRef, useEffect } from "react";

const journeySteps = [
  { icon: Phone, label: "Report Emergency", desc: "Instant SOS trigger" },
  { icon: MapPin, label: "Capture Location", desc: "GPS coordinates" },
  { icon: BrainCircuit, label: "AI Case Structuring", desc: "Triage & summary" },
  { icon: Search, label: "Find Hospital", desc: "Real-time capacity match" },
  { icon: CheckCircle2, label: "Hospital Accepts", desc: "Instant reservation" },
  { icon: Ambulance, label: "Patient Transfer", desc: "En-route telemetry" },
];

interface JourneyStageItem {
  stage: number;
  title: string;
  shortLabel: string;
  actor: "Patient" | "CareSetu" | "Hospital" | "Doctor";
  icon: typeof Phone;
  description: string;
  badge: string;
  statusTag: string;
  statusColor: string;
}

const emergencyJourneyStages: JourneyStageItem[] = [
  {
    stage: 1,
    title: "Patient Requests Help",
    shortLabel: "SOS Trigger",
    actor: "Patient",
    icon: Phone,
    description:
      "The patient or bystander opens CareSetu and taps the SOS button to instantly initiate an emergency request.",
    badge: "Stage 01",
    statusTag: "Request Initiated",
    statusColor: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  {
    stage: 2,
    title: "Location Identified",
    shortLabel: "GPS / Address",
    actor: "CareSetu",
    icon: Navigation,
    description:
      "Exact device GPS coordinates are captured automatically, or manual address entry is used if GPS permission is unavailable.",
    badge: "Stage 02",
    statusTag: "Location Pinned",
    statusColor: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  },
  {
    stage: 3,
    title: "Emergency Assessment",
    shortLabel: "AI Priority",
    actor: "CareSetu",
    icon: BrainCircuit,
    description:
      "Our safety rule engine and clinical triage model evaluate symptoms, vitals, and reported trauma into high/medium/critical severity.",
    badge: "Stage 03",
    statusTag: "Triage Classified",
    statusColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  {
    stage: 4,
    title: "Suitable Hospitals Searched",
    shortLabel: "Smart Matching",
    actor: "CareSetu",
    icon: Search,
    description:
      "CareSetu scans verified regional facilities to match based on real-time distance, ICU/bed availability, and required specialty equipment.",
    badge: "Stage 04",
    statusTag: "Network Scanned",
    statusColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  {
    stage: 5,
    title: "Hospital Notified",
    shortLabel: "Case Dispatch",
    actor: "Hospital",
    icon: BellRing,
    description:
      "Matched hospitals immediately receive instant dashboard alerts, audible ringers, and push notifications with full case context.",
    badge: "Stage 05",
    statusTag: "Alert Sent",
    statusColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  {
    stage: 6,
    title: "Hospital Responds",
    shortLabel: "Pending Decision",
    actor: "Hospital",
    icon: Clock,
    description:
      "The case remains clearly marked Pending while hospital staff reviews capability to accept or decline before confirmed reservation.",
    badge: "Stage 06",
    statusTag: "Pending Review",
    statusColor: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  },
  {
    stage: 7,
    title: "Patient Sees Updates",
    shortLabel: "Live Visibility",
    actor: "Patient",
    icon: Eye,
    description:
      "The patient watches real-time status updates, viewing the confirmed hospital address, arrival preparation instructions, or direct 108 calling.",
    badge: "Stage 07",
    statusTag: "Realtime Tracking",
    statusColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
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
  {
    icon: Building2,
    value: "480+",
    label: "Connected hospitals",
    change: "+12 this month",
  },
  {
    icon: Clock,
    value: "2.3 min",
    label: "Average match time",
    change: "40% faster",
  },
  {
    icon: Users,
    value: "12,000+",
    label: "Cases coordinated",
    change: "99.9% uptime",
  },
  {
    icon: TrendingUp,
    value: "94%",
    label: "Acceptance rate",
    change: "Verified routing",
  },
];

const signupRoles = [
  {
    role: "patient",
    icon: User,
    title: "Sign up as Patient",
    desc: "Get matched with the right hospital and access Doctor AI during emergencies.",
    gradient: "from-sky-500 to-blue-600",
    bgAccent: "bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400",
  },
  {
    role: "doctor",
    icon: Stethoscope,
    title: "Sign up as Doctor",
    desc: "Review assigned patients, AI case summaries, and coordinate treatment.",
    gradient: "from-indigo-500 to-purple-600",
    bgAccent: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400",
  },
  {
    role: "admin",
    icon: ShieldCheck,
    title: "Sign up as Admin",
    desc: "Oversee the CareSetu network, hospitals, and system health.",
    gradient: "from-emerald-500 to-teal-600",
    bgAccent: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400",
  },
];

const teamMembers = [
  {
    name: "Panchal Yash",
    role: "Team Lead",
    badge: "Team Lead",
    photo: `${import.meta.env.BASE_URL}team-verify/yash_clean.png`,
    imageFit: "object-cover",
    imagePosition: "object-center",
    responsibilities:
      "Responsible for overall project planning, team coordination, and technical execution. Manages backend integration, authentication and authorization, cybersecurity standards, testing, and deployment preparation.",
    tags: ["Team Coordination", "Project Planning", "Backend Integration", "Cybersecurity", "Testing"],
  },
  {
    name: "Princy Prajapati",
    role: "AI/ML Developer",
    badge: "AI & ML",
    photo: `${import.meta.env.BASE_URL}team-verify/princy_prajapati_clean.png`,
    imageFit: "object-cover",
    imagePosition: "object-center",
    responsibilities:
      "Handles dataset preprocessing and AI/ML model development and evaluation. Supports AI integration into the platform, model testing, and AI-related backend workflows.",
    tags: ["Data Preprocessing", "Model Development", "Model Evaluation", "AI Integration", "Testing"],
  },
  {
    name: "Kritika Singh",
    role: "UI/UX & Frontend Developer",
    badge: "UI/UX & Frontend",
    photo: `${import.meta.env.BASE_URL}team-verify/kritika_singh_clean.png`,
    imageFit: "object-cover",
    imagePosition: "object-center",
    responsibilities:
      "Creates user interface designs and prototypes in Figma. Builds responsive frontend layouts using React and TypeScript, focusing on accessibility and seamless API integration.",
    tags: ["Figma", "UI/UX Design", "React", "TypeScript", "Accessibility"],
  },
  {
    name: "Nensi Parmar",
    role: "Database & Data Integration",
    badge: "Data & Database",
    photo: `${import.meta.env.BASE_URL}team-verify/nensi_parmar.jpeg`,
    imageFit: "object-cover",
    imagePosition: "object-center",
    responsibilities:
      "Designs the database structure, Prisma schemas, and entity relationships while maintaining data integrity. Manages query formulation, database integration, and database security.",
    tags: ["Prisma Schema", "Database Design", "Data Integrity", "Queries", "Database Security"],
  },
  {
    name: "Himanshu",
    role: "Research & Documentation",
    badge: "Domain Research",
    photo: `${import.meta.env.BASE_URL}team-verify/himanshu.png`,
    imageFit: "object-cover",
    imagePosition: "object-[center_15%]",
    responsibilities:
      "Conducts problem-statement research, requirements gathering, and healthcare-domain studies. Prepares comprehensive project documentation, testing checklists, and progress tracking reports.",
    tags: ["Problem Research", "Healthcare Domain", "Requirements", "Documentation", "QA Checklists"],
  },
  {
    name: "Siddiqui Affan",
    role: "Presentation & Research",
    badge: "Strategy & Pitching",
    photo: `${import.meta.env.BASE_URL}team-verify/siddiqui-affan-professional.png`,
    imageFit: "object-cover",
    imagePosition: "object-center",
    responsibilities:
      "Leads presentation design, slide preparation, and competition pitching strategy. Delivers demo storytelling and conducts market research to support competition presentation.",
    tags: ["PPT Preparation", "Pitching Strategy", "Demo Storytelling", "Market Research", "Presentation"],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, startGuestSession } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Auto-cycle orbit active step
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % journeySteps.length);
    }, 3000);

    return () => {
      clearInterval(timer);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Parallax mouse movement listener (throttled with rAF)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;

    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;

    if (animFrameRef.current !== null) return;
    animFrameRef.current = requestAnimationFrame(() => {
      setMousePos({ x, y });
      animFrameRef.current = null;
    });
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
    <div className="overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* HERO SECTION */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative overflow-hidden bg-white dark:bg-slate-950 pt-10 pb-20 border-b border-slate-100 dark:border-slate-800 transition-colors"
      >
        {/* Subtle background atmosphere */}
        <div
          className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-sky-100/40 dark:bg-sky-500/10 blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{
            transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3
              }px)`,
          }}
        />

        <div
          className="absolute top-1/2 -right-32 w-80 h-80 rounded-full bg-rose-50/40 dark:bg-rose-500/10 blur-3xl pointer-events-none transition-transform duration-500 ease-out"
          style={{
            transform: `translate(${-mousePos.x * 0.3}px, ${-mousePos.y * 0.3
              }px)`,
          }}
        />

        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-12 gap-10 items-center relative z-10">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold tracking-tight shadow-2xs animate-hero-stagger">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>Emergency care coordination</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold tracking-tight shadow-2xs animate-hero-stagger">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>3 Free AI Credits for Guest Triage</span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white leading-[1.08] tracking-tight animate-hero-stagger [animation-delay:150ms]">
              Right Care.
              <br />
              Right Time.
              <br />
              Right Place.
            </h1>

            <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed font-normal animate-hero-stagger [animation-delay:300ms]">
              CareSetu connects patients with the right healthcare facility
              during emergencies using intelligent hospital matching, secure
              health information sharing, and AI-assisted coordination.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2 animate-hero-stagger [animation-delay:450ms]">
              <button
                type="button"
                onClick={handleEmergencyClick}
                disabled={loadingAction === "emergency"}
                className="group relative inline-flex items-center justify-center gap-3 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-base shadow-lg shadow-rose-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-rose-500/30"
              >
                <Phone className="w-5 h-5" />
                <span>
                  {loadingAction === "emergency"
                    ? "Initializing SOS..."
                    : "Report Emergency"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDoctorAiClick}
                disabled={loadingAction === "doctor-ai"}
                className="group inline-flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-extrabold text-base shadow-md border border-slate-800 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-sky-500/30"
              >
                <BrainCircuit className="w-5 h-5 text-sky-400 group-hover:rotate-12 transition-transform duration-300" />
                <span>
                  {loadingAction === "doctor-ai"
                    ? "Starting Doctor AI..."
                    : "Doctor AI Assistant"}
                </span>
              </button>
            </div>

            {/* Micro Flow Pipeline Indicator */}
            <div className="flex items-center gap-2 pt-3 text-xs font-semibold text-slate-600 dark:text-slate-400 flex-wrap animate-hero-stagger [animation-delay:600ms]">
              <span className="text-slate-800 dark:text-slate-200 font-bold">Patient</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="text-rose-600 dark:text-rose-400 font-bold">Emergency</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="text-sky-600 dark:text-sky-400 font-bold">Smart Matching</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="text-slate-800 dark:text-slate-200 font-bold">Hospital</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="text-slate-800 dark:text-slate-200 font-bold">Doctor</span>
            </div>
          </div>

          {/* RIGHT — EMERGENCY ORBIT */}
          <div
            className="lg:col-span-6 relative aspect-square max-w-[330px] xs:max-w-[370px] sm:max-w-md mx-auto w-full my-6 lg:my-0 transition-transform duration-300 ease-out animate-hero-stagger [animation-delay:300ms]"
            style={{
              transform: `translate(${mousePos.x * -0.2}px, ${mousePos.y * -0.2
                }px)`,
            }}
          >
            {/* Outer Dotted Circle (Light Sky-Blue, Dashed, Slightly Larger) */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-sky-400/30 animate-[spin_60s_linear_infinite]" />
            {/* Inner Solid Circle (Light Slate/Blue, Solid, Follows Node Orbit) */}
            <div className="absolute inset-8 rounded-full border border-slate-200/80 dark:border-slate-800 animate-[spin_40s_linear_infinite_reverse]" />

            {/* Continuous Rotating Orbit Container */}
            <div className="absolute inset-0 animate-[spin_60s_linear_infinite]">
              {journeySteps.map((s, i) => {
                const angle =
                  (i / journeySteps.length) * 2 * Math.PI - Math.PI / 2;

                const r = 38;

                const x = 50 + r * Math.cos(angle);
                const y = 50 + r * Math.sin(angle);

                const isActive = activeStep === i;

                return (
                  <div
                    key={s.label}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-default transition-all duration-300 group hover:scale-105"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                    }}
                  >
                    {/* Counter-spin wrapper keeps node upright */}
                    <div className="animate-[spin_60s_linear_infinite_reverse] flex flex-col items-center">
                      {/* Orbit Node Icon Card */}
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 bg-white dark:bg-slate-900 border ${isActive
                          ? "border-sky-400 shadow-md ring-2 ring-sky-200/60 dark:ring-sky-900/60 text-sky-600 dark:text-sky-400"
                          : "border-slate-200/80 dark:border-slate-800 shadow-sm text-sky-600 dark:text-sky-400"
                          } group-hover:border-sky-400 group-hover:shadow-md`}
                      >
                        <s.icon
                          className={`w-5 h-5 transition-all ${isActive
                            ? "text-sky-500 scale-110"
                            : "text-sky-600 dark:text-sky-400 group-hover:text-sky-500"
                            }`}
                        />
                      </div>

                      {/* Orbit Node Label Pill */}
                      <span
                        className={`text-[11px] font-bold text-center mt-1.5 px-2.5 py-0.5 rounded-full transition-colors max-w-[100px] leading-tight bg-white dark:bg-slate-900 border ${isActive
                          ? "text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-700 shadow-xs"
                          : "text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-800 shadow-2xs"
                          } group-hover:border-sky-300 dark:group-hover:border-sky-600`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Central Pulse Hub */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center z-10">
              <div className="relative">
                {/* SOS Pulse */}
                <span className="animate-ping absolute inset-0 rounded-full bg-rose-500/40 duration-1000" />

                {/* Central SOS Button */}
                <button
                  type="button"
                  onClick={handleEmergencyClick}
                  disabled={loadingAction === "emergency"}
                  className="relative w-20 h-20 rounded-full bg-rose-600 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all duration-300 group"
                >
                  <Ambulance className="w-8 h-8 text-white group-hover:animate-pulse" />

                  <span className="text-[10px] font-black tracking-wider uppercase mt-0.5">
                    SOS
                  </span>
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
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <s.icon className="w-5 h-5" />
              </div>

              <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {s.value}
              </p>

              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
                {s.label}
              </p>

              <span className="inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full mt-2">
                {s.change}
              </span>
            </Card>
          ))}
        </div>
      </section>

      {/* ROLE SELECTION SECTION */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/60 px-3 py-1 rounded-full">
            Tailored Onboarding
          </span>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Get started on CareSetu
          </h2>

          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
            Create an account tailored to your role in the emergency care
            network.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {signupRoles.map((r) => (
            <Card
              key={r.role}
              className="flex flex-col p-6 hover:-translate-y-1.5 hover:shadow-2xl hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300 group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${r.bgAccent} group-hover:scale-110 transition-transform`}
              >
                <r.icon className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {r.title}
              </h3>

              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed flex-1">
                {r.desc}
              </p>

              <Link to={`/register?role=${r.role}`} className="mt-6">
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  icon={
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  }
                >
                  Continue as {r.role}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS / FEATURES SECTION */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 bg-slate-100/60 dark:bg-slate-900/40 rounded-3xl my-8 border border-slate-200/60 dark:border-slate-800 transition-colors">
        <div className="max-w-2xl mb-12 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-3 py-1 rounded-full">
            Core Capabilities
          </span>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            How CareSetu Works
          </h2>

          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
            Three connected capabilities move a patient from crisis to
            treatment with as little friction as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <Card
              key={f.title}
              className="p-7 relative overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
            >
              <div
                className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${f.glowColor} blur-2xl group-hover:scale-150 transition-transform duration-500`}
              />

              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6" />
                </div>

                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  Step 0{i + 1}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white relative z-10">
                {f.title}
              </h3>

              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed relative z-10">
                {f.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* GRAPHICAL EMERGENCY JOURNEY VISUALIZATION (STEP 4) */}
      <section
        id="emergency-journey"
        className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20 my-10"
        aria-labelledby="emergency-journey-heading"
      >
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Emergency Lifeline</span>
          </div>

          <h2
            id="emergency-journey-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight"
          >
            How CareSetu Connects You In Seconds
          </h2>

          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Follow the journey of an emergency request from the moment you call for help to verified hospital readiness. Simple, transparent, and built for speed.
          </p>
        </div>

        {/* 7-STAGE GRAPHICAL FLOW CONTAINER */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl relative overflow-hidden transition-colors">
          {/* Subtle Background Glow Elements */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* ACTOR LEGEND BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-8 mb-8 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Participants:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                  <User className="w-3.5 h-3.5 text-sky-500" /> Patient
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800">
                  <BrainCircuit className="w-3.5 h-3.5 text-indigo-500" /> CareSetu Platform
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" /> Hospital Staff
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Orchestration</span>
            </div>
          </div>

          {/* HORIZONTAL DESKTOP / TABLET SCROLLABLE FLOW */}
          <div className="hidden lg:block">
            <div className="relative">
              {/* Responsive Journey Grid: 4 cols top + 3 cols bottom on lg, 7 cols on 2xl */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-4 relative z-10">
                {emergencyJourneyStages.map((st, idx) => {
                  const IconComponent = st.icon;
                  const isPending = st.stage === 6;
                  const isAccepted = st.stage === 7;

                  return (
                    <div
                      key={st.stage}
                      className="group flex flex-col items-center text-center p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500 hover:shadow-lg transition-all duration-300"
                    >
                      {/* Step Indicator & Icon Node */}
                      <div className="relative mb-3">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${
                            st.stage === 1
                              ? "bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                              : isPending
                              ? "bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                              : isAccepted
                              ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              : "bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800"
                          }`}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>

                        {/* Number Badge */}
                        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black flex items-center justify-center shadow-xs">
                          {st.stage}
                        </span>
                      </div>

                      {/* Actor Badge */}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        {st.actor}
                      </span>

                      {/* Title */}
                      <h3 className="text-xs xl:text-sm font-black text-slate-900 dark:text-white leading-tight min-h-[36px] flex items-center justify-center">
                        {st.title}
                      </h3>

                      {/* Status Tag */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border my-2 ${st.statusColor}`}
                      >
                        {st.statusTag}
                      </span>

                      {/* Short Description */}
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mt-1">
                        {st.description}
                      </p>

                      {/* Pending Caveat Note for Stage 6 */}
                      {isPending && (
                        <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-50/80 dark:bg-amber-950/50 p-1.5 rounded-lg border border-amber-200/60 dark:border-amber-800/60">
                          Awaiting hospital decision (Accept/Reject)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* VERTICAL / 2-COLUMN FLOW FOR MOBILE & TABLET */}
          <div className="block lg:hidden">
            <div className="space-y-4">
              {emergencyJourneyStages.map((st, idx) => {
                const IconComponent = st.icon;
                const isPending = st.stage === 6;
                const isAccepted = st.stage === 7;
                const isLast = idx === emergencyJourneyStages.length - 1;

                return (
                  <div key={st.stage} className="relative flex gap-4">
                    {/* Vertical Timeline Bar & Connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center shadow-sm ${
                          st.stage === 1
                            ? "bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                            : isPending
                            ? "bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                            : isAccepted
                            ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>

                      {!isLast && (
                        <div className="w-0.5 flex-1 min-h-[32px] my-1.5 bg-gradient-to-b from-sky-400 to-slate-300 dark:from-sky-500 dark:to-slate-700" />
                      )}
                    </div>

                    {/* Step Card */}
                    <div className="flex-1 pb-4">
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 px-2 py-0.5 rounded-md">
                              {st.badge}
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                              {st.actor}
                            </span>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.statusColor}`}
                          >
                            {st.statusTag}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {st.title}
                        </h3>

                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {st.description}
                        </p>

                        {isPending && (
                          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/60 p-2 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                            <Clock className="w-4 h-4 shrink-0 text-amber-500" />
                            <span>Status stays Pending until hospital staff confirms bed availability.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SAFETY, HELPLINE & REALITY DISCLOSURE CALLOUT */}
          <div className="mt-8 pt-6 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/50 p-4 sm:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Transparent Emergency Coordination & National Helplines
                </p>
                <p className="leading-relaxed">
                  CareSetu coordinates hospital alerts and patient health summaries in real time. Hospital acceptance requires active staff confirmation. If you require immediate government emergency services, you can always dial <strong className="text-rose-600 dark:text-rose-400 font-bold">108</strong> (Ambulance) or <strong className="text-rose-600 dark:text-rose-400 font-bold">112</strong> (National Emergency Helpline) directly from the platform.
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <a
                href="tel:108"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" /> Call 108
              </a>
              <a
                href="tel:112"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" /> Call 112
              </a>
            </div>
          </div>
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

            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Built for hospitals under pressure
            </h2>

            <p className="text-slate-300 text-base leading-relaxed">
              Review incoming emergency cases with full AI triage context,
              accept or reject in one tap, and maintain live bed, ICU, and
              specialist availability for the entire regional network.
            </p>

            <div className="pt-2">
              <Link to="/register?role=hospital">
                <Button
                  variant="primary"
                  size="lg"
                  className="shadow-lg shadow-sky-500/30"
                >
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

                <p className="text-sm font-semibold text-slate-100">
                  {featureText}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PEOPLE BEHIND CARESETU / OUR TEAM SECTION */}
      <section
        id="team"
        className="max-w-7xl mx-auto px-5 sm:px-8 py-20 lg:py-24 border-t border-slate-200/80 dark:border-slate-800 transition-colors"
        aria-labelledby="our-team-heading"
      >
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold uppercase tracking-wider mb-4 shadow-xs">
            <Users className="w-3.5 h-3.5" />
            <span>People Behind CareSetu</span>
          </div>

          <h2
            id="our-team-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight"
          >
            Meet the Builders of CareSetu
          </h2>

          <p className="mt-4 text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed">
            A multidisciplinary engineering team combining distributed systems, clinical AI triage,
            accessible UI/UX, and healthcare domain research to connect patients and hospitals when every second counts.
          </p>
        </div>

        {/* 6-member responsive grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="group relative flex flex-col h-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-300 overflow-hidden"
            >
              {/* Identical Portrait Container across all 6 cards */}
              <div className="relative w-full aspect-[4/5] overflow-hidden bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center">
                <img
                  src={member.photo}
                  alt={`${member.name} - ${member.role}`}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const fallback = target.nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "flex";
                  }}
                  className={`w-full h-full ${member.imageFit || "object-cover"} transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none ${member.imagePosition}`}
                />
                <div
                  style={{ display: "none" }}
                  className="w-full h-full flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 dark:from-sky-950/40 dark:to-slate-800 text-slate-400"
                  aria-hidden="true"
                >
                  <User className="w-16 h-16 stroke-[1.5] text-sky-400 mb-2" />
                  <span className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                    {member.name}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex flex-col flex-1">
                {/* 2. Member Name directly below photograph */}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    {member.name}
                  </h3>
                </div>

                {/* 3. Role Badge below the name */}
                <div className="mt-2.5 mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse motion-reduce:animate-none" />
                    {member.badge}
                  </span>
                  {member.role !== member.badge && (
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      • {member.role}
                    </span>
                  )}
                </div>

                {/* 4. Responsibilities and Skills below the role */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                  {member.responsibilities}
                </p>

                {/* Tags / Focus Skills */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                  {member.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center relative">
        <div className="space-y-4">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Every second is coordinated.
          </h2>

          <p className="text-slate-600 dark:text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
            Join the network connecting patients, hospitals, and emergency
            doctors when every second counts.
          </p>

          <div className="flex flex-wrap justify-center items-center gap-4 pt-6">
            <button
              type="button"
              onClick={handleEmergencyClick}
              disabled={loadingAction === "emergency"}
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-base shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              <Zap className="w-5 h-5" />

              <span>
                {loadingAction === "emergency"
                  ? "Initializing..."
                  : "Report Emergency"}
              </span>
            </button>

            <Link to="/register">
              <Button
                variant="outline"
                size="lg"
                className="px-7 py-4 rounded-2xl"
              >
                Create An Account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
