import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BrainCircuit, ShieldCheck } from "lucide-react";
import { emergencies } from "../../data/emergencies";
import { patients } from "../../data/patients";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import { ErrorState, EmptyState } from "../../components/common/States";
import { useToast } from "../../components/common/Toast";
import { ClipboardList } from "lucide-react";

export function DoctorCasesPage() {
  const navigate = useNavigate();
  const assigned = emergencies.filter((e) => ["HospitalAssigned", "Transfer", "Treatment", "Completed"].includes(e.stage));

  if (assigned.length === 0) return <EmptyState icon={ClipboardList} title="No cases assigned" message="Assigned emergency cases will appear here." />;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {assigned.map((c) => (
        <div key={c.id} onClick={() => navigate(`/doctor/cases/${c.id}`)} className="cursor-pointer">
          <EmergencyCaseCard emergencyCase={c} />
        </div>
      ))}
    </div>
  );
}

export function DoctorCaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const c = emergencies.find((e) => e.id === id);
  const patient = patients.find((p) => p.id === c?.patientId);
  const [aiOpen, setAiOpen] = useState(true);

  if (!c || !patient) return <ErrorState title="Case not found" onRetry={() => navigate("/doctor/cases")} />;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-navy text-lg">{patient.name}</h2>
            <p className="text-xs text-text-secondary">{patient.age} · {patient.gender} · {patient.bloodGroup}</p>
          </div>
          <Badge tone={c.severity === "Critical" ? "critical" : c.severity === "Urgent" ? "urgent" : "stable"}>{c.severity}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div><p className="text-xs text-text-secondary">Symptoms</p><p className="font-semibold text-navy">{c.symptoms}</p></div>
          <div><p className="text-xs text-text-secondary">Required capability</p><p className="font-semibold text-navy">{c.requiredCapability}</p></div>
          <div><p className="text-xs text-text-secondary">Allergies</p><p className="font-semibold text-navy">{patient.allergies.join(", ") || "None reported"}</p></div>
          <div><p className="text-xs text-text-secondary">Medications</p><p className="font-semibold text-navy">{patient.medications.join(", ") || "None"}</p></div>
        </div>

        <Button variant="outline" icon={<ShieldCheck className="w-4 h-4" />} onClick={() => showToast("info", "Health Pack accessed — action logged.")}>
          Access Health Pack
        </Button>
      </Card>

      {aiOpen && (
        <Card className="border border-lightblue bg-paleblue">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit className="w-4.5 h-4.5 text-sky" />
            <p className="font-bold text-navy text-sm">AI Suggested Summary</p>
            <Badge tone="accent">Doctor review required</Badge>
          </div>
          <p className="text-sm text-text mb-4">
            Patient presents with {c.symptoms.toLowerCase()}. Findings are consistent with a {c.requiredCapability.toLowerCase()} case.
            Recommend prioritizing vitals monitoring and cross-checking allergy history before treatment.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAiOpen(false)}>Dismiss</Button>
            <Button variant="ghost" size="sm">Edit</Button>
            <Button variant="primary" size="sm" onClick={() => showToast("success", "AI summary accepted and added to clinical notes.")}>
              Accept
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
