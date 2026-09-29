import { LucideIcon, Inbox, AlertTriangle, WifiOff, Loader2 } from "lucide-react";
import Button from "./Button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
      <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4 border border-sky-200/50 dark:border-sky-800/40">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">{title}</h3>
      {message && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm leading-relaxed">{message}</p>}
      {action && (
        <Button variant="primary" size="sm" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't complete this request. Please try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200/60 dark:border-rose-900/30">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-200/50 dark:border-rose-800/40">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function OfflineState({
  lastSynced = "10 minutes ago",
  pending = 2,
  onSync,
}: {
  lastSynced?: string;
  pending?: number;
  onSync?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/60 dark:border-amber-900/30">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 border border-amber-200/50 dark:border-amber-800/40">
        <WifiOff className="w-7 h-7" />
      </div>
      <h3 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">You're currently offline</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm leading-relaxed">
        Your emergency information is stored securely on this device and will sync automatically when connectivity returns.
      </p>
      <div className="flex gap-4 mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>Last synced: {lastSynced}</span>
        <span>Pending items: {pending}</span>
      </div>
      {onSync && (
        <Button variant="primary" size="sm" className="mt-5" onClick={onSync}>
          Sync now
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
      <Loader2 className="w-7 h-7 text-sky-500 animate-spin" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`} />;
}
