import React, { useState, useEffect } from "react";
import { AlertTriangle, Trash2, Clock, CheckCircle2, XCircle, Info, X } from "lucide-react";
import { Card } from "./Card";
import Button from "./Button";
import { useToast } from "./Toast";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { accountDeletionApi } from "../../services/api";

export function DeleteAccountSection() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [request, setRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [reason, setReason] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const roleUpper = (user?.role as string)?.toUpperCase();
  const isPatient = roleUpper === "PATIENT";
  const isAdmin = roleUpper === "ADMIN";

  const loadMyRequest = async () => {
    if (isPatient || isAdmin) {
      setLoading(false);
      return;
    }
    try {
      const res = await accountDeletionApi.getMyDeletionRequest();
      if (res.success) {
        setRequest(res.request);
      }
    } catch (err) {
      console.warn("[DeleteAccountSection] Error loading request:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !isAdmin) {
      loadMyRequest();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (isAdmin) {
    return (
      <Card className="border border-slate-200 bg-slate-50/50 p-5 rounded-2xl">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-medium">
          <Info className="w-5 h-5 text-sky shrink-0" />
          <span>Administrator accounts cannot be deleted via the user self-service workflow.</span>
        </div>
      </Card>
    );
  }

  const handleOpenModal = () => {
    setReason("");
    setConfirmationText("");
    setErrorMsg("");
    setShowModal(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5) {
      setErrorMsg("Please enter a deletion reason of at least 5 characters.");
      return;
    }
    if (trimmedReason.length > 1000) {
      setErrorMsg("Deletion reason cannot exceed 1000 characters.");
      return;
    }
    if (confirmationText.trim().toUpperCase() !== "DELETE") {
      setErrorMsg("To confirm, you must type 'DELETE' exactly.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await accountDeletionApi.submitDeletionRequest(trimmedReason, confirmationText);
      if (res.success) {
        if (res.terminated || isPatient) {
          showToast("success", "Your account has been permanently terminated.");
          setShowModal(false);
          logout();
          navigate("/login", { replace: true });
        } else {
          showToast("success", "Your account deletion request has been submitted for administrator review.");
          setShowModal(false);
          await loadMyRequest();
        }
      } else {
        setErrorMsg(res.message || "Failed to process deletion request.");
        showToast("error", res.message || "Submission failed.");
      }
    } catch (err: any) {
      const msg = err?.message || "Error submitting account deletion request.";
      setErrorMsg(msg);
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = reason.trim().length >= 5 && reason.trim().length <= 1000 && confirmationText.trim().toUpperCase() === "DELETE";

  return (
    <div className="space-y-4">
      <div className="pt-4 border-t border-slate-200/80">
        <h3 className="text-sm font-bold text-navy uppercase tracking-wider mb-3">Account & Privacy</h3>

        {loading ? (
          <Card className="p-4 text-xs text-slate-500">Checking deletion request status...</Card>
        ) : !isPatient && request && request.status === "PENDING" ? (
          <Card className="bg-amber-50/80 border border-amber-300 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <h4 className="font-bold text-navy text-sm sm:text-base">Account Deletion Request Pending</h4>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                Pending Admin Review
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Your account deletion request was submitted on <strong>{new Date(request.createdAt).toLocaleDateString()}</strong>. An administrator is reviewing your request. Your account remains active while pending.
            </p>
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs">
              <span className="font-bold text-slate-700">Reason submitted:</span>
              <p className="text-slate-600 mt-0.5 italic">"{request.reason}"</p>
            </div>
          </Card>
        ) : (
          <Card className="bg-rose-50/40 border border-rose-200/80 p-5 rounded-2xl space-y-4">
            {!isPatient && request && request.status === "REJECTED" && (
              <div className="bg-rose-100/70 border border-rose-300 p-3.5 rounded-xl space-y-1 text-xs text-rose-900 mb-3">
                <div className="flex items-center gap-2 font-bold text-rose-950">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Previous Deletion Request Rejected</span>
                </div>
                <p className="text-slate-700">
                  <strong>Reason from Admin:</strong> "{request.adminReason || "No details provided"}"
                </p>
                <p className="text-slate-500 text-[11px] pt-1">Your account remains active. You can submit a new request if needed.</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-navy text-base">Delete Your Account</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                  {isPatient
                    ? "Permanently terminate your CareSetu patient account and associated personal medical data. This action is immediate and cannot be undone."
                    : "Permanently request deletion of your CareSetu account and associated data. An administrator must review and approve your request before permanent termination."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Your Account</span>
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-navy text-lg leading-tight">Delete Your Account</h3>
                <p className="text-xs text-slate-500">
                  {isPatient ? "Immediate Account Termination" : "Permanent Account Deletion Request"}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                {isPatient
                  ? "Your account will be permanently terminated immediately."
                  : "Account deletion is permanent after admin approval."}
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed pl-1">
                {isPatient ? (
                  <>
                    <li>Submitting this request will <strong>IMMEDIATELY TERMINATE</strong> your account.</li>
                    <li>All your active medical profiles and documents will be permanently removed.</li>
                    <li>You will be logged out immediately and cannot log in again.</li>
                    <li>A termination notification email will be sent to your registered email address.</li>
                  </>
                ) : (
                  <>
                    <li>Submitting this request will create a pending request for administrator review.</li>
                    <li>An administrator will review your deletion request.</li>
                    <li>Your account remains fully active while pending review.</li>
                    <li>If approved, your account and associated permitted data will be permanently deleted.</li>
                    <li>If rejected, your account remains active and you will be notified with the reason.</li>
                  </>
                )}
              </ul>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">
                  Why do you want to delete your account? *
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please tell us why you want to delete your account..."
                  rows={3}
                  maxLength={1000}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky/40 focus:border-sky outline-none transition-all resize-none"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                  <span>Minimum 5 characters required</span>
                  <span>{reason.length}/1000</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1.5">
                  To confirm, type <span className="font-extrabold text-rose-600 uppercase">DELETE</span>: *
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono font-bold tracking-wider focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500 outline-none uppercase"
                />
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="w-full sm:w-auto text-xs"
                >
                  Cancel
                </Button>
                <button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-xs text-white shadow-sm transition-all ${
                    isFormValid && !submitting
                      ? "bg-rose-600 hover:bg-rose-700 active:scale-[0.98]"
                      : "bg-slate-300 cursor-not-allowed opacity-70"
                  }`}
                >
                  {submitting
                    ? isPatient ? "Terminating Account..." : "Submitting Request..."
                    : isPatient ? "Delete & Terminate Account" : "Submit Deletion Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
