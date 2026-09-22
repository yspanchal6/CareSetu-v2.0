import { Link, useNavigate } from "react-router-dom";
import { Phone, MapPin, BrainCircuit, Search, CheckCircle2, Ambulance, ShieldCheck, ArrowRight, Building2, Users, Clock, TrendingUp, User, Stethoscope } from "lucide-react";
import Button from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

const journeySteps = [
  { icon: Phone, label: "Report Emergency" },
  { icon: MapPin, label: "Capture Location" },
  { icon: BrainCircuit, label: "AI Case Structuring" },
  { icon: Search, label: "Find Hospital" },
  { icon: CheckCircle2, label: "Hospital Accepts" },
  { icon: Ambulance, label: "Patient Transfer" },
];

const features = [
  { icon: Phone, title: "Emergency SOS + AI", desc: "One press starts a guided emergency report, structured instantly by AI for faster hospital response." },
  { icon: MapPin, title: "Smart Hospital Matching", desc: "Matches patients to hospitals by distance, bed and ICU availability, and required specialist capability." },
  { icon: ShieldCheck, title: "Secure Health Pack", desc: "Encrypted medical history shared only with consent, so every hospital sees what it needs and nothing more." },
];

const stats = [
  { icon: Building2, value: "480+", label: "Connected hospitals" },
  { icon: Clock, value: "2.3 min", label: "Average match time" },
  { icon: Users, value: "12,000+", label: "Cases coordinated" },
  { icon: TrendingUp, value: "94%", label: "Acceptance rate" },
];

const signupRoles = [
  { role: "patient", icon: User, title: "Sign up as Patient", desc: "Get matched with the right hospital and access Doctor AI during emergencies." },
  { role: "doctor", icon: Stethoscope, title: "Sign up as Doctor", desc: "Review assigned patients, AI case summaries, and coordinate treatment." },
  { role: "admin", icon: ShieldCheck, title: "Sign up as Admin", desc: "Oversee the CareSetu network, hospitals, and system health." },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, startGuestSession } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

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
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-paleblue to-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-lightblue text-navy-dark mb-5">
              Emergency care coordination
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-navy leading-[1.08] tracking-tight">
              Right Care.
              <br />
              Right Time.
              <br />
              Right Place.
            </h1>
            <p className="text-text-secondary mt-5 text-base sm:text-lg max-w-lg leading-relaxed">
              CareSetu connects patients with the right healthcare facility during emergencies using intelligent hospital matching, secure health information sharing, and AI-assisted coordination.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Button
                variant="danger"
                size="lg"
                icon={<Phone className="w-4.5 h-4.5" />}
                onClick={handleEmergencyClick}
                disabled={loadingAction === "emergency"}
              >
                {loadingAction === "emergency" ? "Initializing Guest SOS..." : "Report Emergency"}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                icon={<BrainCircuit className="w-4.5 h-4.5" />}
                onClick={handleDoctorAiClick}
                disabled={loadingAction === "doctor-ai"}
              >
                {loadingAction === "doctor-ai" ? "Starting Doctor AI..." : "Doctor AI"}
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-8 text-sm font-semibold text-text-secondary flex-wrap">
              <span className="text-navy">Patient</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="text-emergency">Emergency</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="text-navy">Smart Matching</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="text-navy">Hospital</span>
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="text-navy">Doctor</span>
            </div>
          </div>

          <div className="relative aspect-square max-w-md mx-auto w-full">
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-sky/30 animate-[spin_60s_linear_infinite]" />
            {journeySteps.map((s, i) => {
              const angle = (i / journeySteps.length) * 2 * Math.PI - Math.PI / 2;
              const r = 42;
              const x = 50 + r * Math.cos(angle);
              const y = 50 + r * Math.sin(angle);
              return (
                <div
                  key={s.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-card border border-slate-100 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-sky" />
                  </div>
                  <span className="text-[10px] font-semibold text-navy text-center w-20">{s.label}</span>
                </div>
              );
            })}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-emergency flex items-center justify-center shadow-xl">
              <Ambulance className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-6 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="text-center">
              <s.icon className="w-5 h-5 text-sky mx-auto mb-2" />
              <p className="text-xl font-extrabold text-navy">{s.value}</p>
              <p className="text-xs text-text-secondary mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="max-w-xl mb-10">
          <h2 className="text-3xl font-extrabold text-navy">Get started on CareSetu</h2>
          <p className="text-text-secondary mt-3">Create an account tailored to your role in the emergency care network.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {signupRoles.map((r) => (
            <Card key={r.role} className="flex flex-col hover:shadow-lg transition-shadow">
              <div className="w-11 h-11 rounded-xl bg-lightblue flex items-center justify-center mb-4">
                <r.icon className="w-5 h-5 text-navy-dark" />
              </div>
              <h3 className="font-bold text-navy">{r.title}</h3>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed flex-1">{r.desc}</p>
              <Link to={`/register?role=${r.role}`} className="mt-5">
                <Button variant="outline" size="sm" fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                  Continue
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <div className="max-w-xl mb-12">
          <h2 className="text-3xl font-extrabold text-navy">How CareSetu works</h2>
          <p className="text-text-secondary mt-3">Three connected capabilities move a patient from crisis to treatment with as little friction as possible.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title} className="hover:shadow-lg transition-shadow">
              <div className="w-11 h-11 rounded-xl bg-lightblue flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-navy-dark" />
              </div>
              <h3 className="font-bold text-navy">{f.title}</h3>
              <p className="text-sm text-text-secondary mt-2 leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-navy py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-white">Built for hospitals under pressure</h2>
            <p className="text-white/60 mt-3 leading-relaxed max-w-md">
              Review incoming cases with full context, accept or reject in one tap, and keep every bed, ICU slot and specialist status current for the network.
            </p>
            <Link to="/register">
              <Button variant="primary" size="lg" className="mt-6">
                Register your hospital
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {["Real-time capacity", "AI-suggested matching", "Consent-based records", "Audit-ready logs"].map((t) => (
              <div key={t} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <CheckCircle2 className="w-4.5 h-4.5 text-sky mb-2" />
                <p className="text-sm font-medium text-white">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-24 text-center">
        <h2 className="text-3xl font-extrabold text-navy">Every second is coordinated.</h2>
        <p className="text-text-secondary mt-3 max-w-lg mx-auto">Join the network connecting patients, hospitals, and doctors when it matters most.</p>
        <div className="flex justify-center gap-3 mt-8">
          <Button variant="danger" size="lg" onClick={handleEmergencyClick} disabled={loadingAction === "emergency"}>
            {loadingAction === "emergency" ? "Initializing Guest SOS..." : "Report Emergency"}
          </Button>
          <Link to="/register">
            <Button variant="outline" size="lg">Create an account</Button>
          </Link>
        </div>
      </section>
    </>
  );
}
