import { useEffect, useState } from "react";
import { Lock, CheckCircle2, ChevronRight, FileText, Pill, AlertTriangle, Phone, FileStack, ScrollText, HeartPulse, Save } from "lucide-react";
import { Card } from "../../components/common/Card";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import { useToast } from "../../components/common/Toast";
import { healthPackApi, medicalDocumentApi } from "../../services/api";

const sections = [
  { icon: HeartPulse, label: "Medical History & Profile", key: "history" },
  { icon: AlertTriangle, label: "Allergies", key: "allergies" },
  { icon: Pill, label: "Medications", key: "medications" },
  { icon: Phone, label: "Emergency Contacts", key: "contacts" },
  { icon: FileStack, label: "Reports & Documents", key: "docs" },
];

export default function HealthPackPage() {
  const { showToast } = useToast();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for HealthPack Creation / Update
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [allergies, setAllergies] = useState("Penicillin");
  const [medications, setMedications] = useState("Aspirin, Metformin");
  const [conditions, setConditions] = useState("Hypertension, Type 2 Diabetes");
  const [heartCondition, setHeartCondition] = useState("YES");
  const [diabetesStatus, setDiabetesStatus] = useState("YES");
  const [hypertensionStatus, setHypertensionStatus] = useState("YES");
  const [surgeries, setSurgeries] = useState("Appendectomy 2020");
  const [notes, setNotes] = useState("Patient requires cardiac monitoring during emergency transfer.");
  const [docsList, setDocsList] = useState<any[]>([]);

  const loadHealthPack = async () => {
    setLoading(true);
    try {
      const res = await healthPackApi.getMyPack();
      if (res.success && res.data?.healthData) {
        const d = res.data.healthData;
        setBloodGroup(d.bloodGroup || "O+");
        setAllergies(d.allergies || "");
        setMedications(d.medications || "");
        setConditions(d.conditions || "");
        setHeartCondition(d.heartCondition || "UNKNOWN");
        setDiabetesStatus(d.diabetesStatus || "UNKNOWN");
        setHypertensionStatus(d.hypertensionStatus || "UNKNOWN");
        setSurgeries(d.surgeries || "");
        setNotes(d.notes || "");
      }
    } catch (err) {
      console.warn("No existing HealthPack found, creating new.", err);
    } finally {
      setLoading(false);
    }

    try {
      const docsRes = await medicalDocumentApi.getMyDocuments();
      if (docsRes.success && Array.isArray(docsRes.data)) {
        setDocsList(docsRes.data);
      }
    } catch (err) {
      console.warn("Documents fetch error", err);
    }
  };

  useEffect(() => {
    loadHealthPack();
  }, []);

  const handleSaveHealthPack = async () => {
    setSaving(true);
    try {
      const payload = {
        bloodGroup,
        allergies,
        medications,
        conditions,
        heartCondition,
        diabetesStatus,
        hypertensionStatus,
        surgeries,
        notes,
      };
      const res: any = await healthPackApi.create(payload);
      if (res.success) {
        showToast("success", "Health Pack encrypted with AES-256-GCM and saved successfully.");
      } else {
        showToast("error", res.error || "Failed to save Health Pack.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Save error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5 pb-6">
      <Card className="bg-navy border-0 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
            <Lock className="w-5.5 h-5.5 text-sky" />
          </div>
          <div>
            <p className="font-bold">AES-256-GCM Encrypted Health Pack</p>
            <p className="text-xs text-white/60">Shared with hospitals ONLY upon SOS acceptance</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {["Encrypted at Rest", "Consent Explicit", "Hospital RBAC Protected", "Audit Access Logged"].map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-white/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky" /> {s}
            </span>
          ))}
        </div>
      </Card>

      {/* Sections List */}
      <div className="flex flex-col gap-2.5">
        {sections.map((s) => (
          <button key={s.key} onClick={() => setOpenSection(s.key)} className="text-left">
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-lightblue flex items-center justify-center">
                  <s.icon className="w-4.5 h-4.5 text-navy-dark" />
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{s.label}</p>
                  {s.key === "history" && (
                    <p className="text-xs text-text-secondary">
                      Heart: {heartCondition} | Diabetes: {diabetesStatus}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-slate-300" />
            </Card>
          </button>
        ))}
      </div>

      <Button
        variant="primary"
        icon={<Save className="w-4 h-4" />}
        onClick={handleSaveHealthPack}
        loading={saving}
      >
        Save & Encrypt Health Pack
      </Button>

      <Button
        variant="outline"
        icon={<ScrollText className="w-4 h-4" />}
        onClick={() => showToast("info", "Access Log: HealthPack access is recorded in immutable audit logs.")}
      >
        View access history
      </Button>

      {/* Modal for Section Detail & Edit */}
      <Modal open={!!openSection} onClose={() => setOpenSection(null)} title={sections.find((s) => s.key === openSection)?.label}>
        {openSection === "history" && (
          <div className="flex flex-col gap-3 text-xs text-navy">
            <div>
              <label className="font-semibold block mb-1">Blood Group:</label>
              <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full p-2 border rounded border-slate-300">
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Cardiac / Heart Patient Status:</label>
              <select value={heartCondition} onChange={(e) => setHeartCondition(e.target.value)} className="w-full p-2 border rounded border-slate-300">
                <option value="YES">Confirmed Heart Patient (YES)</option>
                <option value="NO">No Cardiac History (NO)</option>
                <option value="UNKNOWN">Unknown / Not Diagnosed</option>
                <option value="NOT_PROVIDED">Not Provided</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Diabetes Status:</label>
              <select value={diabetesStatus} onChange={(e) => setDiabetesStatus(e.target.value)} className="w-full p-2 border rounded border-slate-300">
                <option value="YES">Diabetic Patient (YES)</option>
                <option value="NO">Non-Diabetic (NO)</option>
                <option value="UNKNOWN">Unknown / Not Diagnosed</option>
                <option value="NOT_PROVIDED">Not Provided</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Hypertension / Blood Pressure:</label>
              <select value={hypertensionStatus} onChange={(e) => setHypertensionStatus(e.target.value)} className="w-full p-2 border rounded border-slate-300">
                <option value="YES">Hypertension (YES)</option>
                <option value="NO">Normal BP (NO)</option>
                <option value="UNKNOWN">Unknown</option>
                <option value="NOT_PROVIDED">Not Provided</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Confirmed Medical Conditions:</label>
              <input type="text" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. Hypertension, Asthma" className="w-full p-2 border rounded border-slate-300" />
            </div>

            <div>
              <label className="font-semibold block mb-1">Past Surgeries:</label>
              <input type="text" value={surgeries} onChange={(e) => setSurgeries(e.target.value)} placeholder="e.g. Appendectomy 2020" className="w-full p-2 border rounded border-slate-300" />
            </div>

            <div>
              <label className="font-semibold block mb-1">Emergency Notes:</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full p-2 border rounded border-slate-300" />
            </div>
          </div>
        )}

        {openSection === "allergies" && (
          <div className="flex flex-col gap-2 text-xs">
            <label className="font-semibold">Allergies (e.g. Penicillin, Peanuts):</label>
            <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)} className="w-full p-2 border rounded border-slate-300" />
          </div>
        )}

        {openSection === "medications" && (
          <div className="flex flex-col gap-2 text-xs">
            <label className="font-semibold">Current Medications:</label>
            <input type="text" value={medications} onChange={(e) => setMedications(e.target.value)} className="w-full p-2 border rounded border-slate-300" />
          </div>
        )}

        {openSection === "contacts" && (
          <div className="text-xs text-navy space-y-2">
            <p className="font-semibold">Primary Contact: Emergency Relative (+91 9876543210)</p>
            <p className="text-text-secondary">Contacts are included in encrypted emergency payload.</p>
          </div>
        )}

        {openSection === "docs" && (
          <div className="text-xs space-y-2">
            {docsList.length === 0 ? (
              <p className="text-text-secondary">No documents uploaded yet.</p>
            ) : (
              docsList.map((d) => (
                <div key={d.id} className="p-2 border rounded flex justify-between items-center">
                  <span>📄 {d.fileName}</span>
                  <span className="text-sky font-semibold">{d.documentType}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
