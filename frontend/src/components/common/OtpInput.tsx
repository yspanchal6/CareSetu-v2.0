import { useRef, useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
  status?: 'idle' | 'verifying' | 'success' | 'error';
  errorMessage?: string | null;
  successMessage?: string | null;
  isShake?: boolean;
}

export const OtpInput = ({
  length = 6,
  onComplete,
  disabled = false,
  status = 'idle',
  errorMessage,
  successMessage,
  isShake = false,
}: OtpInputProps) => {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const isCompleteTriggered = useRef(false);

  const isDisabled = disabled || status === 'verifying' || status === 'success';

  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isDisabled) return;
    const value = element.value.replace(/[^0-9]/g, '');
    if (!value && element.value !== '') return;

    const newOtp = [...otp];
    newOtp[index] = value[value.length - 1] || '';
    setOtp(newOtp);

    // Move to next input
    if (value && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Check if complete
    if (newOtp.every(v => v !== '') && !isCompleteTriggered.current) {
      isCompleteTriggered.current = true;
      onComplete(newOtp.join(''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (isDisabled) return;
    if (e.key === 'Backspace') {
      isCompleteTriggered.current = false;
      if (!otp[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
    if (!pastedData) return;

    const newOtp = new Array(length).fill('');
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);

    const nextFocusIndex = Math.min(pastedData.length, length - 1);
    inputs.current[nextFocusIndex]?.focus();

    if (pastedData.length === length && !isCompleteTriggered.current) {
      isCompleteTriggered.current = true;
      onComplete(newOtp.join(''));
    }
  };

  // Reset completion lock if user edits or status resets to idle/error
  useEffect(() => {
    if (status === 'error' || status === 'idle') {
      isCompleteTriggered.current = false;
    }
  }, [status]);

  const getBoxStyles = () => {
    const base = "w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg transition-all duration-300 outline-none motion-reduce:transition-none";
    if (status === 'success') {
      return `${base} border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-sm shadow-emerald-100 scale-[1.02]`;
    }
    if (status === 'error' || isShake) {
      return `${base} border-rose-500 bg-rose-50/30 text-rose-700 animate-shake`;
    }
    if (status === 'verifying') {
      return `${base} border-sky ring-2 ring-sky/20 bg-sky-50/20 text-navy animate-pulse cursor-wait`;
    }
    return `${base} border-slate-200 focus:border-sky bg-white text-navy shadow-sm disabled:bg-slate-50 disabled:text-slate-400`;
  };

  return (
    <div className="flex flex-col items-center gap-3 my-4">
      <div 
        className={`flex gap-3 justify-center ${status === 'error' || isShake ? 'animate-shake' : ''}`}
        role="group"
        aria-label="OTP digit inputs"
      >
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={el => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={isDisabled}
            aria-label={`Digit ${i + 1} of ${length}`}
            onChange={e => handleChange(e.target, i)}
            onKeyDown={e => handleKeyDown(e, i)}
            onPaste={handlePaste}
            className={getBoxStyles()}
          />
        ))}
      </div>

      <div role="status" aria-live="polite" className="min-h-[24px] flex items-center justify-center">
        {status === 'verifying' && (
          <p className="text-xs font-semibold text-sky animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky animate-ping" />
            Verifying code...
          </p>
        )}
        {status === 'success' && (
          <div className="flex items-center gap-2 bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full animate-fade-in transition-all">
            <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span>{successMessage || "Email verified successfully"}</span>
          </div>
        )}
        {(status === 'error' || errorMessage) && (
          <p className="text-xs font-semibold text-rose-600 animate-fade-in">
            {errorMessage || "Invalid verification code"}
          </p>
        )}
      </div>
    </div>
  );
};
