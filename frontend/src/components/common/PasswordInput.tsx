import React, { useState, useId } from "react";
import { Eye, EyeOff, Check, X, ShieldAlert, ShieldCheck } from "lucide-react";

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const DEFAULT_REQUIREMENTS: PasswordRequirement[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "uppercase", label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lowercase", label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "number", label: "One number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "One special character (!@#$%^&*)", test: (pw) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw) },
];

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  showStrengthIndicator?: boolean;
  showChecklist?: boolean;
  confirmValue?: string;
  showConfirmMatching?: boolean;
  isShake?: boolean;
  className?: string;
}

export function calculatePasswordStrength(password: string) {
  if (!password) return { score: 0, label: "Empty", percent: 0, colorClass: "bg-slate-200", textClass: "text-slate-400" };

  const passedCount = DEFAULT_REQUIREMENTS.filter((req) => req.test(password)).length;

  if (passedCount <= 2) {
    return {
      score: 1,
      label: "Weak",
      percent: 33,
      colorClass: "bg-red-500",
      textClass: "text-red-600 font-semibold",
      badgeBg: "bg-red-50 text-red-700 border-red-200",
    };
  } else if (passedCount <= 4) {
    return {
      score: 2,
      label: "Medium",
      percent: 66,
      colorClass: "bg-amber-500",
      textClass: "text-amber-600 font-semibold",
      badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    };
  } else {
    return {
      score: 3,
      label: "Strong",
      percent: 100,
      colorClass: "bg-emerald-500",
      textClass: "text-emerald-600 font-bold",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label = "Password",
  value = "",
  onChange,
  error,
  showStrengthIndicator = true,
  showChecklist = true,
  confirmValue,
  showConfirmMatching = false,
  isShake = false,
  className = "",
  id: customId,
  placeholder = "Enter password",
  required = false,
  disabled = false,
  autoComplete = "current-password",
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const generatedId = useId();
  const inputId = customId || `password-input-${generatedId}`;
  const strengthInfoId = `password-strength-${generatedId}`;

  const strength = calculatePasswordStrength(value);
  const isConfirmMatching = confirmValue !== undefined && value.length > 0 && confirmValue.length > 0 && value === confirmValue;
  const isConfirmMismatch = confirmValue !== undefined && confirmValue.length > 0 && value !== confirmValue;

  return (
    <div className={`w-full flex flex-col gap-1.5 ${isShake ? "animate-shake" : ""}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-navy">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative w-full">
        <input
          {...rest}
          id={inputId}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          aria-invalid={!!error || (value.length > 0 && strength.score === 1)}
          aria-describedby={showStrengthIndicator || showChecklist ? strengthInfoId : undefined}
          className={`w-full pl-4 pr-12 py-2.5 rounded-xl border text-sm bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-sky/30 focus:border-sky outline-none transition-all duration-200 ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-200"
              : isFocused
              ? "border-sky shadow-sm ring-2 ring-sky/20"
              : "border-slate-200 hover:border-slate-300"
          } ${disabled ? "bg-slate-100 cursor-not-allowed opacity-75" : ""} ${className}`}
        />

        {/* Touch-friendly 44x44px Toggle Button */}
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          tabIndex={0}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-navy focus:text-navy focus:outline-none focus:ring-2 focus:ring-sky/30 rounded-lg transition-colors cursor-pointer"
        >
          <span className="transition-transform duration-200 ease-out transform scale-100 hover:scale-110">
            {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
          </span>
        </button>
      </div>

      {/* Strength Indicator Bar */}
      {showStrengthIndicator && value.length > 0 && (
        <div id={strengthInfoId} className="mt-1 flex flex-col gap-1.5 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              {strength.score === 3 ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              )}
              Password Strength:
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${strength.badgeBg}`}>
              {strength.label}
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 ease-out ${strength.colorClass}`}
              style={{ width: `${strength.percent}%` }}
              role="progressbar"
              aria-valuenow={strength.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Password strength is ${strength.label}`}
            />
          </div>
        </div>
      )}

      {/* Confirm Password Match Feedback */}
      {showConfirmMatching && confirmValue !== undefined && confirmValue.length > 0 && (
        <div className="mt-1 text-xs transition-all duration-200">
          {isConfirmMatching ? (
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium animate-check-pop">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Passwords match</span>
            </div>
          ) : isConfirmMismatch ? (
            <div className="flex items-center gap-1.5 text-red-600 font-medium animate-x-pop">
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Passwords do not match</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Validation Requirements Checklist */}
      {showChecklist && (value.length > 0 || isFocused) && (
        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5 animate-fade-in">
          <p className="text-xs font-semibold text-navy mb-0.5">Password requirements:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {DEFAULT_REQUIREMENTS.map((req) => {
              const isMet = req.test(value);
              return (
                <div
                  key={req.id}
                  className={`flex items-center gap-1.5 text-xs transition-all duration-200 ${
                    isMet ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-200 ${
                      isMet ? "bg-emerald-100 text-emerald-700 animate-check-pop" : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {isMet ? <Check className="w-3 h-3 stroke-[3]" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                  </span>
                  <span>{req.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* External Error Display */}
      {error && <p className="text-xs text-red-600 font-medium mt-0.5 flex items-center gap-1"><X className="w-3.5 h-3.5 inline" /> {error}</p>}
    </div>
  );
};
