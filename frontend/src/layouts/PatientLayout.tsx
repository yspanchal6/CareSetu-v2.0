import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import MobileBottomNav from "../components/layout/MobileBottomNav";
import { patientNav } from "../routes/navConfig";
import { useTranslation } from "../i18n";

export default function PatientLayout() {
  const location = useLocation();
  const { t } = useTranslation();

  const match = patientNav.find((i) => location.pathname === i.to || location.pathname.startsWith(i.to + "/"));
  const pageTitle = match ? (match.key ? t(match.key) : match.label) : t("common.appName");

  return (
    <div className="h-screen h-[100dvh] flex bg-bg dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      <Sidebar items={patientNav} roleLabel="Patient Portal" />
      <div className="flex-1 min-h-0 min-w-0 flex flex-col h-full overflow-hidden pb-16 md:pb-0">
        <Topbar title={pageTitle} />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 max-w-3xl w-full mx-auto md:max-w-none">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
