import { useState, useEffect } from "react";
import { Phone, MapPin, Users, Building2, ShieldCheck, BarChart3, Wifi, BrainCircuit } from "lucide-react";
import { Card } from "../../components/common/Card";
import { Input } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";

const featureList = [
  { icon: Users, title: "User Management", desc: "Role-based accounts for patients, hospitals, doctors, and admins with tailored onboarding." },
  { icon: Phone, title: "Emergency SOS + AI", desc: "One-tap emergency reporting with hold-to-confirm and AI-assisted case structuring." },
  { icon: MapPin, title: "Smart Hospital Matching + GIS", desc: "Progressive radius search matched against real-time capability and capacity data." },
  { icon: ShieldCheck, title: "Secure Health Pack", desc: "Encrypted, consent-based sharing of medical history, documents, and prescriptions." },
  { icon: BarChart3, title: "Admin Dashboard", desc: "Network-wide analytics on emergency volume, response time, and hospital performance." },
  { icon: Wifi, title: "Offline-First Support", desc: "Emergency information stays available and syncs automatically when connectivity returns." },
];

export function FeaturesPage() {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
      <div className="max-w-xl mb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy">Everything CareSetu coordinates</h1>
        <p className="text-text-secondary mt-3">A modern feature set built around one goal: get the right patient to the right hospital as fast as possible.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {featureList.map((f) => (
          <Card key={f.title}>
            <div className="w-11 h-11 rounded-xl bg-lightblue flex items-center justify-center mb-4">
              <f.icon className="w-5 h-5 text-navy-dark" />
            </div>
            <h3 className="font-bold text-navy">{f.title}</h3>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">{f.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-navy mb-3">Modern product story</h1>
      <p className="text-text-secondary max-w-lg mb-12">CareSetu is a bridge between a patient in crisis and the right healthcare outcome.</p>

      <div className="grid sm:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-navy mb-2">The problem</h3>
          <p className="text-sm text-text-secondary leading-relaxed">During emergencies, patients and families lose critical minutes deciding where to go, whether a hospital has capacity, and whether it can treat their specific condition.</p>
        </Card>
        <Card>
          <h3 className="font-bold text-navy mb-2">The solution</h3>
          <p className="text-sm text-text-secondary leading-relaxed">CareSetu automates hospital matching using live capability and capacity data, so the decision happens in seconds, not minutes.</p>
        </Card>
        <Card>
          <h3 className="font-bold text-navy mb-2">Our mission</h3>
          <p className="text-sm text-text-secondary leading-relaxed">Make sure every patient reaches care that matches their condition — the first time, without detours.</p>
        </Card>
        <Card>
          <h3 className="font-bold text-navy mb-2">Healthcare ecosystem</h3>
          <p className="text-sm text-text-secondary leading-relaxed">We connect patients, hospitals, doctors, and administrators on one coordinated, consent-driven platform.</p>
        </Card>
      </div>
    </div>
  );
}

export function ContactPage() {
  const { showToast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (isOffline) {
      // Phase 10: Queue non-sensitive support request offline
      const operationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      try {
        const { putRecord } = await import("../../utils/offlineDB");
        await putRecord("contact_queue", {
          operationId,
          category: "GENERAL_SUPPORT",
          message: `[From ${form.firstName} ${form.lastName}] ${form.message}`,
          email: form.email,
          createdAt: new Date().toISOString(),
          expiresAt,
          syncStatus: "PENDING_SYNC",
          retryCount: 0,
        });

        setQueuedOffline(true);
        showToast("info", "Your support request is saved locally and will submit automatically when online.");
      } catch (err) {
        console.error("Failed to queue offline contact request:", err);
        showToast("error", "Failed to save offline support request.");
      }
    } else {
      setSubmitted(true);
      showToast("success", "Your message has been sent to CareSetu Support.");
    }
  };

  return (
    <div className="max-w-xl mx-auto px-5 sm:px-8 py-16">
      <h1 className="text-3xl font-extrabold text-navy mb-2">Healthcare support</h1>
      <p className="text-text-secondary mb-8">Questions about onboarding your hospital or the CareSetu platform? Send us a message.</p>

      <Card>
        {queuedOffline ? (
          <div className="text-center py-6">
            <Wifi className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <p className="font-bold text-navy">Saved Locally (Offline Mode)</p>
            <p className="text-sm text-text-secondary mt-1">
              Your support request is saved and will be submitted when you're online.
            </p>
          </div>
        ) : submitted ? (
          <div className="text-center py-6">
            <ShieldCheck className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="font-bold text-navy">Message sent</p>
            <p className="text-sm text-text-secondary mt-1">Our team will reach out within one business day.</p>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                placeholder="First name"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
              <Input
                label="Last name"
                placeholder="Last name"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div>
              <label className="block text-sm font-semibold text-navy mb-1.5">Message</label>
              <textarea
                required
                rows={4}
                placeholder="How can we help?"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none"
              />
            </div>
            <Button type="submit" variant="primary" fullWidth>
              Send message
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export function HelpPage() {
  const [faqs, setFaqs] = useState<Array<{ id: string; category: string; question: string; answer: string; version: string }>>([
    {
      id: "faq-1",
      category: "Emergency SOS",
      question: "How does Offline SOS work?",
      answer: "When offline, your emergency request is safely captured locally on your device with GPS coordinates and marked PENDING_SYNC. It automatically submits as soon as network connection is restored.",
      version: "1.0",
    },
    {
      id: "faq-2",
      category: "Doctor AI",
      question: "Can Doctor AI diagnose medical conditions offline?",
      answer: "Live AI analysis requires internet connection. When offline, Doctor AI displays offline guidance and detects emergency red-flags locally so you can request help immediately.",
      version: "1.0",
    },
    {
      id: "faq-3",
      category: "HealthPack & Privacy",
      question: "Are my medical documents stored offline?",
      answer: "No. To protect your medical privacy, sensitive medical documents and full HealthPack records are network-only and are never cached locally without explicit authorization.",
      version: "1.0",
    },
    {
      id: "faq-4",
      category: "Hospital Matching",
      question: "Are hospital availability numbers live when offline?",
      answer: "Cached hospital info shows public addresses and emergency phone numbers. Live bed capacity and active matching require real-time server revalidation.",
      version: "1.0",
    },
  ]);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    // Cache FAQs into IndexedDB help_content store
    import("../../utils/offlineDB").then(({ putRecord, getAllRecords }) => {
      if (navigator.onLine) {
        faqs.forEach((faq) => {
          putRecord("help_content", {
            ...faq,
            cachedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }).catch(console.warn);
        });
      } else {
        getAllRecords<any>("help_content").then((cached) => {
          if (cached && cached.length > 0) {
            setFaqs(cached);
          }
        }).catch(console.warn);
      }
    });

    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
      <h1 className="text-3xl font-extrabold text-navy mb-2">CareSetu Help Center & FAQs</h1>
      <p className="text-text-secondary mb-6">
        {isOffline ? "Offline Mode: Showing cached emergency & app usage FAQs." : "Frequently asked questions and emergency guidance."}
      </p>

      {isOffline && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-center gap-2.5">
          <Wifi className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Showing cached help content. Connect to the internet to get live updates.</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {faqs.map((faq) => (
          <Card key={faq.id}>
            <span className="text-[11px] font-bold text-sky uppercase tracking-wider">{faq.category}</span>
            <h3 className="font-bold text-navy text-base mt-1">{faq.question}</h3>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">{faq.answer}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

