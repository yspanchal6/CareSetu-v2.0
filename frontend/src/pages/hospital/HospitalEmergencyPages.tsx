import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BrainCircuit, RefreshCw, Siren, Lock } from "lucide-react";
import { API_BASE_URL, getAuthToken, hospitalApi, emergencyApi } from "../../services/api";
import EmergencyCaseCard from "../../components/emergency/EmergencyCaseCard";
import { Card } from "../../components/common/Card";
import Badge from "../../components/common/Badge";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import { useToast } from "../../components/common/Toast";
import { EmptyState, ErrorState } from "../../components/common/States";
import { SecureContentService } from "../../services/secure-content.service";

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
  const [selectedPackCaseId, setSelectedPackCaseId] = useState<string>("");
  const [docError, setDocError] = useState<string | null>(null);
  // Secure Document Viewer State
  const [docViewerOpen, setDocViewerOpen] = useState(false);
  const [docViewerData, setDocViewerData] = useState<{
    id: string;
    name: string;
    url: string;
    fileType?: string;
    expiresAt?: string;
    caseId?: string;
  } | null>(null);

  // Security Block & Appeal State
  const [isHospitalBlocked, setIsHospitalBlocked] = useState(false);
  const [blockedData, setBlockedData] = useState<any>(null);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("Accidental screen capture gesture");
  const [appealDescription, setAppealDescription] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  // Redaction Overlay & Capture Warning State
  const [secureViewerSessionId, setSecureViewerSessionId] = useState<string | null>(null);
  const [captureRedacted, setCaptureRedacted] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("");
  const [captureAttempt, setCaptureAttempt] = useState(0);

  // Window Focus / Visibility Protection State for Document Viewer
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  // Check Hospital Security Block Status on Mount
  useEffect(() => {
    SecureContentService.getHospitalSecurityStatus()
      .then((secStatus) => {
        if (secStatus.status === "TEMPORARILY_BLOCKED") {
          setIsHospitalBlocked(true);
          setBlockedData(secStatus);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsWindowVisible(isVisible);
      if (!isVisible && docViewerOpen) {
        setCaptureRedacted(true);
      }
    };
    const handleBlur = () => {
      setIsWindowVisible(false);
      if (docViewerOpen) {
        setCaptureRedacted(true);
      }
    };
    const handleFocus = () => {
      setIsWindowVisible(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [docViewerOpen]);

  // Capture Event Keyboard Handler for Document Viewer
  useEffect(() => {
    if (!docViewerOpen) {
      setCaptureRedacted(false);
      return;
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      const isPrintScreen = e.key === "PrintScreen" || e.code === "PrintScreen";
      const isPrintShortcut = (e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === "p";
      const isMacScreenshot = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5");

      if (isPrintScreen || isPrintShortcut || isMacScreenshot) {
        e.preventDefault();
        e.stopPropagation();

        setCaptureRedacted(true);
        const res = await SecureContentService.reportViolation({
          eventType: isPrintScreen ? "SCREENSHOT_ATTEMPT" : "PROTECTED_CONTENT_CAPTURE",
          caseId: docViewerData?.caseId || selectedPackCaseId,
          documentId: docViewerData?.id,
          healthPackId: healthPackData?.id,
          secureViewerSessionId: secureViewerSessionId || undefined,
        });

        setCaptureMessage(res.message);
        setCaptureAttempt(res.attemptNumber);

        if (!res.allowed || res.action === "TEMPORARY_BLOCK") {
          closeDocViewer();
          setHealthPackModalOpen(false);
          setIsHospitalBlocked(true);
          setBlockedData({
            status: "TEMPORARILY_BLOCKED",
            violationCount: 3,
            blockedAt: new Date().toISOString(),
            blockReason: res.message,
          });
          showToast("error", res.message);
        } else {
          showToast(res.attemptNumber === 2 ? "error" : "info", res.message);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyDown, true);
    };
  }, [docViewerOpen, docViewerData, selectedPackCaseId, healthPackData]);

  // 1-Second Timer Tick State for Live Expiry Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTimerInfo = (expiresAtStr?: string) => {
    if (!expiresAtStr) return { remainingFormatted: "24:00:00", state: "ACTIVE", remainingMs: 86400000 };
    const expiryMs = new Date(expiresAtStr).getTime();
    const remainingMs = Math.max(0, expiryMs - nowTimestamp);

    if (remainingMs <= 0) {
      return { remainingFormatted: "00:00:00", state: "EXPIRED", remainingMs: 0 };
    }

    const totalSec = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const pad = (n: number) => String(n).padStart(2, "0");
    const remainingFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    if (remainingMs <= 60 * 60 * 1000) {
      return { remainingFormatted, state: "CRITICAL", remainingMs };
    } else if (remainingMs <= 6 * 60 * 60 * 1000) {
      return { remainingFormatted, state: "WARNING", remainingMs };
    } else {
      return { remainingFormatted, state: "ACTIVE", remainingMs };
    }
  };

  const closeDocViewer = () => {
    SecureContentService.disableSecureContent();
    if (docViewerData?.url) {
      window.URL.revokeObjectURL(docViewerData.url);
    }
    setDocViewerData(null);
    setDocViewerOpen(false);
  };

  // Auto-close document viewer on live 24-hour expiry
  useEffect(() => {
    if (docViewerOpen && healthPackData?.expiresAt) {
      const { state } = getTimerInfo(healthPackData.expiresAt);
      if (state === "EXPIRED") {
        closeDocViewer();
        setDocError("HealthPack 24-hour access window has expired.");
      }
    }
  }, [nowTimestamp, docViewerOpen, healthPackData?.expiresAt]);

  const openDocument = async (documentId: string, fileName: string, fileType?: string) => {
    setLoadingDocId(documentId);
    setDocError(null);
    try {
      if (healthPackData?.expiresAt && new Date(healthPackData.expiresAt).getTime() <= Date.now()) {
        throw new Error("Document Access Denied: HealthPack 24-hour access window has expired.");
      }

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/patient/documents/${documentId}/view`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Document Access Denied: HealthPack access has expired or your hospital is not authorized for this document.");
        } else if (response.status === 404) {
          throw new Error("Document Not Found: This document is no longer available.");
        } else if (response.status === 401) {
          throw new Error("Session Expired: Please log in again to access patient documents.");
        } else {
          throw new Error(`Failed to load document (${response.status})`);
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      SecureContentService.enableSecureContent({
        caseId: selectedPackCaseId,
        documentId,
        expiresAt: healthPackData?.expiresAt,
      });

      setDocViewerData({
        id: documentId,
        name: fileName || "Medical Document",
        url,
        fileType: fileType || (fileName.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE"),
        expiresAt: healthPackData?.expiresAt,
        caseId: selectedPackCaseId,
      });
      setDocViewerOpen(true);
    } catch (err: any) {
      console.error("[Document]", err);
      setDocError(err.message || "Could not open document.");
    } finally {
      setLoadingDocId(null);
    }
  };

  const openHealthPackModal = async (caseId: string) => {
    setSelectedPackCaseId(caseId);
    setHealthPackModalOpen(true);
    setPackLoading(true);
    setPackError("");
    setDocError(null);
    setHealthPackData(null);
    try {
      const res = await hospitalApi.getHealthPack(caseId);
      const rawData = res?.data ?? res;
      // Safe structural log only: never print decrypted medical values.
      console.log("[HealthPack] Loaded payload keys:", Object.keys(rawData || {}));

      const pack = rawData?.healthPack || rawData?.data?.healthPack || rawData?.data || rawData;

      if (pack) {
        setHealthPackData(pack);
      } else {
        setPackError("Failed to load Health Pack data.");
      }
    } catch (err: any) {
      setHealthPackData(null);
      const msg = err.response?.data?.error || err.message || "Unauthorized access or Health Pack expired.";
      setPackError(msg);
    } finally {
      setPackLoading(false);
    }
  };

  const isFetchingRef = useState({ active: false })[0];

  const healthPackSummary = useMemo(() => {
    const pack = healthPackData?.healthPack || healthPackData?.data?.healthPack || healthPackData?.data || healthPackData || {};
    // GET /api/health-pack/case/:caseId returns medical data nested under `healthData`.
    const hd = pack?.healthData || healthPackData?.healthData || {};

    const formatVal = (val: any, fallback: string) => {
      if (val == null) return fallback;
      const s = String(val).trim();
      if (!s || s === "NOT_PROVIDED") return fallback;
      if (s === "UNKNOWN") return "Unknown";
      return s;
    };

    const rawBg = hd?.bloodGroup || hd?.blood_group || pack?.bloodGroup || pack?.blood_group;
    const rawAlg = hd?.allergies || pack?.allergies || pack?.allergy_list || pack?.allergyList;
    const rawMed = hd?.medications || hd?.currentMedications || pack?.medications || pack?.current_medications || pack?.currentMedications;
    const rawHeart = hd?.heartCondition || hd?.heart_condition || pack?.heartCondition || pack?.heart_condition || pack?.heart_status || pack?.heartStatus;
    const rawDiab = hd?.diabetesStatus || hd?.diabetes_status || pack?.diabetesStatus || pack?.diabetes_status;
    const rawHyp = hd?.hypertensionStatus || hd?.hypertension_status || pack?.hypertensionStatus || pack?.hypertension_status;
    const rawCond = hd?.conditions || hd?.medicalConditions || hd?.medical_conditions || pack?.medical_conditions || pack?.medicalConditions || pack?.conditions || pack?.known_conditions || pack?.knownConditions;

    return {
      name: pack?.patient?.name || hd?.name || pack?.name || healthPackData?.name || "Patient",
      patientId: pack?.patientId || pack?.patient_id || healthPackData?.patientId || "N/A",
      bloodGroup: formatVal(rawBg, "Not provided"),
      allergies: formatVal(rawAlg, "None reported"),
      medications: formatVal(rawMed, "None reported"),
      heartCondition: formatVal(rawHeart, "Unknown"),
      diabetesStatus: formatVal(rawDiab, "Unknown"),
      hypertensionStatus: formatVal(rawHyp, "Unknown"),
      conditions: formatVal(rawCond, "None reported"),
      surgeries: hd?.surgeries || pack?.surgeries || pack?.past_surgeries || pack?.pastSurgeries || "",
      notes: hd?.notes || pack?.notes || pack?.emergency_notes || pack?.emergencyNotes || "",
      documents: Array.isArray(healthPackData?.documents) ? healthPackData.documents : (Array.isArray(pack?.documents) ? pack.documents : []),
    };
  }, [healthPackData]);

  const load = useCallback(async () => {
    if (isFetchingRef.active) return;
    isFetchingRef.active = true;
    try {
      const res = await hospitalApi.getEmergencyCases();
      const rows: any[] = res.cases || [];
      setCases(rows.filter((c: any) => ACTIVE_STATUSES.includes(c.status)));
    } catch (err) {
      console.error("[ActiveCases] Failed to load:", err);
    } finally {
      isFetchingRef.active = false;
      setLoading(false);
    }
  }, [isFetchingRef]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
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

  if (isHospitalBlocked) {
    return (
      <div className="max-w-2xl mx-auto my-6 bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-red-900/60 font-sans">
        <div className="flex items-center gap-3 text-red-500 font-bold text-xl mb-4 border-b border-slate-800 pb-4">
          <span className="text-3xl">🔒</span>
          <h2>PORTAL TEMPORARILY RESTRICTED</h2>
        </div>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Your CareSetu hospital portal has been temporarily restricted because protected CareSetu medical content was captured or a protected-screen capture event was detected. This activity violates the CareSetu HealthPack terms and conditions.
        </p>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300 mb-6">
          <p><strong className="text-slate-400">Status:</strong> <span className="text-red-400 font-bold tracking-wide">TEMPORARILY BLOCKED</span></p>
          <p><strong className="text-slate-400">Reason:</strong> Protected medical-content capture violation</p>
          <p><strong className="text-slate-400">Security Violations Detected:</strong> <span className="font-bold text-amber-400">{blockedData?.violationCount || 3} / 3</span></p>
          <p><strong className="text-slate-400">Date:</strong> {blockedData?.blockedAt ? new Date(blockedData.blockedAt).toLocaleString() : new Date().toLocaleString()}</p>
          <p><strong className="text-slate-400">Review Status:</strong> {blockedData?.status === 'UNDER_REVIEW' ? 'Appeal Under Security Review' : 'Under Security Review'}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            onClick={() => setAppealModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 font-bold text-white px-5 py-2.5 rounded-xl text-sm"
          >
            Submit Review Request
          </Button>
          <a
            href="mailto:security@caresetu.in"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-xl font-semibold border border-slate-700 inline-flex items-center gap-2"
          >
            ✉️ Contact Administration
          </a>
        </div>

        {/* APPEAL MODAL */}
        {appealModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-base text-navy">Submit Security Review Request</h3>
                <button onClick={() => setAppealModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
              </div>

              {appealSubmitted ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                  <span className="text-3xl">✅</span>
                  <h4 className="font-bold text-emerald-900 text-sm">Review Request Submitted</h4>
                  <p className="text-xs text-emerald-800">
                    Your review request has been submitted to CareSetu Administration. An administrator will review your account history.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setAppealModalOpen(false)} className="mt-2">Close</Button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!appealDescription.trim()) return;
                    setAppealSubmitting(true);
                    try {
                      await SecureContentService.submitAppeal({
                        reason: appealReason,
                        description: appealDescription,
                      });
                      setAppealSubmitted(true);
                      showToast("success", "Review request submitted to CareSetu Administration.");
                    } catch (err: any) {
                      showToast("error", err.message || "Failed to submit review request.");
                    } finally {
                      setAppealSubmitting(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Explanation Category</label>
                    <select
                      value={appealReason}
                      onChange={(e) => setAppealReason(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                    >
                      <option value="Accidental screen capture gesture">Accidental screen capture gesture</option>
                      <option value="Third-party background recording software">Third-party background recording software</option>
                      <option value="OS display mirroring / screenshot event">OS display mirroring / screenshot event</option>
                      <option value="Other security explanation">Other security explanation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Detailed Explanation</label>
                    <textarea
                      required
                      rows={4}
                      value={appealDescription}
                      onChange={(e) => setAppealDescription(e.target.value)}
                      placeholder="Please explain the circumstances surrounding the protected-content capture event..."
                      className="w-full text-xs p-3 border border-slate-300 rounded-lg bg-white text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" type="button" onClick={() => setAppealModalOpen(false)}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={appealSubmitting || !appealDescription.trim()}>
                      {appealSubmitting ? "Submitting..." : "Submit Review Request"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
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
            <div className="p-4 bg-slate-900 text-white rounded-t-2xl flex flex-wrap justify-between items-center gap-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-xl font-bold">
                  🔒
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-lg text-white">Secure Patient Health Pack</h2>
                    {healthPackData?.expiresAt && (() => {
                      const timer = getTimerInfo(healthPackData.expiresAt);
                      if (timer.state === "CRITICAL") {
                        return (
                          <span className="text-xs font-bold px-2.5 py-1 bg-red-500/20 text-red-300 rounded-full border border-red-500/40 flex items-center gap-1.5 animate-pulse" aria-live="polite">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            🔴 Access expires in ⏱ {timer.remainingFormatted}
                          </span>
                        );
                      } else if (timer.state === "WARNING") {
                        return (
                          <span className="text-xs font-bold px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/40 flex items-center gap-1.5" aria-live="polite">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            🟡 Access expires in ⏱ {timer.remainingFormatted}
                          </span>
                        );
                      } else if (timer.state === "EXPIRED") {
                        return (
                          <span className="text-xs font-bold px-2.5 py-1 bg-red-900/60 text-red-200 rounded-full border border-red-700 flex items-center gap-1.5">
                            🔒 Access Expired
                          </span>
                        );
                      } else {
                        return (
                          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40 flex items-center gap-1.5" aria-live="polite">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            🟢 Access Active ⏱ {timer.remainingFormatted}
                          </span>
                        );
                      }
                    })()}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {healthPackData?.expiresAt
                      ? `Access expires: ${new Date(healthPackData.expiresAt).toLocaleString()}`
                      : "Encrypted & Access Audited"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHealthPackModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-xl px-2 transition-colors cursor-pointer"
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
                <div className="p-5 bg-amber-50/80 border border-amber-200 text-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-base">
                    <span>🛡️</span>
                    <span>Access Unavailable</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    HealthPack access is not currently available for this case. Reason: {packError}
                  </p>
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      onClick={() => openHealthPackModal(selectedPackCaseId)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Retry Request
                    </button>
                    <button
                      onClick={() => setHealthPackModalOpen(false)}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {healthPackData && !packLoading && (
                <>
                  {/* DOCUMENT ERROR BANNER */}
                  {docError && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-xs text-red-800 flex justify-between items-center mb-3 transition">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚨</span>
                        <div>
                          <p className="font-bold text-red-900">Document Access Error</p>
                          <p className="text-red-700">{docError}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDocError(null)}
                        className="text-xs text-red-600 font-semibold hover:underline ml-2"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* PATIENT PROFILE */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      Patient Profile
                    </h3>
                    <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-bold text-navy">{healthPackSummary.name}</p>
                        <p className="text-xs text-slate-600">
                          Patient ID: {healthPackSummary.patientId}
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
                        {healthPackSummary.bloodGroup}
                      </p>
                    </div>
                    <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100">
                      <h3 className="text-xs font-semibold text-amber-700 uppercase mb-1">
                        ⚠️ Allergies
                      </h3>
                      <p className="text-sm font-semibold text-amber-900">
                        {healthPackSummary.allergies}
                      </p>
                    </div>
                  </div>

                  {/* MEDICATIONS */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      💊 Current Medications
                    </h3>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {healthPackSummary.medications}
                    </p>
                  </div>

                  {/* CONDITIONS */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                      🩺 Confirmed Medical Conditions & History
                    </h3>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs text-slate-800">
                      <p><strong>Heart / Cardiac Status:</strong> {healthPackSummary.heartCondition}</p>
                      <p><strong>Diabetes Status:</strong> {healthPackSummary.diabetesStatus}</p>
                      <p><strong>Hypertension Status:</strong> {healthPackSummary.hypertensionStatus}</p>
                      <p><strong>Confirmed Conditions:</strong> {healthPackSummary.conditions}</p>
                      {healthPackSummary.surgeries && <p><strong>Surgeries:</strong> {healthPackSummary.surgeries}</p>}
                      {healthPackSummary.notes && <p><strong>Emergency Notes:</strong> {healthPackSummary.notes}</p>}
                    </div>
                  </div>

                  {/* ATTACHED REPORTS */}
                  {healthPackSummary.documents.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                        📄 Medical Reports ({healthPackSummary.documents.length})
                      </h3>
                      <div className="space-y-2">
                        {healthPackSummary.documents.map((doc: any) => (
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
                              className="text-xs text-sky-600 font-bold flex items-center gap-1.5 hover:underline disabled:opacity-50 cursor-pointer"
                            >
                              {loadingDocId === doc.id ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5 text-sky-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Opening...</span>
                                </>
                              ) : (
                                "Open Document →"
                              )}
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
                      <p className="text-[11px] mt-0.5">Every access to this Health Pack is recorded in immutable audit logs (HEALTH_PACK_VIEWED). Access is time-limited to 24 hours.</p>
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
              {healthPackData && !packLoading && !packError && (
                <Button variant="primary" onClick={() => window.print()}>
                  Print Summary
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECURE MEDICAL DOCUMENT VIEWER MODAL */}
      {docViewerOpen && docViewerData && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4 secure-doc-modal">
          <style>{`
            @media print {
              .secure-doc-modal, .secure-medical-document {
                display: none !important;
              }
              body::after {
                content: "Printing protected medical documents is strictly prohibited under CareSetu security policy.";
                font-size: 20px;
                font-weight: bold;
                color: #dc2626;
                text-align: center;
                margin-top: 100px;
                display: block;
              }
            }
          `}</style>
          <div className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-slate-700 transform transition-all duration-200 scale-100">
            {/* VIEWER HEADER */}
            <div className="p-3.5 bg-slate-800 text-white flex flex-wrap justify-between items-center gap-3 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center text-base font-bold">
                  🔒
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-100">{docViewerData.name}</h3>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                      VIEW ONLY • NO DOWNLOAD
                    </span>
                    {docViewerData.expiresAt && (() => {
                      const timer = getTimerInfo(docViewerData.expiresAt);
                      return (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                          timer.state === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse' :
                          timer.state === 'WARNING' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        }`}>
                          ⏱ {timer.remainingFormatted}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {docViewerData.expiresAt
                      ? `Access Expiry: ${new Date(docViewerData.expiresAt).toLocaleString()}`
                      : "Authorized 24-Hour Hospital Session"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDocViewer}
                className="text-slate-400 hover:text-white font-bold text-lg px-2 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* VIEWER BODY WITH WATERMARK AND PRIVACY OVERLAY */}
            <div
              className="relative flex-1 bg-slate-950 overflow-auto p-4 secure-medical-document select-none"
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* PRIVACY & REDACTION OVERLAY ON CAPTURE EVENT OR WINDOW BLUR */}
              {(captureRedacted || !isWindowVisible) && (
                <div className="absolute inset-0 z-50 bg-slate-950/98 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none">
                  <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-3xl mb-3 border border-red-500/40 animate-pulse">
                    🔒
                  </div>
                  <h4 className="text-base font-extrabold text-white mb-1 tracking-wide">
                    CARESETU SECURE CONTENT
                  </h4>
                  <p className="text-xs text-amber-300 max-w-md font-semibold mt-1">
                    {captureMessage || "Protected content has been temporarily hidden because a screen-capture event was detected."}
                  </p>
                  {captureAttempt > 0 && (
                    <p className="text-xs font-bold text-red-400 mt-2 px-3 py-1 bg-red-950/80 rounded-full border border-red-800">
                      Security attempt: {captureAttempt} of 3
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 max-w-sm mt-3 leading-relaxed">
                    Please do not capture, record, photograph, or redistribute protected medical information.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCaptureRedacted(false)}
                    className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer"
                  >
                    Continue Secure Viewing
                  </button>
                </div>
              )}

              {/* DYNAMIC SECURITY WATERMARK OVERLAY */}
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-wrap items-center justify-around opacity-15 overflow-hidden p-8 select-none space-y-12">
                {[...Array(6)].map((_, idx) => (
                  <div key={idx} className="transform -rotate-12 text-center text-slate-300 space-y-1 p-4 border border-slate-500/20 rounded-lg">
                    <p className="font-extrabold text-lg tracking-widest text-sky-400">CONFIDENTIAL — CARESETU</p>
                    <p className="text-xs font-bold text-amber-300">SECURE HEALTHPACK VIEW ONLY</p>
                    <p className="text-[11px] text-slate-300">Case Ref: {docViewerData.caseId || selectedPackCaseId || 'ACTIVE_EMERGENCY'}</p>
                    <p className="text-[10px] text-slate-400">
                      {docViewerData.expiresAt ? `Expires: ${new Date(docViewerData.expiresAt).toLocaleString()}` : '24-Hour Access Window'}
                    </p>
                  </div>
                ))}
              </div>

              {/* DOCUMENT CONTENT */}
              <div className="relative z-0 min-h-[60vh] flex items-center justify-center">
                {docViewerData.name.toLowerCase().endsWith(".pdf") || docViewerData.fileType === "PDF" ? (
                  <object
                    data={`${docViewerData.url}#toolbar=0&navpanes=0&scrollbar=0`}
                    type="application/pdf"
                    className="w-full h-[70vh] rounded-lg border border-slate-800 bg-white"
                  >
                    <iframe
                      src={`${docViewerData.url}#toolbar=0&navpanes=0`}
                      className="w-full h-[70vh] rounded-lg border border-slate-800 bg-white"
                      title="Protected Document Viewer"
                    />
                  </object>
                ) : (
                  <img
                    src={docViewerData.url}
                    alt={docViewerData.name}
                    className="max-h-[70vh] max-w-full rounded-lg object-contain border border-slate-800 shadow-lg pointer-events-none"
                    onDragStart={(e) => e.preventDefault()}
                  />
                )}
              </div>
            </div>

            {/* VIEWER FOOTER — VIEW ONLY */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-amber-400">⚠️</span>
                <span>Document export, downloading, and printing are disabled by CareSetu security policy.</span>
              </div>
              <Button variant="outline" size="sm" onClick={closeDocViewer} className="text-slate-300 border-slate-700 hover:bg-slate-800">
                Close Viewer
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
    let active = true;
    let fetching = false;

    const load = async () => {
      if (!active || fetching) return;
      fetching = true;
      try {
        const res = await hospitalApi.pendingCases();
        if (active) setCases(res.cases || []);
      } catch (err) {
        console.error("[Hospital] Failed to load cases:", err);
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(iv);
    };
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
  const [isAccepting, setIsAccepting] = useState(false);
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
<div><p className="text-xs text-text-secondary">Patient</p><p className="font-semibold 
            text-navy">{c.patientName || "Patient"}, {c.age || "--"}</p></div>
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
            disabled={isAccepting}
            onClick={async () => {
              if (isAccepting) return;
              setIsAccepting(true);
              try {
                await hospitalApi.acceptCase(targetCaseId);
                setConfirmOpen(false);
                showToast("success", `Case ${targetCaseId} accepted and assigned to your hospital.`);
                navigate("/hospital/emergencies/active");
              } catch (err: any) {
                let msg = err?.message || "Failed to accept case";
                if (err?.status === 401) msg = "Your session has expired. Please log in again.";
                else if (err?.status === 403) msg = err?.message || "You are not authorized to accept this emergency case.";
                else if (err?.status === 409) msg = "This emergency case has already been accepted or is no longer available.";
                else if (err?.status === 404) msg = "Emergency case not found.";
                showToast("error", msg);
              } finally {
                setIsAccepting(false);
              }
            }}
          >
            {isAccepting ? "Processing..." : "Confirm and assign doctor"}
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
