import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, FileText, ArrowRight, XCircle } from "lucide-react";
import { UserRole } from "../../types";

export type VerificationStatusState = "Incomplete" | "Submitted" | "Under Review" | "Approved" | "Rejected";

interface RoleStatusBannerProps {
  role: UserRole;
  status?: VerificationStatusState;
  onDismiss?: () => void;
  className?: string;
}

export function RoleStatusBanner({
  role,
  status = "Incomplete",
  onDismiss,
  className = "",
}: RoleStatusBannerProps) {
  const navigate = useNavigate();

  if (role === "admin" || (role as string) === "ADMIN") {
    return null;
  }

  // If approved, show success status banner or allow dismissal
  if (status === "Approved") {
    return (
      <div
        role="region"
        aria-label="Account Verification Success Banner"
        className={`w-full bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none ${className}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-base text-emerald-900 leading-tight">
              Account Verification Complete
            </h4>
            <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
              Your {role} profile and verification details are approved. You have full access to CareSetu features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Define role specific titles, messages, and action routes
  const getBannerContent = () => {
    switch (role) {
      case "patient":
        return {
          title: "Complete Your Patient Profile",
          message: "Your account is created successfully. Complete your profile to access all patient features.",
          buttonText: "Complete Profile →",
          route: "/patient/profile-completion",
        };
      case "doctor":
        return {
          title: "Doctor Verification Is Pending",
          message: "Your account is registered. Upload and submit the required professional documents for verification.",
          buttonText: "Complete Verification →",
          route: "/doctor/document-verification",
        };
      case "hospital":
        return {
          title: "Hospital Verification Is Pending",
          message: "Your hospital account is registered. Complete hospital details, location information, and required documents.",
          buttonText: "Complete Hospital Verification →",
          route: "/hospital/profile-verification",
        };
      default:
        return {
          title: "Account Setup Required",
          message: "Please complete your profile to unlock all platform capabilities.",
          buttonText: "Get Started →",
          route: "/",
        };
    }
  };

  const content = getBannerContent();

  const getStatusBadge = () => {
    switch (status) {
      case "Submitted":
        return {
          label: "Submitted",
          bg: "bg-blue-500/15 text-blue-700 border-blue-300",
          icon: FileText,
        };
      case "Under Review":
        return {
          label: "Under Review",
          bg: "bg-amber-500/15 text-amber-800 border-amber-300",
          icon: Clock,
        };
      case "Rejected":
        return {
          label: "Action Required",
          bg: "bg-rose-500/15 text-rose-700 border-rose-300",
          icon: XCircle,
        };
      case "Incomplete":
      default:
        return {
          label: "Incomplete",
          bg: "bg-amber-500/15 text-amber-800 border-amber-300",
          icon: AlertCircle,
        };
    }
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm transition-all duration-300 motion-reduce:transition-none ${className}`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
          <AlertCircle className="w-5 h-5" />
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-base text-navy leading-tight">
              {content.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg}`}
            >
              <BadgeIcon className="w-3.5 h-3.5" />
              <span>{badge.label}</span>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
            {content.message}
          </p>
        </div>
      </div>

      <div className="w-full md:w-auto flex items-center gap-3 shrink-0 pt-2 md:pt-0">
        <button
          type="button"
          onClick={() => navigate(content.route)}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky hover:bg-sky/90 active:scale-[0.98] text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-sky/40 motion-reduce:transition-none"
        >
          <span>{content.buttonText}</span>
        </button>
      </div>
    </div>
  );
}
