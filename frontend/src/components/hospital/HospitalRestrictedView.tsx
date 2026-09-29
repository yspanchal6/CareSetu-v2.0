import { useState } from "react";
import { ShieldAlert, FileText, CheckCircle2, Send, Mail, Clock } from "lucide-react";
import { useHospitalSecurity } from "../../context/HospitalSecurityContext";
import { SecureContentService } from "../../services/secure-content.service";
import Button from "../common/Button";
import Modal from "../common/Modal";
import { useToast } from "../common/Toast";

export default function HospitalRestrictedView() {
  const { showToast } = useToast();
  const { currentViolationCount, blockReason, blockedAt, appeals, refreshSecurityStatus } = useHospitalSecurity();

  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState("Accidental screen capture gesture");
  const [appealDescription, setAppealDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingAppeal = appeals?.find((a: any) => a.status === "PENDING") || appeals?.[0];

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealDescription.trim()) {
      showToast("error", "Please provide a detailed explanation for your review request.");
      return;
    }
    setSubmitting(true);
    try {
      await SecureContentService.submitAppeal({
        reason: appealReason,
        description: appealDescription.trim(),
      });
      showToast("success", "Review request submitted successfully.");
      setAppealModalOpen(false);
      setAppealDescription("");
      await refreshSecurityStatus();
    } catch (err: any) {
      showToast("error", err.message || "Failed to submit review request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-8 bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-red-900/60">
      <div className="flex items-center gap-3 text-red-500 font-bold text-xl mb-4 border-b border-slate-800 pb-4">
        <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
        <div>
          <h2>HOSPITAL PORTAL TEMPORARILY RESTRICTED</h2>
          <p className="text-xs text-slate-400 font-normal mt-0.5">CareSetu HealthPack Content Security Policy Enforcement</p>
        </div>
      </div>

      <p className="text-sm text-slate-300 mb-6 leading-relaxed">
        Your CareSetu hospital portal access has been temporarily restricted because protected patient HealthPack content was captured or a protected screen capture event was detected. This activity violates CareSetu security policies.
      </p>

      {/* SECURITY BLOCK METADATA */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs text-slate-300 mb-6">
        <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
          <span className="text-slate-400 font-semibold">Security Status:</span>
          <span className="bg-red-500/20 text-red-400 font-bold px-2.5 py-0.5 rounded border border-red-500/40">
            TEMPORARILY BLOCKED ({currentViolationCount} / 3 Violations)
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-semibold">Block Reason:</span>
          <span className="text-slate-200">{blockReason || "Protected medical-content capture violation"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-semibold">Blocked Date & Time:</span>
          <span className="text-slate-300">{blockedAt ? new Date(blockedAt).toLocaleString() : new Date().toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400 font-semibold">Security Review Reference:</span>
          <span className="font-mono text-amber-400">
            {pendingAppeal?.reviewReference || `REF-SEC-${Date.now().toString().slice(-8)}`}
          </span>
        </div>
      </div>

      {/* SUBMITTED APPEAL STATUS IF PRESENT */}
      {pendingAppeal ? (
        <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl mb-6 space-y-2 text-xs">
          <div className="flex items-center justify-between text-amber-400 font-bold">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Submitted Appeal Explanation
            </span>
            <span className="bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded border border-amber-700/60 text-[11px] font-mono">
              Status: {pendingAppeal.status}
            </span>
          </div>
          <p className="text-slate-300 italic">"{pendingAppeal.description}"</p>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-amber-900/40">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Submitted at: {new Date(pendingAppeal.submittedAt || pendingAppeal.createdAt).toLocaleString()}
          </div>
        </div>
      ) : null}

      {/* ACTION BUTTONS */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          onClick={() => setAppealModalOpen(true)}
          className="bg-sky hover:bg-sky-600 font-bold text-white px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {pendingAppeal ? "Update Review Request" : "Submit Review Request"}
        </Button>

        <a
          href="mailto:security@caresetu.in"
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-xl font-semibold border border-slate-700 inline-flex items-center gap-2"
        >
          <Mail className="w-4 h-4 text-slate-400" />
          Contact Administration
        </a>
      </div>

      {/* SUBMIT APPEAL MODAL */}
      <Modal
        open={appealModalOpen}
        onClose={() => setAppealModalOpen(false)}
        title="Submit Security Review Request"
        size="md"
      >
        <form onSubmit={handleSubmitAppeal} className="space-y-4 text-xs text-slate-700">
          <p className="text-slate-600">
            Please explain the circumstances regarding the protected HealthPack content capture event. CareSetu Administration will review your explanation.
          </p>

          <div>
            <label className="block font-bold mb-1 text-slate-800">Review Reason Category</label>
            <select
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              className="w-full p-2.5 border rounded-lg bg-slate-50 text-xs text-slate-800"
            >
              <option value="Accidental screen capture gesture">Accidental screen capture gesture</option>
              <option value="OS system notification trigger">OS system notification trigger</option>
              <option value="Unintentional shortcut key press">Unintentional shortcut key press</option>
              <option value="Third-party background software interference">Third-party background software interference</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1 text-slate-800">Detailed Explanation</label>
            <textarea
              rows={4}
              required
              value={appealDescription}
              onChange={(e) => setAppealDescription(e.target.value)}
              placeholder="Provide complete details explaining why the capture event occurred..."
              className="w-full p-2.5 border rounded-lg bg-slate-50 text-xs text-slate-800"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" fullWidth onClick={() => setAppealModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" fullWidth type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Review Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
