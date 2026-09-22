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
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-paleblue flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-sky" />
      </div>
      <h3 className="font-bold text-navy">{title}</h3>
      {message && <p className="text-sm text-text-secondary mt-1.5 max-w-xs">{message}</p>}
      {action && (
        <Button variant="primary" size="sm" className="mt-4" onClick={action.onClick}>
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
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-emergency" />
      </div>
      <h3 className="font-bold text-navy">{title}</h3>
      <p className="text-sm text-text-secondary mt-1.5 max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function OfflineState({ lastSynced = "10 minutes ago", pending = 2, onSync }: { lastSynced?: string; pending?: number; onSync?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <WifiOff className="w-6 h-6 text-text-secondary" />
      </div>
      <h3 className="font-bold text-navy">You're currently offline</h3>
      <p className="text-sm text-text-secondary mt-1.5 max-w-xs">
        Your emergency information is stored securely on this device and will sync automatically when connectivity returns.
      </p>
      <div className="flex gap-4 mt-4 text-xs text-text-secondary">
        <span>Last synced: {lastSynced}</span>
        <span>Pending items: {pending}</span>
      </div>
      {onSync && (
        <Button variant="primary" size="sm" className="mt-4" onClick={onSync}>
          Sync now
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <Loader2 className="w-6 h-6 text-sky animate-spin" />
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`} />;
}
