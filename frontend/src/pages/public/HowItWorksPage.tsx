import { Phone, MapPin, BrainCircuit, HeartPulse, Search, CheckCircle2, ShieldCheck, Ambulance, Stethoscope, ClipboardCheck } from "lucide-react";

const timeline = [
  { icon: Phone, title: "Report Emergency", desc: "Patient or caregiver presses SOS. A hold-to-confirm gesture prevents accidental triggers." },
  { icon: MapPin, title: "Capture Location", desc: "GPS location is captured automatically and shared with the response network." },
  { icon: BrainCircuit, title: "AI Case Structuring", desc: "Reported symptoms are structured into a clinical summary for faster hospital triage." },
  { icon: HeartPulse, title: "Identify Required Capability", desc: "The system determines the healthcare capability needed — cardiac care, trauma, ICU, and more." },
  { icon: Search, title: "Find Hospital", desc: "Progressive search expands outward — 2 km, 4 km, 8 km — until a suitable hospital is found." },
  { icon: CheckCircle2, title: "Hospital Accepts", desc: "The matched hospital reviews the case and accepts, confirming bed, ICU and specialist availability." },
  { icon: ShieldCheck, title: "Secure Health Pack", desc: "Encrypted medical history is shared with the hospital under explicit patient consent." },
  { icon: Ambulance, title: "Patient Transfer", desc: "Transfer begins with live tracking so the patient, hospital, and family stay informed." },
  { icon: Stethoscope, title: "Treatment", desc: "The care team begins treatment with full context — allergies, history, medications." },
  { icon: ClipboardCheck, title: "Case Completed", desc: "The case is closed, and a summary is logged to the patient's Health Pack." },
];

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
      <div className="text-center mb-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy">A beautiful visual timeline</h1>
        <p className="text-text-secondary mt-3">From the first tap on SOS to a completed case, here is exactly what happens at every step.</p>
      </div>

      <div className="relative pl-10">
        <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-200" />
        <div className="flex flex-col gap-10">
          {timeline.map((t, i) => (
            <div key={t.title} className="relative">
              <div className="absolute -left-10 w-10 h-10 rounded-full bg-sky text-white flex items-center justify-center shadow-md">
                <t.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-xs font-bold text-sky mb-1">STEP {String(i + 1).padStart(2, "0")}</p>
              <h3 className="font-bold text-navy text-lg">{t.title}</h3>
              <p className="text-sm text-text-secondary mt-1.5 leading-relaxed max-w-md">{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
