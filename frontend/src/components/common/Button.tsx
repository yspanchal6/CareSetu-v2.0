import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "success" | "ghost" | "outline" | "emergency";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-sky-500 text-white hover:bg-sky-600 focus-visible:ring-2 focus-visible:ring-sky-400 shadow-soft",
  secondary: "bg-navy-dark text-white hover:bg-navy focus-visible:ring-2 focus-visible:ring-navy shadow-soft",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400 shadow-soft",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400 shadow-soft",
  emergency: "bg-emergency text-white hover:bg-emergency-dark focus-visible:ring-2 focus-visible:ring-emergency-glow shadow-emergency animate-pulseRing",
  ghost: "bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
  outline: "bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs font-semibold px-3 py-1.5 gap-1.5 rounded-lg",
  md: "text-sm font-semibold px-4 py-2.5 gap-2 rounded-xl",
  lg: "text-base font-semibold px-6 py-3.5 gap-2.5 rounded-xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  fullWidth,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const isDisable = disabled || loading;

  return (
    <button
      disabled={isDisable}
      aria-disabled={isDisable}
      aria-busy={loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon}
      <span>{children}</span>
    </button>
  );
}
