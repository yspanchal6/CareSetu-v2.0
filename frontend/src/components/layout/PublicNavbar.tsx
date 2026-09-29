import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, HeartPulse } from "lucide-react";
import Button from "../common/Button";
import LanguageSelector from "../common/LanguageSelector";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n/I18nContext";

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, startGuestSession } = useAuth();
  const { t } = useTranslation();
  const [loadingEmergency, setLoadingEmergency] = useState(false);

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/how-it-works", label: t("nav.howItWorks") },
    { to: "/features", label: t("nav.features") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];

  const handleEmergencyClick = async () => {
    if (loadingEmergency) return;
    try {
      setLoadingEmergency(true);
      if (!isAuthenticated) {
        await startGuestSession();
      }
      navigate("/patient/emergency");
    } catch (err) {
      console.error("[Navbar] Guest emergency error:", err);
      navigate("/patient/emergency");
    } finally {
      setLoadingEmergency(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sky flex items-center justify-center">
            <HeartPulse className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-extrabold text-navy text-lg tracking-tight">CareSetu</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "text-navy bg-lightblue" : "text-text-secondary hover:text-navy hover:bg-slate-50"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <LanguageSelector variant="compact" />
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            {t("auth.login")}
          </Button>
          <Button variant="danger" size="sm" onClick={handleEmergencyClick} disabled={loadingEmergency}>
            {loadingEmergency ? t("common.connecting") : t("emergency.reportEmergency")}
          </Button>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector variant="compact" />
          <button className="p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-5 py-4 flex flex-col gap-1">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-lightblue text-navy" : "text-text-secondary"}`}
            >
              {l.label}
            </NavLink>
          ))}
          <div className="flex flex-col gap-2 mt-3">
            <Button variant="outline" size="sm" fullWidth onClick={() => navigate("/login")}>
              {t("auth.login")}
            </Button>
            <Button variant="danger" size="sm" fullWidth onClick={handleEmergencyClick} disabled={loadingEmergency}>
              {loadingEmergency ? t("common.connecting") : t("emergency.reportEmergency")}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
