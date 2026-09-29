import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, Siren, Building2, ShieldCheck, User, Lock } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n";
import Button from "../common/Button";

export default function MobileBottomNav() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictedLabel, setRestrictedLabel] = useState("");

  const items = [
    { to: "/patient/dashboard", label: t("nav.home"), key: "nav.home", icon: Home },
    { to: "/patient/emergency", label: t("nav.reportEmergency"), key: "nav.reportEmergency", icon: Siren },
    { to: "/patient/hospitals", label: t("nav.hospitals"), key: "nav.hospitals", icon: Building2 },
    { to: "/patient/health-pack", label: t("nav.healthPack"), key: "nav.healthPack", icon: ShieldCheck },
    { to: "/patient/profile", label: t("nav.profile"), key: "nav.profile", icon: User },
  ];

  const isGuest = user?.isGuest || user?.role === "guest";
  const isAllowedGuestPath = (to: string) => {
    return to.startsWith("/patient/emergency") || to.startsWith("/patient/doctor-ai");
  };

  const handleNavClick = (e: React.MouseEvent, item: typeof items[0]) => {
    if (isGuest && !isAllowedGuestPath(item.to)) {
      e.preventDefault();
      setRestrictedLabel(item.label);
      setShowRestrictionModal(true);
    }
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(e) => handleNavClick(e, item)}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-sky" : "text-text-secondary"
              } ${item.to === "/patient/emergency" ? "relative" : ""}`
            }
          >
            {({ isActive }) =>
              item.to === "/patient/emergency" ? (
                <>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center -mt-5 shadow-lg ${isActive ? "bg-emergency" : "bg-emergency"}`}>
                    <item.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <span className={isActive ? "text-emergency" : "text-emergency"}>{item.label}</span>
                </>
              ) : (
                <>
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </>
              )
            }
          </NavLink>
        ))}
      </nav>

      {showRestrictionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-navy">This feature requires a registered account.</h3>
            <p className="text-sm text-text-secondary mt-2">
              Access to {restrictedLabel || "this feature"} is restricted in Guest Mode. Sign in or create an account to unlock HealthPack and personal records.
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
