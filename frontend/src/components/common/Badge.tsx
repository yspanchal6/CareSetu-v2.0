import { ReactNode } from "react";

type Tone = "critical" | "urgent" | "stable" | "available" | "limited" | "busy" | "unavailable" | "accepted" | "rejected" | "pending" | "neutral" | "accent";

const toneClasses: Record<Tone, string> = {
  critical: "bg-red-50 text-emergency border border-red-100",
  urgent: "bg-amber-50 text-amber-700 border border-amber-100",
  stable: "bg-emerald-50 text-success border border-emerald-100",
  available: "bg-emerald-50 text-success border border-emerald-100",
  limited: "bg-amber-50 text-amber-700 border border-amber-100",
  busy: "bg-orange-50 text-orange-600 border border-orange-100",
  unavailable: "bg-red-50 text-emergency border border-red-100",
  accepted: "bg-emerald-50 text-success border border-emerald-100",
  rejected: "bg-red-50 text-emergency border border-red-100",
  pending: "bg-slate-100 text-text-secondary border border-slate-200",
  neutral: "bg-slate-100 text-text-secondary border border-slate-200",
  accent: "bg-amber-50 text-accent-dark border border-amber-100",
};

export default function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${toneClasses[tone]}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
