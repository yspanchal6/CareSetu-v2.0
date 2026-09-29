import { ReactNode } from "react";

type Tone =
  | "critical"
  | "urgent"
  | "stable"
  | "available"
  | "limited"
  | "busy"
  | "unavailable"
  | "accepted"
  | "rejected"
  | "pending"
  | "neutral"
  | "accent"
  | "high"
  | "medium"
  | "low"
  | "matched"
  | "emergency";

const toneClasses: Record<Tone, string> = {
  critical: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  urgent: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  stable: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  available: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  limited: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  busy: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  unavailable: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  rejected: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  pending: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
  neutral: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20",
  matched: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold",
  emergency: "bg-red-600 text-white border border-red-700 shadow-emergency font-bold animate-pulse",
};

export default function Badge({
  tone = "neutral",
  children,
  dot,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${toneClasses[tone]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      <span>{children}</span>
    </span>
  );
}
