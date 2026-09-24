import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { User, Building2, Stethoscope, ShieldCheck, Check, Mail, Phone, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input, Select } from "../../components/common/Input";
import { PasswordInput } from "../../components/common/PasswordInput";
import Button from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/common/Toast";
import GoogleAuthButton, { GoogleDivider } from "../../components/common/GoogleAuthButton";

const roles: { role: "patient" | "hospital" | "doctor" | "admin"; icon: typeof User; title: string; desc: string }[] = [
  { role: "patient", icon: User, title: "Patient", desc: "Get matched with the right hospital during an emergency." },
  { role: "hospital", icon: Building2, title: "Hospital", desc: "Receive and manage incoming emergency cases." },
  { role: "doctor", icon: Stethoscope, title: "Doctor", desc: "Review assigned patients and coordinate treatment." },
  { role: "admin", icon: ShieldCheck, title: "Admin", desc: "Oversee the CareSetu network and system health." },
];

export function RoleSelectionPage() {
  const [selected, setSelected] = useState<"patient" | "hospital" | "doctor" | "admin">("patient");
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-2xl font-extrabold text-navy text-center">Choose your CareSetu profile</h2>
      <p className="text-sm text-text-secondary text-center mt-1.5 mb-6">Choose one to begin tailored onboarding</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roles.map((r) => (
          <button
            key={r.role}
            onClick={() => setSelected(r.role)}
            className={`text-left p-4 rounded-2xl border-2 transition-colors ${selected === r.role ? "border-sky bg-paleblue" : "border-slate-100 hover:border-slate-200"
              }`}
          >
            <div className="w-9 h-9 rounded-lg bg-lightblue flex items-center justify-center mb-2.5">
              <r.icon className="w-4.5 h-4.5 text-navy-dark" />
            </div>
            <p className="font-bold text-navy text-sm">{r.title}</p>
            <p className="text-xs text-text-secondary mt-1 leading-snug">{r.desc}</p>
          </button>
        ))}
      </div>

      <Button variant="primary" fullWidth className="mt-6" onClick={() => navigate(selected === "admin" ? "/login" : `/register?role=${selected}`)}>
        {selected === "admin" ? "Sign in with Admin account" : "Continue"}
      </Button>
      {selected === "admin" && <p className="text-center text-xs text-text-secondary mt-3">Admin accounts are provisioned by the platform owner.</p>}
      <p className="text-center text-sm text-text-secondary mt-4">
        Already have an account?{" "}
        <Link to="/login" className="text-sky font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

