import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  FileText,
  UploadCloud,
  CheckCircle2,
  Mail,
  MessageSquare,
  ArrowLeft,
  Trash2,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import Button from "../../components/common/Button";
import { OtpInput } from "../../components/common/OtpInput";
import { useAuth } from "../../context/AuthContext";
import { getAuthToken } from "../../services/api";
import { useToast } from "../../components/common/Toast";
import { documentVerificationApi, DocumentVerificationStatus } from "../../services/api";

type VerificationStep = "documents" | "method_select" | "otp_verify" | "success";

export default function DocumentVerificationPage() {
  const { user, setSession } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<VerificationStep>("documents");
  const [loading, setLoading] = useState<boolean>(true);
  const [statusData, setStatusData] = useState<DocumentVerificationStatus | null>(null);

  // Upload state
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [confirmChecklist, setConfirmChecklist] = useState<boolean>(false);

  // Method selection
  const [selectedMethod, setSelectedMethod] = useState<"EMAIL" | "SMS">("EMAIL");

  // OTP Verification state
  const [maskedDestination, setMaskedDestination] = useState<string>("");
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [otpExpired, setOtpExpired] = useState<boolean>(false);
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [otpErrorMessage, setOtpErrorMessage] = useState<string | null>(null);
  const isVerifyingRef = useRef<boolean>(false);

  const isFetchingRef = useRef(false);

  const loadStatus = async () => {
    if (!user || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    try {
      const res = await documentVerificationApi.getStatus();
      setStatusData(res);
      if (res.role === "HOSPITAL") {
        if (res.verificationStatus === "APPROVED" && res.hospitalStatus === "ACTIVE") {
          setStep("success");
        }
      } else if (res.isVerified) {
        setStep("success");
      }
    } catch (err: any) {
      if (err?.status === 401) {
        showToast("error", "Session expired. Please log in again.");
        navigate("/login", { replace: true });
      } else if (err?.status === 403) {
        showToast("error", "Access restricted. You do not have permission for document verification.");
        const role = user?.role || "PATIENT";
        navigate(`/${role.toLowerCase()}/dashboard`, { replace: true });
      } else if (err?.status === 429) {
        const retryAfter = err?.retryAfterSeconds || 30;
        showToast("error", `Rate limit reached. Please wait ${retryAfter} seconds before trying again.`);
      } else {
        showToast("error", err instanceof Error ? err.message : "Server error loading verification status.");
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadStatus();
    }
  }, [user]);

  // Timer logic
  useEffect(() => {
    if (step === "otp_verify" && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendTimer]);

  useEffect(() => {
    if (step !== "otp_verify" || otpExpiresAt === null) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      setOtpExpired(remaining === 0);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [step, otpExpiresAt]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast("error", "File size exceeds maximum allowed limit of 10MB.");
      return;
    }

    setUploadingType(docType);
    try {
      await documentVerificationApi.uploadDocument(file, docType);
      showToast("success", "Document uploaded successfully!");
      await loadStatus();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setUploadingType(null);
      event.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await documentVerificationApi.deleteDocument(docId);
      showToast("info", "Document removed.");
      await loadStatus();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to delete document.");
    }
  };

  const handleProceedToMethodSelect = () => {
    if (!statusData?.hasAllRequiredDocs) {
      showToast("error", "Please upload all required documents before proceeding.");
      return;
    }
    if (!confirmChecklist) {
      showToast("error", "Please confirm the document authenticity checklist.");
      return;
    }
    setStep("method_select");
  };

  const handleRequestOtp = async () => {
    setLoading(true);
    try {
      const res = await documentVerificationApi.requestOtp(selectedMethod, confirmChecklist);
      setMaskedDestination(res.maskedDestination);
      setOtpExpiresAt(res.expiresAt);
      setResendTimer(res.cooldownSeconds || 60);
      setOtpStatus("idle");
      setOtpErrorMessage(null);
      setStep("otp_verify");
      showToast("success", res.message);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setOtpStatus("verifying");
    setOtpErrorMessage(null);

    try {
      const res = await documentVerificationApi.verifyOtp(code, selectedMethod);
      if (res.success && res.isVerified) {
        setOtpStatus("success");
        showToast("success", "Document verification successful!");
        if (res.user) {
          await setSession(res.user, getAuthToken() || "");
        }
        setTimeout(() => {
          setStep("success");
          isVerifyingRef.current = false;
        }, 1200);
      } else {
        setOtpStatus("error");
        setOtpErrorMessage(res.message || "OTP Verification failed.");
        isVerifyingRef.current = false;
      }
    } catch (err) {
      setOtpStatus("error");
      const msg = err instanceof Error ? err.message : "Invalid verification code.";
      setOtpErrorMessage(msg);
      showToast("error", msg);
      isVerifyingRef.current = false;
    }
  };

  const handleBackToDocuments = async () => {
    try {
      await documentVerificationApi.cancelOtp();
    } catch {
      // Silently clean up
    }
    setResendTimer(0);
    setOtpExpiresAt(null);
    setOtpStatus("idle");
    setOtpErrorMessage(null);
    setStep("documents");
  };

  const handleBackToMethodSelect = async () => {
    try {
      await documentVerificationApi.cancelOtp();
    } catch {
      // Silently clean up
    }
    setResendTimer(0);
    setOtpExpiresAt(null);
    setOtpStatus("idle");
    setOtpErrorMessage(null);
    setStep("method_select");
  };

  const [skipping, setSkipping] = useState<boolean>(false);

  const handleSkipVerification = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      const res = await documentVerificationApi.skipVerification();
      showToast("info", res.message || "You can complete your document verification later from Settings.");
      const role = res.user?.role || user?.role || statusData?.role || "PATIENT";
      navigate(`/${role.toLowerCase()}/dashboard`, { replace: true });
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to skip verification.");
      const role = user?.role || statusData?.role || "PATIENT";
      navigate(`/${role.toLowerCase()}/dashboard`, { replace: true });
    } finally {
      setSkipping(false);
    }
  };

  const handleContinueToDashboard = () => {
    const role = user?.role || statusData?.role || "PATIENT";
    navigate(`/${role.toLowerCase()}/dashboard`, { replace: true });
  };


  if (loading && !statusData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-sky mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading document verification...</p>
        </div>
      </div>
    );
  }

  const roleLabel = statusData?.role || user?.role || "User";

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-3 sm:p-6 bg-slate-50/50">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 p-4 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 sm:pb-5 mb-5 sm:mb-6">
          <div className="p-2.5 sm:p-3 bg-sky-50 text-sky rounded-xl shrink-0">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-navy leading-tight">
              Post-Registration Document Verification
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Account Role: <span className="font-semibold text-sky uppercase">{roleLabel}</span>
            </p>
          </div>
        </div>

        {/* STEP 1: DOCUMENTS UPLOAD & CHECKLIST */}
        {step === "documents" && (
          <div className="space-y-5 sm:space-y-6 animate-fade-in">
            <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3.5 sm:p-4 text-xs text-slate-700">
              <p className="font-semibold text-navy mb-1">Upload Required Verification Documents</p>
              <p>Please upload all required official documents for your <span className="font-bold">{roleLabel}</span> account before completing verification.</p>
              <p className="mt-1 text-slate-500">Accepted formats: PDF, JPG, PNG (Max 10MB per file).</p>
            </div>

            {/* Document Upload Cards */}
            <div className="space-y-3 sm:space-y-4">
              {statusData?.requiredDocuments.map((reqDoc) => {
                const uploaded = statusData.uploadedDocuments.filter((d) => d.documentType === reqDoc.type);
                const isUploaded = uploaded.length > 0;

                return (
                  <div
                    key={reqDoc.type}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                      isUploaded ? "border-emerald-200 bg-emerald-50/20" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 shrink-0 ${isUploaded ? "text-emerald-600" : "text-slate-400"}`} />
                          <h3 className="text-xs sm:text-sm font-bold text-navy leading-snug">{reqDoc.label}</h3>
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-1">Status: {isUploaded ? "Uploaded" : "Pending Upload"}</p>
                      </div>

                      <label className="cursor-pointer shrink-0 w-full sm:w-auto">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, reqDoc.type)}
                          disabled={uploadingType === reqDoc.type}
                        />
                        <span className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-semibold bg-sky text-white hover:bg-sky-600 transition-colors shadow-sm disabled:opacity-50">
                          {uploadingType === reqDoc.type ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-3.5 h-3.5" />
                              {isUploaded ? "Upload New" : "Upload File"}
                            </>
                          )}
                        </span>
                      </label>
                    </div>

                    {/* Uploaded Documents List */}
                    {uploaded.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        {uploaded.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between text-xs bg-white p-2 sm:p-2.5 rounded-lg border border-slate-100 gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span className="font-semibold text-slate-700 truncate min-w-0">{doc.fileName}</span>
                              <span className="text-slate-400 shrink-0">({(doc.fileSize / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded transition-colors shrink-0"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Checklist Confirmation Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecklist}
                  onChange={(e) => setConfirmChecklist(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-sky rounded border-slate-300 focus:ring-sky"
                />
                <span className="text-xs text-slate-700 font-medium leading-relaxed">
                  I hereby confirm and declare that all submitted documents are genuine, authentic, valid, and belong to me / this registered facility. I understand that fraudulent documents may result in account termination.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={handleProceedToMethodSelect}
                disabled={!statusData?.hasAllRequiredDocs || !confirmChecklist}
                className="w-full sm:flex-1 py-3 text-sm font-bold bg-navy text-white hover:bg-navy-800 disabled:opacity-50 transition-all rounded-xl"
              >
                Continue to OTP Channel Selection →
              </Button>
              <button
                type="button"
                onClick={handleSkipVerification}
                disabled={skipping}
                className="w-full sm:w-auto px-5 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all rounded-xl hover:text-navy"
              >
                {skipping ? "Skipping..." : "Skip for Now"}
              </button>
            </div>
          </div>
        )}


        {/* STEP 2: OTP DELIVERY METHOD SELECTION */}
        {step === "method_select" && (
          <div className="space-y-6 animate-fade-in">
            <button
              onClick={handleBackToDocuments}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-navy transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
              aria-label="Return to document uploads"
            >
              <ArrowLeft className="w-4 h-4" />
              ← Back to Documents
            </button>

            <div>
              <h2 className="text-lg font-bold text-navy">Where would you like to receive your verification OTP?</h2>
              <p className="text-xs text-slate-500 mt-1">
                Select your preferred registered contact method to receive the single-use verification code.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email Option */}
              <label
                onClick={() => setSelectedMethod("EMAIL")}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedMethod === "EMAIL"
                    ? "border-sky bg-sky-50/30 ring-2 ring-sky/10"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-sky-100/70 text-sky rounded-lg">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="otpMethod"
                    checked={selectedMethod === "EMAIL"}
                    onChange={() => setSelectedMethod("EMAIL")}
                    className="w-4 h-4 text-sky"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy">Registered Email</h4>
                  <p className="text-xs font-mono text-slate-600 mt-1">{statusData?.maskedEmail}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sent via Brevo Email API</p>
                </div>
              </label>

              {/* Mobile SMS Option */}
              <label
                onClick={() => statusData?.hasPhone && setSelectedMethod("SMS")}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  !statusData?.hasPhone
                    ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50"
                    : selectedMethod === "SMS"
                    ? "border-sky bg-sky-50/30 ring-2 ring-sky/10 cursor-pointer"
                    : "border-slate-200 bg-white hover:border-slate-300 cursor-pointer"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 bg-purple-100/70 text-purple-600 rounded-lg">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="otpMethod"
                    disabled={!statusData?.hasPhone}
                    checked={selectedMethod === "SMS"}
                    onChange={() => setSelectedMethod("SMS")}
                    className="w-4 h-4 text-sky"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-navy">Registered Mobile SMS</h4>
                  <p className="text-xs font-mono text-slate-600 mt-1">
                    {statusData?.hasPhone ? statusData.maskedPhone : "No registered mobile"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Sent via TextBee SMS Gateway</p>
                </div>
              </label>
            </div>

            <Button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full py-3 text-sm font-bold bg-navy text-white hover:bg-navy-800 transition-all rounded-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending Verification Code...
                </span>
              ) : (
                "Send Verification Code →"
              )}
            </Button>
          </div>
        )}

        {/* STEP 3: OTP VERIFICATION */}
        {step === "otp_verify" && (
          <div className="space-y-6 animate-fade-in text-center">
            <div className="flex justify-start">
              <button
                onClick={handleBackToMethodSelect}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-navy transition-colors px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
                aria-label="Return to OTP method selection"
              >
                <ArrowLeft className="w-4 h-4" />
                ← Back
              </button>
            </div>

            <div>
              <h2 className="text-lg font-bold text-navy">Enter Verification Code</h2>
              <p className="text-xs text-slate-500 mt-1">
                We sent a 6-digit code to{" "}
                <span className="font-semibold text-navy font-mono">{maskedDestination}</span>
              </p>
            </div>

            {/* OTP Input Component */}
            <OtpInput
              length={6}
              onComplete={handleVerifyOtp}
              disabled={otpStatus === "verifying" || otpStatus === "success"}
              status={otpStatus}
              errorMessage={otpErrorMessage}
              successMessage="Document Verification Successful!"
            />

            {/* Timer & Resend Controls */}
            <div className="space-y-2 pt-2 text-xs">
              {secondsLeft > 0 ? (
                <p className="text-slate-500">
                  Code expires in <span className="font-bold text-navy font-mono">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>
                </p>
              ) : (
                <p className="text-rose-600 font-semibold flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Code expired. Please request a new verification code.
                </p>
              )}

              <div className="pt-2">
                {resendTimer > 0 ? (
                  <p className="text-slate-400">
                    Resend code available in <span className="font-mono font-semibold">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleRequestOtp}
                    className="text-sky hover:text-sky-700 font-bold underline transition-colors"
                  >
                    Resend Verification Code
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUCCESS STATE */}
        {step === "success" && (
          <div className="space-y-6 animate-fade-in text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-navy">Document Verification Successful</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md mx-auto">
                Your submitted documents and contact details have been successfully verified. You now have full access to your CareSetu account.
              </p>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 max-w-md mx-auto text-left text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Account Status:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Account Role:</span>
                <span className="font-semibold text-navy uppercase">{roleLabel}</span>
              </div>
            </div>

            <Button
              onClick={handleContinueToDashboard}
              className="w-full max-w-md mx-auto py-3 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all rounded-xl shadow-md shadow-emerald-200"
            >
              Continue to Dashboard →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
