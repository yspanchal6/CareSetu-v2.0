import React from "react";
import { ShieldAlert, Activity, Key, Lock } from "lucide-react";

interface SecurityEpochHeaderWidgetProps {
  securityEpoch?: number;
  blockedHospitalsCount?: number;
  activeSessionsCount?: number;
  totalViolationsCount?: number;
  onRefresh?: () => void;
}

export const SecurityEpochHeaderWidget: React.FC<SecurityEpochHeaderWidgetProps> = ({
  securityEpoch = 1,
  blockedHospitalsCount = 0,
  activeSessionsCount = 0,
  totalViolationsCount = 0,
}) => {
  return (
    <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left Title & Security Epoch Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Security Infrastructure & Epoch Control
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold border border-indigo-400/40">
                Epoch v{securityEpoch}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time multi-tenant hospital protection & capture violation monitoring
            </p>
          </div>
        </div>

        {/* Right Stats Grid */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-red-400" />
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Blocked Portals</p>
              <p className="text-base font-bold text-red-400">{blockedHospitalsCount}</p>
            </div>
          </div>

          <div className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Total Violations</p>
              <p className="text-base font-bold text-amber-300">{totalViolationsCount}</p>
            </div>
          </div>

          <div className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
            <Key className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Active Sessions</p>
              <p className="text-base font-bold text-emerald-400">{activeSessionsCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityEpochHeaderWidget;
