import { useState, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LucideIcon, HeartPulse, ShieldAlert, Lock, X, Sun } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useHospitalSecurity } from "../../context/HospitalSecurityContext";
import { useTranslation } from "../../i18n";
import { accountDeletionApi } from "../../services/api";
import Button from "../common/Button";

export interface NavItem {
  to: string;
  label: string;
  key?: string;
  icon: LucideIcon;
}

function getDashboardRoute(user?: { role?: string; portalRoute?: string } | null): string {
  if (user?.portalRoute) return user.portalRoute;
  const r = String(user?.role || "").toLowerCase();
  if (r === "hospital") return "/hospital/dashboard";
  if (r === "doctor") return "/doctor/hospital/dashboard";
  if (r === "patient") return "/patient/dashboard";
  if (r === "admin") return "/admin/dashboard";
  return "/";
}

function isItemActive(pathname: string, itemTo: string, allItems: NavItem[]): boolean {
  if (pathname === itemTo) return true;
  const hasExactOtherMatch = allItems.some((i) => i.to !== itemTo && pathname === i.to);
  if (hasExactOtherMatch) return false;
  if (pathname.startsWith(itemTo + "/")) {
    const moreSpecificMatch = allItems.some(
      (i) => i.to !== itemTo && i.to.length > itemTo.length && (pathname === i.to || pathname.startsWith(i.to + "/"))
    );
    return !moreSpecificMatch;
  }
  return false;
}

export default function Sidebar({
  items,
  roleLabel,
  mobileOpen = false,
  onMobileClose,
}: {
  items: NavItem[];
  roleLabel: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: securityStatus } = useHospitalSecurity();
  const { t } = useTranslation();
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictedFeatureName, setRestrictedFeatureName] = useState("");
  const [pendingDeletionsCount, setPendingDeletionsCount] = useState<number>(0);

  const isHospital = user?.role === 'hospital' || (user?.role as string)?.toUpperCase() === 'HOSPITAL';
  const isBlocked = isHospital && (securityStatus === 'TEMPORARILY_BLOCKED' || securityStatus === 'UNDER_REVIEW');
  const isAdmin = Boolean(user && user.role && user.role.toLowerCase() === "admin");
  const dashboardRoute = getDashboardRoute(user);

  useEffect(() => {
    if (isAdmin) {
      let isMounted = true;
      const fetchPendingCount = async () => {
        try {
          const res = await accountDeletionApi.getAdminDeletionRequests();
          if (res.success && isMounted) {
            const count = (res.requests || []).filter(
              (r: any) => r.status === "PENDING" && (r.role === "HOSPITAL" || r.role === "DOCTOR")
            ).length;
            setPendingDeletionsCount(count);
          }
        } catch {
          // Ignore polling errors silently
        }
      };

      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 15000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [isAdmin, location.pathname]);

  const isGuest = user?.isGuest || user?.role === "guest";
  const isAllowedGuestPath = (to: string) => {
    return to.startsWith("/patient/emergency") || to.startsWith("/patient/doctor-ai");
  };

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    if (isBlocked) {
      e.preventDefault();
      return;
    }
    if (isGuest && !isAllowedGuestPath(item.to)) {
      e.preventDefault();
      setRestrictedFeatureName(item.key ? t(item.key) : item.label);
      setShowRestrictionModal(true);
    } else if (onMobileClose) {
      onMobileClose();
    }
  };

  const renderNavItems = () => (
    <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 flex flex-col gap-1">
      {items.map((item) => {
        const active = isItemActive(location.pathname, item.to, items);
        const restricted = isGuest && !isAllowedGuestPath(item.to);
        const isDeletionsNav = item.to === "/admin/deletions";
        const displayLabel = item.key ? t(item.key) : item.label;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(e) => handleNavClick(e, item)}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out ${
              active
                ? "bg-sky text-navy font-bold shadow-xs"
                : restricted
                ? "text-white/40 hover:bg-white/5"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4.5 h-4.5 shrink-0" />
              {displayLabel}
            </div>
            {isDeletionsNav && pendingDeletionsCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold transition-colors duration-200 ${
                  active ? "bg-navy text-sky" : "bg-amber-400 text-navy shadow-xs animate-pulse"
                }`}
              >
                {pendingDeletionsCount}
              </span>
            )}
            {restricted && <Lock className="w-3.5 h-3.5 opacity-50" />}
          </NavLink>
        );
      })}
    </nav>
  );

  const renderWeatherFooter = () => (
    <div className="shrink-0 border-t border-white/10 p-3.5 bg-white/5 backdrop-blur-xs mt-auto">
      <div className="flex items-center justify-between text-xs font-semibold text-white/90 mb-1">
        <div className="flex items-center gap-1.5 text-amber-300">
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
          <span>28°C · Clear</span>
        </div>
        <span className="text-[10px] text-white/50 bg-white/10 px-2 py-0.5 rounded-full font-mono font-medium">
          Live Station
        </span>
      </div>
      <p className="text-[11px] text-white/60 truncate">Hospital Station · AQI 42 (Good)</p>
    </div>
  );

  return (
    <>
      {/* Permanent Desktop Sidebar (Screen >= 1024px) */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-navy text-white h-full border-r border-white/10">
        <div className="flex items-center justify-between px-6 h-16 border-b border-white/10 shrink-0">
          <Link
            to={dashboardRoute}
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg p-1 -m-1"
            aria-label="Navigate to CareSetu Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-sky flex items-center justify-center group-hover:scale-105 transition-transform">
              <HeartPulse className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="font-extrabold leading-none text-white group-hover:text-sky-300 transition-colors">CareSetu</p>
              <p className="text-[10px] text-white/50 mt-0.5">{roleLabel}</p>
            </div>
          </Link>
          {isGuest && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <ShieldAlert className="w-3 h-3" /> {t("common.guestMode")}
            </span>
          )}
        </div>
        {renderNavItems()}
        {renderWeatherFooter()}
      </aside>

      {/* Mobile & Tablet Slide-Over Drawer Navigation (Screen < 1024px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-navy/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-navy text-white h-full h-[100dvh] flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 shrink-0">
              <Link
                to={dashboardRoute}
                onClick={onMobileClose}
                className="flex items-center gap-2 group hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg p-1 -m-1"
                aria-label="Navigate to CareSetu Dashboard"
              >
                <div className="w-8 h-8 rounded-lg bg-sky flex items-center justify-center group-hover:scale-105 transition-transform">
                  <HeartPulse className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <p className="font-extrabold leading-none text-white group-hover:text-sky-300 transition-colors">CareSetu</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{roleLabel}</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={onMobileClose}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavItems()}
            {renderWeatherFooter()}
          </aside>
        </div>
      )}

      {showRestrictionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-navy">This feature requires a registered account.</h3>
            <p className="text-sm text-text-secondary mt-2">
              Access to {restrictedFeatureName || "this feature"} is restricted in Guest Mode. Sign in or create an account to unlock full medical history, HealthPack, and saved preferences.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button variant="primary" size="md" fullWidth onClick={() => navigate("/register")}>
                Create Account
              </Button>
              <Button variant="outline" size="md" fullWidth onClick={() => navigate("/login")}>
                Log In
              </Button>
              <button
                onClick={() => setShowRestrictionModal(false)}
                className="mt-2 text-xs font-semibold text-text-secondary hover:text-navy"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
