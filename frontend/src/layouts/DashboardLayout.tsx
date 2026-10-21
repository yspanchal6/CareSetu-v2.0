import { useState, useEffect } from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { NavItem } from "../components/layout/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useHospitalSecurity } from "../context/HospitalSecurityContext";
import HospitalRestrictedView from "../components/hospital/HospitalRestrictedView";
import { useTranslation } from "../i18n";
import { AlertTriangle, WifiOff, ShieldAlert } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export default function DashboardLayout({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const { status: securityStatus, resolved: securityResolved, securityLoading } = useHospitalSecurity();
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();

  // Close mobile drawer on desktop resize (>= 1024px) to prevent stale backdrop/sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isHospital = user?.role === 'hospital' || user?.role?.toUpperCase() === 'HOSPITAL';
  const isBlocked = isHospital && (securityStatus === 'TEMPORARILY_BLOCKED' || securityStatus === 'UNDER_REVIEW');

  const sorted = [...items].sort((a, b) => b.to.length - a.to.length);
  const match = sorted.find((i) => location.pathname === i.to || location.pathname.startsWith(i.to + "/"));
  const pageTitle = match ? (match.key ? t(match.key) : match.label) : t("nav.dashboard");

  return (
    <div className="h-screen h-[100dvh] flex bg-bg dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <Sidebar
        items={items}
        roleLabel={roleLabel}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full overflow-hidden">
        <Topbar title={pageTitle} onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
        <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          {!isOnline && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800 shadow-sm animate-pulse">
              <WifiOff className="w-4 h-4 text-red-500 shrink-0" />
              <div>
                <p className="font-bold">{t("common.offline")}</p>
                <p className="text-red-600">Some features may be unavailable. Emergency SOS will be queued and sent automatically when you reconnect.</p>
              </div>
            </div>
          )}
          {!user?.isVerified && !['admin', 'hospital'].includes(user?.role?.toLowerCase() || '') && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-sm">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold">Document verification is pending.</p>
                  <p className="text-amber-700">You can complete your document verification later from Settings.</p>
                </div>
              </div>
              <Link
                to="/verify-documents"
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs whitespace-nowrap"
              >
                Complete Document Verification →
              </Link>
            </div>
          )}
          {isHospital && (!securityResolved || securityLoading) ? (
            <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center bg-white rounded-2xl shadow-xs border border-slate-100 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3">
                <ShieldAlert className="w-6 h-6 animate-spin" />
              </div>
              <p className="text-sm font-bold text-slate-800">Verifying Security Policy...</p>
              <p className="text-xs text-slate-500 mt-1">Checking CareSetu Hospital Portal Security Authorization</p>
            </div>
          ) : isBlocked ? (
            <HospitalRestrictedView />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

