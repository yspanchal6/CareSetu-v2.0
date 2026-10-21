import { useState } from "react";
import { Bell, ChevronDown, LogOut, Wifi, WifiOff, ShieldAlert, UserPlus, LogIn, Menu, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "../../i18n/I18nContext";
import { notifications as mockNotifications } from "../../data/notifications";
import { useNavigate } from "react-router-dom";
import Badge from "../common/Badge";
import LanguageSelector from "../common/LanguageSelector";
import ThemeToggle from "../common/ThemeToggle";
import { useConnectivity } from "../../hooks/useConnectivity";

export default function Topbar({
  title,
  online,
  onMenuToggle,
}: {
  title?: string;
  online?: boolean;
  onMenuToggle?: () => void;
}) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const connectivity = useConnectivity();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const unread = mockNotifications.filter((n) => !n.read).length;
  const isGuest = user?.isGuest || user?.role === "guest";
  const isAdmin = user?.role?.toLowerCase() === "admin";

  const displayStatus = online !== undefined ? (online ? "ONLINE" : "OFFLINE") : connectivity.uiStatus;

  return (
    <header className="shrink-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-100 dark:border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 transition-colors duration-200">
      <div className="flex items-center gap-2.5 sm:gap-3 truncate">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl text-navy dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5 text-navy dark:text-white" />
          </button>
        )}
        <h1 className="font-bold text-navy dark:text-white text-lg truncate">{title}</h1>
        {isGuest && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm shrink-0">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> {t("common.guestMode")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle size="sm" />
        {!isAdmin && <LanguageSelector variant="compact" />}

        <span
          className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
            displayStatus === "ONLINE" || displayStatus === "SYNC_COMPLETE"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : displayStatus === "OFFLINE"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : displayStatus === "RECONNECTING" || displayStatus === "SYNCING"
              ? "bg-sky-50 text-sky-700 border border-sky-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {displayStatus === "OFFLINE" ? (
            <WifiOff className="w-3.5 h-3.5" />
          ) : displayStatus === "RECONNECTING" || displayStatus === "SYNCING" ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
          ) : (
            <Wifi className="w-3.5 h-3.5" />
          )}
          {displayStatus === "ONLINE" || displayStatus === "SYNC_COMPLETE"
            ? t("common.online")
            : displayStatus === "OFFLINE"
            ? t("common.offline")
            : displayStatus === "RECONNECTING"
            ? "Reconnecting"
            : displayStatus === "SYNCING"
            ? "Syncing"
            : "Sync Failed"}
        </span>

        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-text-secondary dark:text-slate-300 transition-colors"
            aria-label={t("common.notifications")}
          >
            <Bell className="w-5 h-5" />
            {!isGuest && unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emergency" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 max-h-96 overflow-y-auto scrollbar-thin z-50">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <p className="font-bold text-navy dark:text-white text-sm">{t("common.notifications")}</p>
                <Badge tone="accent">{isGuest ? 0 : unread} {t("common.new")}</Badge>
              </div>
              {isGuest ? (
                <div className="px-4 py-6 text-center text-xs text-text-secondary dark:text-slate-400">
                  Notifications are disabled in Guest Mode.
                </div>
              ) : (
                mockNotifications.slice(0, 6).map((n) => (
                  <div key={n.id} className={`px-4 py-3 border-b border-slate-50 dark:border-slate-800/80 last:border-0 ${!n.read ? "bg-paleblue/50 dark:bg-sky-950/30" : ""}`}>
                    <p className="text-sm font-semibold text-navy dark:text-white">{n.title}</p>
                    <p className="text-xs text-text-secondary dark:text-slate-300 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{n.time}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isGuest ? "bg-amber-500 text-white" : "bg-sky text-white"}`}>
              {isGuest ? "G" : (user?.avatarInitials ?? "U")}
            </div>
            <ChevronDown className="w-4 h-4 text-text-secondary dark:text-slate-400 hidden sm:block" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800">
                <p className="text-sm font-semibold text-navy dark:text-white truncate">{isGuest ? "Guest User" : user?.name}</p>
                <p className="text-xs text-text-secondary dark:text-slate-400 truncate">{isGuest ? "Temporary Session" : user?.email}</p>
              </div>
              {isGuest ? (
                <>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/register");
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy font-medium hover:bg-slate-50"
                  >
                    <UserPlus className="w-4 h-4 text-sky" /> {t("auth.register")}
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/login");
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-navy font-medium hover:bg-slate-50"
                  >
                    <LogIn className="w-4 h-4 text-sky" /> {t("auth.login")}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emergency hover:bg-red-50 font-medium"
                  >
                    <LogOut className="w-4 h-4" /> Exit Guest Mode
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emergency hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" /> {t("auth.logout")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
