import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, HeartPulse } from "lucide-react";
import Button from "../common/Button";
import LanguageSelector from "../common/LanguageSelector";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n/I18nContext";

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, startGuestSession } = useAuth();
  const { t } = useTranslation();
  const [loadingEmergency, setLoadingEmergency] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/how-it-works", label: t("nav.howItWorks") },
    { to: "/features", label: t("nav.features") },
    { to: "/about", label: t("nav.about") },
    { to: "/contact", label: t("nav.contact") },
  ];

  const activeIndex = navLinks.findIndex((l) =>
    l.to === "/" ? location.pathname === "/" : location.pathname.startsWith(l.to)
  );

  const updateIndicator = useCallback(() => {
    const targetIndex = hoveredIndex !== null ? hoveredIndex : activeIndex !== -1 ? activeIndex : null;
    if (targetIndex === null || targetIndex === -1 || !navRef.current || !itemRefs.current[targetIndex]) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const navRect = navRef.current.getBoundingClientRect();
    const itemRect = itemRefs.current[targetIndex]!.getBoundingClientRect();

    const left = itemRect.left - navRect.left + 14;
    const width = Math.max(0, itemRect.width - 28);

    setIndicatorStyle({
      left,
      width,
      opacity: 1,
    });
  }, [hoveredIndex, activeIndex]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, location.pathname, hoveredIndex]);

  useEffect(() => {
    window.addEventListener("resize", updateIndicator);
    document.fonts?.ready?.then(updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-2xs transition-[background-color,border-color,box-shadow] duration-200 animate-nav-entrance motion-reduce:animate-none">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="group flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg p-1 -m-1"
        >
          <div className="w-8 h-8 rounded-lg bg-sky flex items-center justify-center transition-colors duration-200 shadow-2xs">
            <HeartPulse className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-extrabold text-navy text-lg tracking-tight transition-colors duration-200 group-hover:text-sky-600">
            CareSetu
          </span>
        </Link>

        <nav
          ref={navRef}
          className="relative hidden md:flex items-center gap-1.5"
          aria-label="Main navigation"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {navLinks.map((l, index) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
              className={({ isActive }) =>
                `relative px-3.5 py-2 rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 border ${
                  isActive
                    ? "text-navy bg-sky-50/80 border-sky-200/80 font-semibold shadow-2xs"
                    : "text-slate-600 border-transparent hover:text-navy hover:bg-slate-50/80"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}

          {/* Single Shared Sliding Underline Indicator */}
          <span
            className="absolute bottom-1 h-[2.5px] bg-sky rounded-full pointer-events-none transition-[transform,width,opacity] duration-300 ease-out motion-reduce:transition-none"
            style={{
              transform: `translateX(${indicatorStyle.left}px)`,
              width: `${indicatorStyle.width}px`,
              opacity: indicatorStyle.opacity,
            }}
          />
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          <LanguageSelector variant="compact" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/login")}
            className="transition-colors duration-200 hover:text-navy focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {t("auth.login")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleEmergencyClick}
            disabled={loadingEmergency}
            className="transition-colors duration-200 active:scale-[0.98] shadow-sm hover:shadow-md hover:shadow-rose-600/25 focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            {loadingEmergency ? t("common.connecting") : t("emergency.reportEmergency")}
          </Button>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector variant="compact" />
          <button
            className="p-2 rounded-lg transition-colors duration-200 active:scale-95 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation menu"
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white/98 backdrop-blur-md px-5 py-4 flex flex-col gap-1 animate-slideUp">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 border ${
                  isActive
                    ? "bg-sky-50/80 text-navy border-sky-200/80 font-semibold"
                    : "text-slate-600 border-transparent hover:bg-slate-50 hover:text-navy"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => navigate("/login")}
              className="transition-colors duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {t("auth.login")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={handleEmergencyClick}
              disabled={loadingEmergency}
              className="transition-colors duration-200 active:scale-[0.98] shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              {loadingEmergency ? t("common.connecting") : t("emergency.reportEmergency")}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
