import { useState } from "react";
import { Link } from "react-router-dom";
import { patients } from "../../data/patients";
import { Card } from "../../components/common/Card";
import { SearchInput } from "../../components/common/Input";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export function DoctorPatientsPage() {
  const [query, setQuery] = useState("");
  const filtered = patients.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <SearchInput placeholder="Search patients..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id}>
            <p className="font-semibold text-navy">{p.name}</p>
            <p className="text-xs text-text-secondary mt-1">{p.age} yrs · {p.gender} · {p.bloodGroup}</p>
            <p className="text-xs text-text-secondary mt-2">{p.conditions.join(", ") || "No chronic conditions"}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DoctorHealthPackPage() {
  const { showToast } = useToast();
  const sections = ["Medical History", "Allergies", "Medications", "Emergency Contacts", "Reports", "Prescriptions"];
  return (
    <Card className="max-w-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-lightblue flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-navy-dark" />
        </div>
        <div>
          <p className="font-bold text-navy">Health Pack</p>
          <p className="text-xs text-text-secondary">Encrypted · Consent Granted · Access Logged</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => showToast("info", `${s} accessed — action logged.`)}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-100 text-sm font-medium text-navy hover:border-sky text-left"
          >
            {s} <CheckCircle2 className="w-4 h-4 text-success" />
          </button>
        ))}
      </div>
    </Card>
  );
}

export function DoctorClinicalNotesPage() {
  const { showToast } = useToast();
  return (
    <Card className="max-w-xl">
      <p className="font-semibold text-navy text-sm mb-1">Diagnosis notes</p>
      <textarea rows={3} placeholder="Add diagnosis note" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm mb-4 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none" />
      <p className="font-semibold text-navy text-sm mb-1">Treatment notes</p>
      <textarea rows={3} placeholder="Add treatment note" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm mb-4 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none" />
      <p className="font-semibold text-navy text-sm mb-1">Follow-up steps</p>
      <textarea rows={2} placeholder="Add follow-up steps" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm mb-5 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none" />
      <Button variant="primary" onClick={() => showToast("success", "Clinical notes saved.")}>Save notes</Button>
    </Card>
  );
}

export function DoctorReportsPage() {
  const items = [
    { label: "Cases handled this month", value: "42" },
    { label: "Average time to diagnosis", value: "6.4 min" },
    { label: "Critical case survival follow-through", value: "98%" },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {items.map((i) => (
        <Card key={i.label} className="text-center">
          <p className="text-2xl font-extrabold text-navy">{i.value}</p>
          <p className="text-xs text-text-secondary mt-1">{i.label}</p>
        </Card>
      ))}
    </div>
  );
}

export function DoctorSettingsPage() {
  return (
    <Card className="max-w-lg">
      <p className="font-semibold text-navy text-sm mb-3">Availability</p>
      {["On duty for new critical cases", "Notify me for AI-flagged cases", "Share notes with hospital admin"].map((s) => (
        <label key={s} className="flex items-center justify-between py-2 text-sm text-navy">
          {s}
          <input type="checkbox" defaultChecked className="w-4 h-4 accent-sky" />
        </label>
      ))}
    </Card>
  );
}
