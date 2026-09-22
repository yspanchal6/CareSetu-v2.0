import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BrainCircuit, RefreshCw, Siren, Lock } from "lucide-react";
import { hospitalApi, emergencyApi } from "../../services/api";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";
import { EmptyState, ErrorState } from "../../components/common/States";

const rejectReasons = ["ICU unavailable", "Bed unavailable", "Specialist unavailable", "Equipment unavailable", "Other"];

const ACTIVE_STATUSES = ["ACCEPTED", "TRANSFER", "TREATMENT", "IN_PROGRESS"];

const statusTone: Record<string, "busy" | "urgent" | "stable"> = {
  ACCEPTED: "urgent",
  TRANSFER: "busy",
  TREATMENT: "urgent",
  IN_PROGRESS: "busy",
  CLOSED: "stable",
};

export function HospitalActiveCasesPage() {
  const { showToast } = useToast();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  // Health Pack Modal State
  const [healthPackModalOpen, setHealthPackModalOpen] = useState(false);
  const [healthPackData, setHealthPackData] = useState<any>(null);
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState("");
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const openDocument = async (documentId: string, fileName: string) => {
    setLoadingDocId(documentId);
    try {
      const token =
        localStorage.getItem("jwt") ||
        localStorage.getItem("caresetu_auth_token") ||
        sessionStorage.getItem("caresetu_auth_token") ||
        sessionStorage.getItem("jwt");

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000/api"}/patient/documents/${documentId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load document (${response.status})`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Open in new tab (viewer) OR download
      const newTab = window.open(url, "_blank");

      // Cleanup URL after 60 seconds
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);

      // Fallback: if popup blocked, trigger download
      if (!newTab) {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName || "document";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error("[Document]", err);
      alert(`Could not open document: ${err.message}`);
    } finally {
      setLoadingDocId(null);
    }
  };

  const openHealthPackModal = async (caseId: string) => {
    setHealthPackModalOpen(true);
    setPackLoading(true);
    setPackError("");
    setHealthPackData(null);
    try {
      const res = await hospitalApi.getHealthPack(caseId);
      if (res.success && res.data) {
        setHealthPackData(res.data);
      } else {
        setPackError("Failed to load Health Pack data.");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Unauthorized access or Health Pack expired.";
      setPackError(msg);
    } finally {
      setPackLoading(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const res = await hospitalApi.getEmergencyCases();
      const rows: any[] = res.cases || [];
      const enriched = await Promise.all(
        rows.map(async (c) => {
          try {
            const st = await emergencyApi.status(c.caseId || c.id);
            return { ...c, ...(st.case || {}), caseId: st.case?.caseId || c.caseId, id: st.case?.id || c.id };
          } catch {
            return null;
          }
        })
      );
      setCases(enriched.filter((c: any): c is any => !!c && ACTIVE_STATUSES.includes(c.status)));
    } catch (err) {
      console.error("[ActiveCases] Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const update = async (caseData: any, status: string) => {
    setBusyCaseId(caseData.caseId);
    try {
      await emergencyApi.updateStatus(caseData.caseId, status);
      showToast("success", status === "TREATMENT" ? `Treatment started for ${caseData.caseId}.` : `Case ${caseData.caseId} closed.`);
      await load();
    } catch (err: any) {
      showToast("error", err.message || "Failed to update case status");
    } finally {
      setBusyCaseId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 mt-4">Loading active cases...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-semibold">{cases.length} active assigned case(s)</p>
        <button onClick={load} className="text-xs text-sky-600 font-semibold flex items-center gap-1 hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {cases.length === 0 ? (
        <EmptyState icon={Siren} title="No active cases" message="Assigned cases awaiting treatment will appear here." />
      ) : (
        cases.map((c) => (
          <Card key={c.caseId || c.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-navy text-base">{c.caseId}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {c.patientName ? `${c.patientName}${c.age ? `, ${c.age}` : ""} · ` : ""}
                  {c.symptoms || "Emergency case"}
                </p>
              </div>
              <Badge tone={statusTone[c.status] || "neutral"}>{c.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-text-secondary">Severity</p>
                <p className="font-semibold text-navy">{c.severity || "—"}</p>
              </div>
              <div>
                <p className="text-text-secondary">Hospital</p>
                <p className="font-semibold text-navy truncate">{c.hospital?.name || "—"}</p>
              </div>
              <div>
                <p className="text-text-secondary">Accepted</p>
                <p className="font-semibold text-navy">{c.acceptedAt ? new Date(c.acceptedAt).toLocaleString() : "—"}</p>
              </div>
              <div>
                <p className="text-text-secondary">Distance</p>
                <p className="font-semibold text-navy">{c.distanceKm ? `${c.distanceKm.toFixed(1)} km` : "—"}</p>
              </div>
            </div>

            {/* Health Pack View Button for Accepted / Active cases */}
            <Button
              variant="outline"
              fullWidth
              onClick={() => openHealthPackModal(c.caseId || c.id)}
              className="border-sky-500 text-sky-700 hover:bg-sky-50 font-semibold flex items-center justify-center gap-2"
            >
              🔒 View Health Pack
            </Button>

            <div className="flex gap-2">
              {c.status === "TRANSFER" && (
                <Button variant="success" fullWidth disabled={busyCaseId === c.caseId} onClick={() => update(c, "TREATMENT")}>
                  {busyCaseId === c.caseId ? "Updating..." : "Mark Treatment Started"}
                </Button>
              )}
              {c.status === "TREATMENT" && (
                <Button variant="success" fullWidth disabled={busyCaseId === c.caseId} onClick={() => update(c, "CLOSED")}>
                  {busyCaseId === c.caseId ? "Updating..." : "Close Case"}
                </Button>
              )}
            </div>
          </Card>
        ))
      )}

      {/* HEALTH PACK MODAL */}
      {healthPackModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* HEADER */}
            <div className="p-4 bg-sky-600 text-white rounded-t-2xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                  🔒
                </div>
                <div>
                  <h2 className="font-bold text-lg">Secure Patient Health Pack</h2>
                  <p className="text-xs opacity-90">
                    {healthPackData?.expiresAt
                      ? `Access expires: ${new Date(healthPackData.expiresAt).toLocaleString()}`
                      : "Encrypted & Access Audited"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHealthPackModalOpen(false)}
                className="text-white/80 hover:text-white font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            {/* BODY */}
            <div className="p-6 space-y-5">
              {packLoading && (
                <div className="py-12 text-center">
                  <div className="inline-block w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-500 mt-3">Decrypting Health Pack with AES-256-GCM...</p>
                </div>
              )}

              {packError && !packLoading && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  <p className="font-bold">Access Control Error</p>
                  <p className="text-xs mt-1">{packError}</p>
                </div>
              )}

              {healthPackData && !packLoading && (
                <>
                  {/* PATIENT PROFILE */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      Patient Profile
                    </h3>
                    <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-bold text-navy">{healthPackData.healthData?.name || "Emergency Patient"}</p>
                        <p className="text-xs text-slate-600">
                          Patient ID: {healthPackData.patientId}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-sky-100 text-sky-800 rounded-full">
                        Consent Active
                      </span>
                    </div>
                  </div>

                  {/* CRITICAL INFO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50/60 p-3 rounded-lg border border-red-100">
                      <h3 className="text-xs font-semibold text-red-600 uppercase mb-1">
                        🩸 Blood Group
                      </h3>
                      <p className="text-xl font-extrabold text-red-700">
                        {healthPackData.healthData?.bloodGroup || "Not provided"}
                      </p>
                    </div>
                    <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100">
                      <h3 className="text-xs font-semibold text-amber-700 uppercase mb-1">
                        ⚠️ Allergies
                      </h3>
                      <p className="text-sm font-semibold text-amber-900">
                        {healthPackData.healthData?.allergies || "None reported"}
                      </p>
                    </div>
                  </div>

                  {/* MEDICATIONS */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      💊 Current Medications
                    </h3>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {healthPackData.healthData?.medications || "None reported"}
                    </p>
                  </div>

                  {/* CONDITIONS */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      🩺 Confirmed Medical Conditions & History
                    </h3>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-800">
                      <p><strong>Heart / Cardiac Status:</strong> {healthPackData.healthData?.heartCondition || "UNKNOWN"}</p>
                      <p><strong>Diabetes Status:</strong> {healthPackData.healthData?.diabetesStatus || "UNKNOWN"}</p>
                      <p><strong>Hypertension Status:</strong> {healthPackData.healthData?.hypertensionStatus || "UNKNOWN"}</p>
                      <p><strong>Confirmed Conditions:</strong> {healthPackData.healthData?.conditions || "None reported"}</p>
                      {healthPackData.healthData?.surgeries && <p><strong>Surgeries:</strong> {healthPackData.healthData?.surgeries}</p>}
                      {healthPackData.healthData?.notes && <p><strong>Emergency Notes:</strong> {healthPackData.healthData?.notes}</p>}
                    </div>
                  </div>

                  {/* ATTACHED REPORTS */}
                  {healthPackData.documents && healthPackData.documents.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                        📄 Medical Reports ({healthPackData.documents.length})
                      </h3>
                      <div className="space-y-2">
                        {healthPackData.documents.map((doc: any) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-sky-50 rounded-lg hover:bg-sky-100 border border-sky-200 transition"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">
                                {doc.fileType?.includes("PDF") || doc.fileName?.endsWith(".pdf") ? "📄" : "🖼️"}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-navy">{doc.fileName}</p>
                                <p className="text-xs text-slate-500">{doc.documentType || "Medical Document"}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDocument(doc.id, doc.fileName || doc.name)}
                              disabled={loadingDocId === doc.id}
                              className="text-xs text-sky-600 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                            >
                              {loadingDocId === doc.id ? "Opening..." : "Open Document →"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AUDIT NOTE */}
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex gap-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <p className="font-bold">Access Audit Logging Active</p>
                      <p className="text-[11px] mt-0.5">Every access to this Health Pack is recorded in immutable audit logs (`HEALTH_PACK_VIEWED`). Access is time-limited to 24 hours.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* FOOTER */}
            <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <Button variant="outline" onClick={() => setHealthPackModalOpen(false)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                Print Summary
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HospitalEmergenciesPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await hospitalApi.pendingCases();
        setCases(res.cases || []);
      } catch (err) {
        console.error("[Hospital] Failed to load cases:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 mt-4">Loading emergency cases...</p>
      </div>
    );
  }

  if (cases.length === 0) {
    return <EmptyState icon={Siren} title="No emergency cases yet" message="All systems are ready for incoming emergencies." />;
  }

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {cases.map((c) => (
        <div key={c.caseId || c.id} onClick={() => navigate(`/hospital/emergencies/${c.caseId || c.id}`)} className="cursor-pointer">
          <EmergencyCaseCard emergencyCase={c} />
        </div>
      ))}
    </div>
  );
}

export function HospitalEmergencyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState(rejectReasons[0]);
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await emergencyApi.status(id);
        if (res.case) {
          setCaseData(res.case);
        }
      } catch (err) {
        console.error("[Case Detail]", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 mt-4">Loading case details...</p>
      </div>
    );
  }

  if (!c) return <ErrorState title="Case not found" onRetry={() => navigate("/hospital/emergencies")} />;

  const targetCaseId = c.caseId || c.id || id || "";

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm font-semibold text-text-secondary w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-navy text-lg">Incoming Emergency</h2>
            <p className="text-xs text-text-secondary">Case ID {targetCaseId}</p>
          </div>
          <Badge tone={c.severity === "Critical" || c.severity === "CRITICAL" ? "critical" : c.severity === "Urgent" || c.severity === "URGENT" ? "urgent" : "stable"}>{c.severity || "Emergency"}</Badge>
        </div>

        <p className="text-sm text-navy mb-4">{c.symptoms || "Emergency case requiring immediate response."}</p>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><p className="text-xs text-text-secondary">Patient</p><p className="font-semibold text-navy">{c.patientName || "Emergency Patient"}, {c.age || "--"}</p></div>
          <div><p className="text-xs text-text-secondary">Distance / ETA</p><p className="font-semibold text-navy">{c.distanceKm ? `${c.distanceKm.toFixed(1)} km` : "Nearby"} · {c.etaMin || 8} min</p></div>
          <div><p className="text-xs text-text-secondary">Required capability</p><p className="font-semibold text-navy">{c.requiredCapability || c.emergencyType || "Emergency Care"}</p></div>
          <div><p className="text-xs text-text-secondary">Location</p><p className="font-semibold text-navy">{c.location ? `${c.location.latitude?.toFixed(4)}, ${c.location.longitude?.toFixed(4)}` : "Live Location"}</p></div>
        </div>

        <div className="bg-paleblue border border-lightblue rounded-xl p-3.5 flex gap-2.5 mb-5">
          <BrainCircuit className="w-4.5 h-4.5 text-sky shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-navy">AI Suggested Insight</p>
            <p className="text-xs text-text-secondary mt-1">Symptoms align with {c.requiredCapability || "Emergency Care"}. Confirm bed and specialist availability before accepting.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" fullWidth onClick={() => setRejectOpen(true)}>Reject Case</Button>
          <Button variant="success" fullWidth onClick={() => setConfirmOpen(true)}>Accept Case</Button>
        </div>
      </Card>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm case acceptance?" size="sm">
        <p className="text-sm text-text-secondary mb-5">Are you sure this case matches your current bed, ICU, and specialist availability?</p>
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="success"
            fullWidth
            onClick={async () => {
              try {
                await hospitalApi.acceptCase(targetCaseId);
                setConfirmOpen(false);
                showToast("success", `Case ${targetCaseId} accepted and assigned to your hospital.`);
                navigate("/hospital/emergencies/active");
              } catch (err: any) {
                showToast("error", err.message || "Failed to accept case");
              }
            }}
          >
            Confirm and assign doctor
          </Button>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject case — select a reason" size="sm">
        <div className="flex flex-col gap-2 mb-5">
          {rejectReasons.map((r) => (
            <label key={r} className="flex items-center gap-2.5 text-sm text-navy">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-sky" />
              {r}
            </label>
          ))}
        </div>
        <Button
          variant="danger"
          fullWidth
          onClick={async () => {
            try {
              await hospitalApi.rejectCase(targetCaseId, reason);
              setRejectOpen(false);
              showToast("info", `Case ${targetCaseId} rejected: ${reason}. Search continues.`);
              navigate("/hospital/emergencies");
            } catch (err: any) {
              showToast("error", err.message || "Failed to reject case");
            }
          }}
        >
          Reject
        </Button>
      </Modal>
    </div>
  );
}
