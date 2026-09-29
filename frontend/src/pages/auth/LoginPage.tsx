import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "../../components/common/Input";
import { PasswordInput } from "../../components/common/PasswordInput";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/common/Toast";
import { OtpInput } from "../../components/common/OtpInput";
import { authApi } from "../../services/api";
import GoogleAuthButton, { GoogleDivider } from "../../components/common/GoogleAuthButton";
import { useTranslation } from "../../i18n/I18nContext";

export default function LoginPage() {
  const { t } = useTranslation();
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [step, setStep] = useState<"form" | "otp_verify">("form");
  const [email, setEmail] = useState("patient@test.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [otpErrorMessage, setOtpErrorMessage] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  const { login, setSession } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsShake(false);
    try {
      const user = await login(email, password);
      showToast("success", `Welcome back, ${user.name}.`);
      navigate(`/${user.role}/dashboard`);
    } catch (error) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast("error", "Please enter your email or phone.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.requestOtp(email, "email");
      if (res.mock) {
        setMockMode(true);
        showToast("warning", "Demo mode: Check backend console for OTP");
      } else {
        showToast("success", "OTP sent to your email.");
      }
      setStep("otp_verify");
      setResendTimer(30);
      setOtpExpiresAt(Date.parse(res.expiresAt || new Date(Date.now() + 300000).toISOString()));
      setOtpExpired(false);
      setOtpResetKey((key) => key + 1);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otpCode: string) => {
    if (isVerifyingRef.current || otpStatus === "verifying" || otpStatus === "success") return;
    if (otpExpired) {
      setOtpStatus("error");
      setOtpErrorMessage("OTP expired. Please request a new OTP.");
      showToast("error", "OTP expired. Please request a new OTP.");
      return;
    }
    isVerifyingRef.current = true;
    setOtpStatus("verifying");
    setOtpErrorMessage(null);
    setLoading(true);

    try {
      const res = await authApi.verifyOtp(email, otpCode, "email");
      if (res.success && res.user && res.token) {
        const user = res.user;
        const token = res.token;
        setOtpStatus("success");
        showToast("success", `Welcome back, ${user.name || 'User'}.`);
        setTimeout(async () => {
          await setSession(user, token);
          navigate(`/${user.role.toLowerCase()}/dashboard`);
        }, 1000);
      } else {
        setOtpStatus("error");
        setOtpErrorMessage(res.message || "OTP Verification failed.");
        isVerifyingRef.current = false;
      }
    } catch (error) {
      setOtpStatus("error");
      const msg = error instanceof Error ? error.message : "Invalid verification code.";
      setOtpErrorMessage(msg);
      showToast("error", msg);
      isVerifyingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || (!otpExpired && secondsLeft > 240)) return;
    setLoading(true);
    try {
      const res = await authApi.requestOtp(email, "email");
      if (res.mock) {
        setMockMode(true);
        showToast("warning", "Demo mode: Check backend console for new OTP");
      } else {
        showToast("success", "New OTP sent.");
      }
      setResendTimer(30);
      setOtpExpiresAt(Date.parse(res.expiresAt || new Date(Date.now() + 300000).toISOString()));
      setOtpExpired(false);
      setOtpStatus("idle");
      setOtpErrorMessage(null);
      isVerifyingRef.current = false;
      setOtpResetKey((key) => key + 1);
    } catch (error) {
      showToast("error", "Could not resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromOtp = () => {
    setResendTimer(0);
    setOtpExpiresAt(null);
    setSecondsLeft(0);
    setOtpExpired(false);
    setOtpStatus("idle");
    setOtpErrorMessage(null);
    isVerifyingRef.current = false;
    setStep("form");
  };

  if (step === "otp_verify") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBackFromOtp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBackFromOtp();
              }
            }}
            aria-label="Return to login form to edit credentials"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
          >
            ← Back
          </button>
        </div>
        <h2 className="text-2xl font-extrabold text-navy text-center">Verify OTP</h2>
        <p className="text-sm text-text-secondary text-center mt-1.5 mb-6">
          We sent a code to <span className="font-semibold text-navy">{email}</span>
        </p>

        {mockMode && (
          <div className="bg-amber-50 text-amber-800 text-xs font-semibold p-3 rounded-lg mb-4 text-center border border-amber-200">
            Demo mode active: Check the backend console to see the OTP.
          </div>
        )}

        <OtpInput
          key={otpResetKey}
          length={6}
          onComplete={handleVerifyOtp}
          status={otpStatus}
          errorMessage={otpErrorMessage}
          successMessage="Email verified successfully"
          disabled={loading}
        />

        <p className={`text-center text-sm ${otpExpired ? "text-red-600 font-bold" : "text-text-secondary"}`}>
          {otpExpired
            ? "OTP expired"
            : `Expires in ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`}
        </p>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendTimer > 0 || loading || (!otpExpired && secondsLeft > 240)}
            className={`text-sm font-semibold ${resendTimer > 0 || loading || (!otpExpired && secondsLeft > 240) ? "text-slate-400" : "text-sky hover:underline"}`}
          >
            {resendTimer > 0
              ? `Resend code in ${resendTimer}s`
              : !otpExpired && secondsLeft > 240
                ? `Resend in ${secondsLeft - 240}s`
                : otpExpired ? "Get New OTP" : "Resend OTP"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold text-navy">Welcome back</h2>
      <p className="text-sm text-text-secondary mt-1.5 mb-6">CareSetu connects you with the healthcare network.</p>

      <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${loginMethod === "password" ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}
          onClick={() => setLoginMethod("password")}
        >
          Password
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${loginMethod === "otp" ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}
          onClick={() => setLoginMethod("otp")}
        >
          OTP
        </button>
      </div>

      {loginMethod === "password" ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="username" />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(val) => setPassword(val)}
            placeholder="Password"
            required
            showStrengthIndicator={false}
            showChecklist={false}
            isShake={isShake}
            autoComplete="current-password"
          />
          <div className="flex justify-end -mt-1">
            <Link to="/forgot-password" className="text-xs font-semibold text-sky hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Log in
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
          <Input label="Email or Phone" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          <Button type="submit" variant="primary" fullWidth loading={loading}>
            Send OTP
          </Button>
        </form>
      )}

      {/* OR Divider and Google Auth Button placed BELOW primary login button */}
      <GoogleDivider />
      <GoogleAuthButton />

      <p className="text-center text-sm text-text-secondary mt-6">
        Don't have an account?{" "}
        <Link to="/role-selection" className="text-sky font-semibold hover:underline">
          Get started
        </Link>
      </p>
    </div>
  );
}