import { OtpInput } from "../../components/common/OtpInput";
import { authApi } from "../../services/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useAuth();
  const { showToast } = useToast();
  
  const role = searchParams.get("role") === "hospital" ? "hospital" : searchParams.get("role") === "doctor" ? "doctor" : "patient";
  const [step, setStep] = useState<"form" | "phone_otp" | "email_otp">("form");
  const [mockMode, setMockMode] = useState(false);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isShake, setIsShake] = useState(false);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [otpTarget, setOtpTarget] = useState<"phone" | "email">("email");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [useManualCoords, setUseManualCoords] = useState(false);
  
  const [resendTimer, setResendTimer] = useState(30);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [otpErrorMessage, setOtpErrorMessage] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  const maskEmail = (em: string) => {
    if (!em || !em.includes("@")) return em;
    const [namePart, domain] = em.split("@");
    if (namePart.length <= 2) return `${namePart[0]}***@${domain}`;
    return `${namePart[0]}***${namePart[namePart.length - 1]}@${domain}`;
  };

  const maskPhone = (ph: string) => {
    if (!ph || ph.length < 10) return ph;
    return `+91 ${ph.slice(0, 2)}*** **${ph.slice(8)}`;
  };

  useEffect(() => {
    if ((step === "phone_otp" || step === "email_otp") && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendTimer]);

  useEffect(() => {
    if ((step !== "phone_otp" && step !== "email_otp") || otpExpiresAt === null) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      setOtpExpired(remaining === 0);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [step, otpExpiresAt]);

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setUseManualCoords(true);
      },
      (error) => {
        alert('Could not get location: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartPhoneVerification = async () => {
    if (phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
      showToast("error", "Please enter a valid 10-digit Indian phone number.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.requestOtp({ identifier: phone, phone, purpose: "PHONE_VERIFICATION" });
      if (res.mock) {
        setMockMode(true);
        showToast("warning", "Demo mode: Check backend console for SMS OTP");
      } else {
        showToast("success", "OTP sent via SMS to your phone.");
      }
      setOtpTarget("phone");
      setStep("phone_otp");
      setResendTimer(30);
      setOtpExpiresAt(Date.parse(res.expiresAt || new Date(Date.now() + 300000).toISOString()));
      setOtpExpired(false);
      setOtpStatus("idle");
      setOtpErrorMessage(null);
      isVerifyingRef.current = false;
      setOtpResetKey((key) => key + 1);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Unable to send phone OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEmailVerification = async () => {
    if (!email || !email.includes("@")) {
      showToast("error", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.requestOtp({ identifier: email, email, purpose: "EMAIL_VERIFICATION" });
      if (res.mock) {
        setMockMode(true);
        showToast("warning", "Demo mode: Check backend console for Email OTP");
      } else {
        showToast("success", "OTP sent via Brevo to your email.");
      }
      setOtpTarget("email");
      setStep("email_otp");
      setResendTimer(30);
      setOtpExpiresAt(Date.parse(res.expiresAt || new Date(Date.now() + 300000).toISOString()));
      setOtpExpired(false);
      setOtpStatus("idle");
      setOtpErrorMessage(null);
      isVerifyingRef.current = false;
      setOtpResetKey((key) => key + 1);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Unable to send email OTP.");
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

    const isPhone = otpTarget === "phone";
    const targetIdentifier = isPhone ? phone : email;
    const purpose = isPhone ? "PHONE_VERIFICATION" : "EMAIL_VERIFICATION";

    try {
      const res = await authApi.verifyOtp({ identifier: targetIdentifier, otpCode, purpose });
      if (res.success) {
        setOtpStatus("success");
        if (isPhone) {
          setPhoneVerified(true);
          setVerifiedPhone(phone);
          showToast("success", "Phone number verified successfully.");
        } else {
          setEmailVerified(true);
          setVerifiedEmail(email);
          showToast("success", "Email address verified successfully.");
        }

        setTimeout(() => {
          setStep("form");
          setOtpStatus("idle");
          isVerifyingRef.current = false;
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

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsShake(false);

    if (!phoneVerified || phone !== verifiedPhone) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", "Please verify your phone number before submitting.");
      return;
    }

    if (!emailVerified || email.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", "Please verify your email address before submitting.");
      return;
    }

    if (password !== confirmPassword) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.signup({
        name,
        email,
        password,
        phone,
        role: role === "patient" ? "PATIENT" : role === "hospital" ? "HOSPITAL" : "DOCTOR",
        ...(role === "patient"
          ? { age: Number(age), gender }
          : role === "hospital"
            ? {
              address, city, state, pincode,
              ...(useManualCoords && latitude !== null && longitude !== null ? { latitude, longitude } : {})
            }
            : {}),
      });

      if (res.user && res.token) {
        await setSession(res.user, res.token);
        showToast("success", "Account created successfully! Please complete document verification.");
        navigate("/verify-documents");
      }
    } catch (error) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", error instanceof Error ? error.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async () => {
    const target = email || phone;
    if (target) {
      try {
        await authApi.cancelRegistration(target);
      } catch {
        // Silently handled on cancel navigation
      }
    }
    setEmailVerified(false);
    setPhoneVerified(false);
    setVerifiedEmail("");
    setVerifiedPhone("");
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    navigate("/register");
  };

  const handleBackFromOtp = async () => {
    const isPhone = step === "phone_otp";
    const targetIdentifier = isPhone ? phone : email;

    // Clean up timers and OTP state
    setResendTimer(0);
    setOtpExpiresAt(null);
    setSecondsLeft(0);
    setOtpExpired(false);
    setOtpStatus("idle");
    setOtpErrorMessage(null);
    isVerifyingRef.current = false;

    // Revoke pending verification session on backend
    if (targetIdentifier) {
      try {
        await authApi.cancelRegistration(targetIdentifier);
      } catch {
        // Silently handled on back navigation
      }
    }

    // Reset verification status if details are not fully verified
    if (isPhone && verifiedPhone !== phone) {
      setPhoneVerified(false);
    }
    if (!isPhone && verifiedEmail.toLowerCase() !== email.trim().toLowerCase()) {
      setEmailVerified(false);
    }

    // Return to form step with all form inputs preserved
    setStep("form");
  };

  if (step === "phone_otp" || step === "email_otp") {
    const isPhone = step === "phone_otp";
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
            aria-label="Return to registration form to edit contact details"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
          >
            ← Back
          </button>
        </div>
        <h2 className="text-2xl font-extrabold text-navy text-center">
          {isPhone ? "Verify Phone Number" : "Verify Email Address"}
        </h2>
        <p className="text-sm text-text-secondary text-center mt-1.5 mb-6">
          We sent a 6-digit code to <span className="font-semibold text-navy">{isPhone ? maskPhone(phone) : maskEmail(email)}</span>
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
          successMessage={isPhone ? "Phone verified successfully" : "Email verified successfully"}
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
            onClick={isPhone ? handleStartPhoneVerification : handleStartEmailVerification}
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
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handleCancelRegistration}
          className="text-xs font-semibold text-slate-500 hover:text-navy flex items-center gap-1 cursor-pointer"
        >
          ← Back to Profile Selection
        </button>
      </div>
      <h2 className="text-2xl font-extrabold text-navy">Create your {role} account</h2>
      <p className="text-sm text-text-secondary mt-1.5 mb-6">Your details are saved securely in CareSetu.</p>

      <GoogleAuthButton
        role={role.toUpperCase()}
        isRegistration={true}
        profileData={{
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          age: age ? Number(age) : undefined,
          gender: gender || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          pincode: pincode.trim() || undefined,
          latitude: latitude !== null ? latitude : undefined,
          longitude: longitude !== null ? longitude : undefined,
        }}
        buttonText={`Continue as ${role.charAt(0).toUpperCase() + role.slice(1)} with Google`}
      />
      <GoogleDivider />

      <form className="flex flex-col gap-4" onSubmit={handleRegister}>
        <Input label={role === "hospital" ? "Hospital name" : "Full name"} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-semibold text-navy">Email</label>
            {emailVerified && email.trim().toLowerCase() === verifiedEmail.toLowerCase() ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" /> Email Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={handleStartEmailVerification}
                disabled={loading || !email.includes("@")}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                  email.includes("@")
                    ? "bg-sky/10 border-sky/30 text-sky hover:bg-sky/20 cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                Verify Email
              </button>
            )}
          </div>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              const val = e.target.value;
              setEmail(val);
              if (val.trim().toLowerCase() !== verifiedEmail.toLowerCase()) setEmailVerified(false);
            }}
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-sm font-semibold text-navy">Phone</label>
            {phoneVerified && phone === verifiedPhone ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" /> Phone Number Verified
              </span>
            ) : (
              <button
                type="button"
                onClick={handleStartPhoneVerification}
                disabled={loading || phone.length !== 10}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                  phone.length === 10
                    ? "bg-sky/10 border-sky/30 text-sky hover:bg-sky/20 cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                Verify Number
              </button>
            )}
          </div>
          <div className="flex relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">+91</span>
            <input
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                if (val.length <= 10) {
                  setPhone(val);
                  if (val !== verifiedPhone) setPhoneVerified(false);
                }
              }}
              required
              maxLength={10}
              pattern="^[6-9]\d{9}$"
              title="Please enter a valid 10-digit Indian phone number starting with 6-9"
              className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none transition-colors"
            />
          </div>
        </div>
        {role === "patient" ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Age" type="number" min="0" max="130" value={age} onChange={(e) => setAge(e.target.value)} required />
            <Select label="Gender" value={gender} onChange={(e) => setGender(e.target.value)} required>
              <option value="" disabled>Select</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </Select>
          </div>
        ) : role === "hospital" ? (
          <>
            <div>
              <Input label="Hospital address" placeholder="Street, Area" value={address} onChange={(e) => setAddress(e.target.value)} required />
              <button
                type="button"
                onClick={captureCurrentLocation}
                className="mt-2 w-full py-2 px-4 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-sky hover:text-sky transition-colors flex items-center justify-center gap-2"
              >
                📍 Use My Current Location
              </button>
              {useManualCoords && latitude !== null && longitude !== null && (
                <div className="mt-2 p-2 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200 flex items-center gap-2">
                  <span>✅ GPS location captured ({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
                </div>
              )}
              <p className="text-[11px] text-text-secondary mt-1">Please enter the hospital's complete address with street name and landmark.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required />
              <Input label="State" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} required />
            </div>
            <Input label="Pincode" placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} required />
          </>
        ) : null}
        <PasswordInput
          label="Password"
          value={password}
          onChange={(val) => setPassword(val)}
          placeholder="At least 8 characters (Uppercase, lowercase, digit, special char)"
          required
          showStrengthIndicator={true}
          showChecklist={true}
          isShake={isShake}
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirm password"
          value={confirmPassword}
          onChange={(val) => setConfirmPassword(val)}
          placeholder="Confirm password"
          required
          showStrengthIndicator={false}
          showChecklist={false}
          confirmValue={password}
          showConfirmMatching={true}
          isShake={isShake}
          autoComplete="new-password"
        />
        <label className="flex items-start gap-2 text-xs text-text-secondary">
          <input type="checkbox" required className="mt-0.5" />
          I agree to the CareSetu <Link to="#" className="text-sky font-medium">Privacy Policy</Link>
        </label>
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Register
        </Button>
      </form>
      <p className="text-center text-sm text-text-secondary mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-sky font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export function VerifyOtpPage() {
  const [code, setCode] = useState(["0", "4", "", "", "", ""]);
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div className="text-center">
      <div className="flex items-center justify-start mb-4 text-left">
        <button
          type="button"
          onClick={() => navigate("/login")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/login");
            }
          }}
          aria-label="Return to login page"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
        >
          ← Back
        </button>
      </div>
      <h2 className="text-2xl font-extrabold text-navy">Verify your identity</h2>
      <p className="text-sm text-text-secondary mt-1.5 mb-6">Enter the 6-digit code sent to your registered contact.</p>
      <div className="flex justify-center gap-2 mb-6">
        {code.map((c, i) => (
          <input
            key={i}
            value={c}
            maxLength={1}
            onChange={(e) => {
              const next = [...code];
              next[i] = e.target.value.replace(/\D/g, "");
              setCode(next);
            }}
            className="w-11 h-12 text-center text-lg font-bold rounded-xl border border-slate-200 focus:border-sky focus:ring-2 focus:ring-sky/30 outline-none"
          />
        ))}
      </div>
      <Button
        variant="primary"
        fullWidth
        onClick={() => {
          showToast("success", "Identity verified successfully.");
          navigate("/login");
        }}
      >
        Verify and continue
      </Button>
      <button className="text-xs font-semibold text-sky mt-4 hover:underline">Resend code</button>
    </div>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [loading, setLoading] = useState(false);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isShake, setIsShake] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // OTP State
  const [resendTimer, setResendTimer] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [otpStatus, setOtpStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [otpErrorMessage, setOtpErrorMessage] = useState<string | null>(null);
  const isVerifyingRef = useRef(false);

  const maskEmail = (em: string) => {
    if (!em || !em.includes("@")) return em;
    const [namePart, domain] = em.split("@");
    if (namePart.length <= 2) return `${namePart[0]}***@${domain}`;
    return `${namePart[0]}***${namePart[namePart.length - 1]}@${domain}`;
  };

  const maskPhone = (ph: string) => {
    if (!ph || ph.length < 10) return ph;
    return `+91 ${ph.slice(0, 2)}*** **${ph.slice(8)}`;
  };

  useEffect(() => {
    if (step === "otp" && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendTimer]);

  useEffect(() => {
    if (step !== "otp" || otpExpiresAt === null) return;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      setOtpExpired(remaining === 0);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [step, otpExpiresAt]);

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  const handleToggleMethod = () => {
    setFieldError(null);
    if (contactMethod === "email") {
      setContactMethod("phone");
      setTimeout(() => {
        phoneInputRef.current?.focus();
      }, 60);
    } else {
      setContactMethod("email");
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 60);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFieldError(null);

    if (contactMethod === "email") {
      if (!email || !email.includes("@")) {
        setFieldError("Please enter a valid email address.");
        triggerShake();
        showToast("error", "Please enter a valid email address.");
        return;
      }
    } else {
      if (!phone || phone.length !== 10 || !/^[6-9]\d{9}$/.test(phone)) {
        setFieldError("Please enter a valid 10-digit Indian phone number starting with 6-9.");
        triggerShake();
        showToast("error", "Please enter a valid 10-digit Indian phone number.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = contactMethod === "email" ? { email } : { phone };
      const res = await authApi.forgotPassword(payload);
      showToast("success", res.message || "Verification code sent if an account exists.");
      setStep("otp");
      setResendTimer(30);
      setOtpExpiresAt(Date.now() + 300000);
      setOtpExpired(false);
      setOtpStatus("idle");
      setOtpErrorMessage(null);
      isVerifyingRef.current = false;
      setOtpResetKey((k) => k + 1);
    } catch (err: any) {
      const errMsg = err?.data?.error || err?.message || "Unable to process password reset request.";
      setFieldError(errMsg);
      triggerShake();
      showToast("error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (otpCode: string) => {
    if (isVerifyingRef.current || otpStatus === "verifying" || otpStatus === "success") return;
    if (otpExpired) {
      setOtpStatus("error");
      setOtpErrorMessage("OTP expired. Please request a new code.");
      showToast("error", "OTP expired. Please request a new code.");
      return;
    }
    isVerifyingRef.current = true;
    setOtpStatus("verifying");
    setOtpErrorMessage(null);
    setLoading(true);

    const identifier = contactMethod === "email" ? email : phone;
    const purpose = contactMethod === "email" ? "PASSWORD_RESET_EMAIL" : "PASSWORD_RESET_PHONE";

    try {
      const res = await authApi.verifyOtp({ identifier, otpCode, purpose });
      if (res.success && res.resetToken) {
        setOtpStatus("success");
        showToast("success", "OTP verified successfully! Redirecting...");
        setTimeout(() => {
          navigate(`/reset-password?email=${encodeURIComponent(identifier)}&token=${encodeURIComponent(res.resetToken!)}`);
        }, 1000);
      } else if (res.success) {
        setOtpStatus("success");
        showToast("success", "OTP verified! Redirecting...");
        setTimeout(() => {
          navigate(`/reset-password?email=${encodeURIComponent(identifier)}`);
        }, 1000);
      } else {
        setOtpStatus("error");
        setOtpErrorMessage(res.message || "OTP verification failed.");
        isVerifyingRef.current = false;
      }
    } catch (err: any) {
      setOtpStatus("error");
      const msg = err?.data?.error || err?.message || "Invalid verification code.";
      setOtpErrorMessage(msg);
      showToast("error", msg);
      isVerifyingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;

    setLoading(true);
    setOtpStatus("idle");
    setOtpErrorMessage(null);

    try {
      const payload = contactMethod === "email" ? { email } : { phone };
      const res = await authApi.forgotPassword(payload);

      showToast("success", res.message || "A new verification code has been sent.");
      setResendTimer(45);
      setOtpExpiresAt(Date.now() + 300000);
      setOtpExpired(false);
      setOtpStatus("idle");
      setOtpErrorMessage(null);
      isVerifyingRef.current = false;
      setOtpResetKey((k) => k + 1);
    } catch (err: any) {
      const errMsg = err?.data?.error || err?.message || "Unable to resend verification code.";
      setOtpStatus("error");
      setOtpErrorMessage(errMsg);
      showToast("error", errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = async () => {
    setResendTimer(0);
    setOtpExpiresAt(null);
    setSecondsLeft(0);
    setOtpExpired(false);
    setOtpStatus("idle");
    setOtpErrorMessage(null);
    setFieldError(null);
    isVerifyingRef.current = false;

    try {
      await authApi.cancelForgotPassword(email || undefined, phone || undefined);
    } catch {
      // Silently handled
    }
    setStep("credentials");
  };

  if (step === "otp") {
    const isEmail = contactMethod === "email";
    const maskedContact = isEmail ? maskEmail(email) : maskPhone(phone);

    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={handleBackToCredentials}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleBackToCredentials();
              }
            }}
            aria-label="Return to password recovery form to edit contact details"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky-500/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
          >
            ← Back
          </button>
        </div>
        <h2 className="text-2xl font-extrabold text-navy text-center">
          {isEmail ? "Verify Email OTP" : "Verify Phone OTP"}
        </h2>
        <p className="text-sm text-text-secondary text-center mt-1.5 mb-6">
          We sent a verification code to <span className="font-semibold text-navy">{maskedContact}</span>
        </p>

        <OtpInput
          key={otpResetKey}
          length={6}
          onComplete={handleVerifyOtp}
          status={otpStatus}
          errorMessage={otpErrorMessage}
          successMessage="OTP verified! Redirecting..."
          disabled={loading}
        />

        <div className="flex flex-col items-center gap-3 mt-4">
          <p className={`text-center text-sm ${otpExpired ? "text-red-600 font-bold" : "text-text-secondary"}`}>
            {otpExpired
              ? "OTP expired"
              : `Expires in ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`}
          </p>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendTimer > 0 || loading}
            className={`text-sm font-semibold transition-colors ${
              resendTimer > 0 || loading
                ? "text-slate-400 cursor-not-allowed"
                : "text-sky hover:underline cursor-pointer"
            }`}
          >
            {resendTimer > 0
              ? `Resend OTP in ${resendTimer}s`
              : otpExpired
              ? "Get New OTP"
              : "Resend OTP"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center animate-fade-in">
      <div className="flex items-center justify-start mb-4 text-left">
        <button
          type="button"
          onClick={() => navigate("/login")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/login");
            }
          }}
          aria-label="Return to login page"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky-500/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
        >
          ← Back
        </button>
      </div>
      <h2 className="text-2xl font-extrabold text-navy">Recover your password</h2>
      <p className="text-sm text-text-secondary mt-1.5 mb-6">
        Enter your registered contact details to receive a verification OTP.
      </p>
      <form className="flex flex-col gap-4 text-left" onSubmit={handleRequestOtp} noValidate>
        {contactMethod === "email" ? (
          <div key="email-field" className={`animate-slide-in-left ${isShake ? "animate-shake" : ""}`}>
            <label htmlFor="forgot-email-input" className="block text-sm font-semibold text-navy mb-1.5 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-sky-600" aria-hidden="true" />
              Registered Email Address
            </label>
            <div className="relative">
              <input
                id="forgot-email-input"
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldError) setFieldError(null);
                }}
                placeholder="you@example.com"
                required
                aria-required="true"
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "email-error-msg" : undefined}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
                  fieldError
                    ? "border-red-400 focus:ring-2 focus:ring-red-400/30 focus:border-red-500 shadow-sm shadow-red-100"
                    : "border-slate-200 focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 hover:border-slate-300"
                }`}
              />
            </div>
            {fieldError && (
              <p id="email-error-msg" className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1 animate-fade-in" role="alert">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {fieldError}
              </p>
            )}
          </div>
        ) : (
          <div key="phone-field" className={`animate-slide-in-right ${isShake ? "animate-shake" : ""}`}>
            <label htmlFor="forgot-phone-input" className="block text-sm font-semibold text-navy mb-1.5 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-sky-600" aria-hidden="true" />
              Registered Mobile Number
            </label>
            <div className="flex relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm select-none">+91</span>
              <input
                id="forgot-phone-input"
                ref={phoneInputRef}
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  if (fieldError) setFieldError(null);
                }}
                required
                aria-required="true"
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? "phone-error-msg" : undefined}
                maxLength={10}
                pattern="^[6-9]\d{9}$"
                title="Please enter a valid 10-digit Indian phone number starting with 6-9"
                className={`w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm bg-white placeholder:text-slate-400 focus:outline-none transition-all duration-200 ${
                  fieldError
                    ? "border-red-400 focus:ring-2 focus:ring-red-400/30 focus:border-red-500 shadow-sm shadow-red-100"
                    : "border-slate-200 focus:ring-4 focus:ring-sky-500/15 focus:border-sky-500 hover:border-slate-300"
                }`}
              />
            </div>
            {fieldError && (
              <p id="phone-error-msg" className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1 animate-fade-in" role="alert">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {fieldError}
              </p>
            )}
          </div>
        )}

        <div className="relative my-2 select-none">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200/80" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-50 px-3 text-slate-400 font-bold tracking-wider rounded-full text-[10px] py-0.5 border border-slate-200/60 shadow-2xs">OR</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleMethod}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggleMethod();
            }
          }}
          className="w-full text-center text-xs font-bold text-sky-600 hover:text-sky-700 py-2.5 px-3 rounded-xl border border-sky-100 hover:border-sky-200 bg-sky-50/50 hover:bg-sky-50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer flex items-center justify-center gap-2 group"
          aria-label={contactMethod === "email" ? "Switch to use mobile number instead" : "Switch to use email address instead"}
        >
          <span key={contactMethod} className="animate-text-fade flex items-center gap-1.5">
            {contactMethod === "email" ? (
              <>
                <Phone className="w-3.5 h-3.5 text-sky-500 group-hover:scale-110 transition-transform duration-200" />
                Use Mobile Number Instead
              </>
            ) : (
              <>
                <Mail className="w-3.5 h-3.5 text-sky-500 group-hover:scale-110 transition-transform duration-200" />
                Use Email Address Instead
              </>
            )}
          </span>
        </button>

        <Button type="submit" variant="primary" fullWidth loading={loading} disabled={loading}>
          Continue
        </Button>
      </form>
    </div>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [email, setEmail] = useState(searchParams.get("email") || searchParams.get("identifier") || "");
  const [resetToken, setResetToken] = useState(searchParams.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isShake, setIsShake] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsShake(false);
    if (newPassword !== confirmPassword) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", "New password and password confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", "Password must be at least 8 characters long.");
      return;
    }
    if (!resetToken) {
      showToast("error", "Authorization reset token is missing or expired. Please complete OTP verification first.");
      navigate("/forgot-password");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword({ email, resetToken, newPassword, confirmPassword });
      showToast("success", res.message || "Password reset successfully.");
      navigate("/login");
    } catch (err) {
      setIsShake(true);
      setTimeout(() => setIsShake(false), 600);
      showToast("error", err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-start mb-4 text-left">
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate("/forgot-password");
            }
          }}
          aria-label="Return to forgot password form"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus:ring-2 focus:ring-sky/30 rounded-lg px-2.5 py-1.5 transition-all active:scale-95 cursor-pointer"
        >
          ← Back
        </button>
      </div>
      <h2 className="text-2xl font-extrabold text-navy">Create a new password</h2>
      <p className="text-sm text-text-secondary mt-1.5 mb-6">Identity verified. Enter your new account password below.</p>
      <form className="flex flex-col gap-4 text-left" onSubmit={handleResetPassword}>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required readOnly />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={(val) => setNewPassword(val)}
          placeholder="At least 8 characters (Uppercase, lowercase, digit, special char)"
          required
          showStrengthIndicator={true}
          showChecklist={true}
          isShake={isShake}
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirm password"
          value={confirmPassword}
          onChange={(val) => setConfirmPassword(val)}
          placeholder="Confirm new password"
          required
          showStrengthIndicator={false}
          showChecklist={false}
          confirmValue={newPassword}
          showConfirmMatching={true}
          isShake={isShake}
          autoComplete="new-password"
        />
        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Reset password
        </Button>
      </form>
    </div>
  );
}
