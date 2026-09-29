import { ReactNode, HTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";

export function Card({
  children,
  className = "",
  padded = true,
  hoverable = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  hoverable?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-card border border-slate-200/80 dark:border-slate-800 shadow-card transition-all duration-200 ${
        hoverable ? "hover:shadow-soft hover:border-sky-300 dark:hover:border-sky-700" : ""
      } ${padded ? "p-5" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "emergency" | "success" | "accent" | "info" | "warning";
  sub?: string;
  onClick?: () => void;
}) {
  const toneMap = {
    default: "text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/40",
    emergency: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40",
    success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40",
    accent: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40",
    info: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/50 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-800/40",
    warning: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40",
  };

  return (
    <Card
      padded
      hoverable={!!onClick}
      onClick={onClick}
      className={`flex items-start justify-between ${onClick ? "cursor-pointer" : ""}`}
    >
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </Card>
  );
}
