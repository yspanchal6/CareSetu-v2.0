import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { SecureContentService, HospitalSecurityStatusResponse } from "../services/secure-content.service";
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { useAuth } from "./AuthContext";

export interface HospitalSecurityContextValue {
  status: 'ACTIVE' | 'WARNING' | 'TEMPORARILY_BLOCKED' | 'UNDER_REVIEW';
  currentViolationCount: number;
  historicalViolationCount: number;
  remainingAttempts: number;
  blockReason: string | null;
  blockedAt: string | null;
  appeals: any[];
  securityEpoch: number;
  resolved: boolean;
  securityLoading: boolean;
  refreshSecurityStatus: () => Promise<HospitalSecurityStatusResponse>;
  dismissBanner: () => void;
  bannerDismissed: boolean;
}

const HospitalSecurityContext = createContext<HospitalSecurityContextValue | undefined>(undefined);

export function HospitalSecurityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [securityData, setSecurityData] = useState<HospitalSecurityStatusResponse>({
    status: 'ACTIVE',
    violationCount: 0,
    appeals: []
  });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(true);

  const isHospital = user?.role === 'hospital' || (user?.role as string)?.toUpperCase() === 'HOSPITAL';

  const fetchSecurityStatus = async (): Promise<HospitalSecurityStatusResponse> => {
    if (!isHospital) {
      setResolved(true);
      setSecurityLoading(false);
      return { status: 'ACTIVE', violationCount: 0 };
    }
    setSecurityLoading(true);
    try {
      const data = await SecureContentService.getHospitalSecurityStatus();
      setSecurityData(data);
      setResolved(true);
      setSecurityLoading(false);
      return data;
    } catch (err) {
      console.warn("[HospitalSecurityContext] Failed to fetch hospital security status:", err);
      setResolved(true);
      setSecurityLoading(false);
      return securityData;
    }
  };

  useEffect(() => {
    if (isHospital) {
      fetchSecurityStatus();
    } else {
      setResolved(true);
      setSecurityLoading(false);
    }
  }, [user?.id, isHospital]);

  const currentCount = securityData.currentViolationCount ?? securityData.violationCount ?? 0;
  const status = securityData.status || (currentCount >= 3 ? 'TEMPORARILY_BLOCKED' : currentCount > 0 ? 'WARNING' : 'ACTIVE');
  const remaining = Math.max(3 - currentCount, 0);

  const contextValue: HospitalSecurityContextValue = {
    status,
    currentViolationCount: Math.min(currentCount, 3),
    historicalViolationCount: securityData.historicalViolationCount || 0,
    remainingAttempts: remaining,
    blockReason: securityData.blockReason || null,
    blockedAt: securityData.blockedAt || null,
    appeals: securityData.appeals || [],
    securityEpoch: securityData.securityEpoch || 1,
    resolved,
    securityLoading,
    refreshSecurityStatus: fetchSecurityStatus,
    dismissBanner: () => setBannerDismissed(true),
    bannerDismissed
  };

  return (
    <HospitalSecurityContext.Provider value={contextValue}>
      {/* PERSISTENT SECURITY WARNING BANNER (For 1/3 and 2/3 warnings across all hospital routes) */}
      {isHospital && currentCount > 0 && currentCount < 3 && !bannerDismissed && (
        <div className={`w-full py-2.5 px-4 text-xs font-semibold flex items-center justify-between border-b shadow-sm z-50 transition-all ${
          currentCount === 2
            ? "bg-red-50 text-red-900 border-red-300 animate-pulse"
            : "bg-amber-50 text-amber-900 border-amber-300"
        }`}>
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            {currentCount === 2 ? (
              <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            )}
            <div>
              <span className="font-bold uppercase tracking-wider mr-1.5">
                {currentCount === 2 ? "⚠️ FINAL SECURITY WARNING:" : "⚠️ SECURITY WARNING:"}
              </span>
              <span>
                Protected HealthPack content capture detected ({currentCount} of 3 violations).{" "}
                {currentCount === 2
                  ? "One more violation will temporarily restrict your hospital portal."
                  : `${remaining} attempt(s) remaining under CareSetu security policy.`}
              </span>
            </div>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {children}
    </HospitalSecurityContext.Provider>
  );
}

export function useHospitalSecurity() {
  const context = useContext(HospitalSecurityContext);
  if (!context) {
    return {
      status: 'ACTIVE' as const,
      currentViolationCount: 0,
      historicalViolationCount: 0,
      remainingAttempts: 3,
      blockReason: null,
      blockedAt: null,
      appeals: [],
      securityEpoch: 1,
      resolved: true,
      securityLoading: false,
      refreshSecurityStatus: async () => ({ status: 'ACTIVE' as const, violationCount: 0 }),
      dismissBanner: () => {},
      bannerDismissed: false
    };
  }
  return context;
}
