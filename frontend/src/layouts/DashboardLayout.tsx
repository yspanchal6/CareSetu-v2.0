import { Outlet, useLocation, Link } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { NavItem } from "../components/layout/Sidebar";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

function titleFromPath(pathname: string, items: NavItem[]) {
  const sorted = [...items].sort((a, b) => b.to.length - a.to.length);
  const match = sorted.find((i) => pathname === i.to || pathname.startsWith(i.to + "/"));
  return match?.label ?? "Dashboard";
}

export default function DashboardLayout({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  const location = useLocation();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen flex bg-bg">
      <Sidebar items={items} roleLabel={roleLabel} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={titleFromPath(location.pathname, items)} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {!isOnline && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-800 shadow-sm animate-pulse">
              <WifiOff className="w-4 h-4 text-red-500 shrink-0" />
              <div>
                <p className="font-bold">You're currently offline</p>
                <p className="text-red-600">Some features may be unavailable. Emergency SOS will be queued and sent automatically when you reconnect.</p>
              </div>
            </div>
          )}
          {!user?.isVerified && (
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}

