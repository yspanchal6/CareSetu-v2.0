import { ReactNode, HTMLAttributes } from "react";
import { LucideIcon } from "lucide-react";

export function Card({ children, className = "", padded = true, ...rest }: { children: ReactNode; className?: string; padded?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white rounded-card border border-slate-100 shadow-card ${padded ? "p-5" : ""} ${className}`} {...rest}>
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
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "emergency" | "success" | "accent";
  sub?: string;
}) {
  const toneMap = {
    default: "text-navy bg-lightblue",
    emergency: "text-emergency bg-red-50",
    success: "text-success bg-emerald-50",
    accent: "text-accent-dark bg-amber-50",
  };
  return (
    <Card className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-navy mt-1.5">{value}</p>
        {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </Card>
  );
}
