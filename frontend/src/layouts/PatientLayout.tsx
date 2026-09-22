import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import MobileBottomNav from "../components/layout/MobileBottomNav";
import { patientNav } from "../routes/navConfig";

function titleFromPath(pathname: string) {
  const match = patientNav.find((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
  return match?.label ?? "CareSetu";
}

export default function PatientLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar items={patientNav} roleLabel="Patient Portal" />
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <Topbar title={titleFromPath(location.pathname)} />
        <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto md:max-w-none">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
