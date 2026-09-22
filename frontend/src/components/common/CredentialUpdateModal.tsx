import { useState, useEffect } from "react";
import { settingsApi } from "../../services/api";
import { Card } from "./Card";
import { Input } from "./Input";
import Button from "./Button";
import { KeyRound, Mail, Phone, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

interface CredentialUpdateModalProps {
  type: "EMAIL" | "MOBILE";
  currentValue: string;
  onClose: () => void;
  onSuccess: (newValue: string) => void;
}

export function CredentialUpdateModal({
  type,
  currentValue,
  onClose,
  onSuccess,
}: CredentialUpdateModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [newValue, setNewValue] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Timer & Resend state
  const [countdown, setCountdown] = useState(300); // 5 mins
  const [resendCooldown, setResendCooldown] = useState(60); // 60s

  useEffect(() => {
    let timer: any;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) {
      setError(`Please enter a new ${type === "EMAIL" ? "email address" : "mobile number"}.`);
      return;
    }
    if (!currentPassword) {
      setError("Current password is required for security verification.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await settingsApi.requestCredentialChange(type, newValue.trim(), currentPassword);
      setRequestId(res.requestId);
      setMaskedDestination(res.maskedDestination);
      if (res.devOtp) setDevOtp(res.devOtp);
      setStep(2);
      setCountdown(300);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to request verification OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError("Please enter the 6-digit verification OTP.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await settingsApi.verifyCredentialOtp(requestId, otp.trim(), type);
      setSuccessMsg(res.message);
      setTimeout(() => {
        onSuccess(res.newValue);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Database credential remains unchanged.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await settingsApi.requestCredentialChange(type, newValue.trim(), currentPassword);
      setRequestId(res.requestId);
      if (res.devOtp) setDevOtp(res.devOtp);
      setCountdown(300);
      setResendCooldown(60);
      setError("A new OTP has been sent.");
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (requestId) {
      settingsApi.cancelCredentialChange(requestId, type).catch(() => {});
    }
    onClose();
  };

  const handleBackToEdit = async () => {
    if (requestId) {
      settingsApi.cancelCredentialChange(requestId, type).catch(() => {});
    }
    setStep(1);
    setOtp("");
    setError(null);
    setDevOtp(undefined);
    setCountdown(300);
    setResendCooldown(60);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            {type === "EMAIL" ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-navy text-base">
              Update {type === "EMAIL" ? "Email Address" : "Mobile Number"}
            </h3>
            <p className="text-xs text-slate-500">
              Current: <span className="font-medium text-navy">{currentValue}</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="flex flex-col gap-3">
            <Input
              label={`New ${type === "EMAIL" ? "Email Address" : "Mobile Number"}`}
              type={type === "EMAIL" ? "email" : "tel"}
              placeholder={type === "EMAIL" ? "newemail@domain.com" : "9876543210"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
            />
            <Input
              label="Current Account Password"
              type="password"
              placeholder="Enter current password to authorize"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={loading}>
                {loading ? "Sending OTP..." : "Send Verification OTP"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
            <div className="flex items-center justify-start mb-1">
              <button
                type="button"
                onClick={handleBackToEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBackToEdit();
                  }
                }}
                aria-label={`Return to update ${type === "EMAIL" ? "email address" : "mobile number"}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
              >
                ← Back
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-navy">
                Verification OTP sent to: <span className="text-sky-600 font-mono">{maskedDestination}</span>
              </p>
              <p className="text-slate-500 text-[11px]">
                Expires in: <span className="font-bold text-navy font-mono">{formatTime(countdown)}</span>
              </p>
              {devOtp && (
                <p className="text-[10px] text-amber-600 font-mono mt-1">
                  DEV TEST OTP: <strong>{devOtp}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Enter 6-Digit OTP
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full text-center text-lg font-mono font-bold tracking-widest p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-400 outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sky-600 font-semibold hover:underline disabled:text-slate-400 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" type="button" onClick={handleCancel} disabled={loading}>
                Cancel
              </Button>
              <Button variant="success" size="sm" type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Update Credential"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

export default CredentialUpdateModal;
