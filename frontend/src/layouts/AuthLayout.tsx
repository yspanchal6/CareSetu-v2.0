import { Link, Outlet } from "react-router-dom";
import { HeartPulse } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-paleblue dark:bg-slate-950 flex items-center justify-center px-4 py-10 transition-colors duration-200">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-9 h-9 rounded-xl bg-sky flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-navy dark:text-white text-xl tracking-tight transition-colors">CareSetu</span>
        </Link>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 p-7 sm:p-8 transition-colors">
          <Outlet />
        </div>
        <p className="text-center text-xs text-text-secondary dark:text-slate-400 mt-6">Right Care. Right Time. Right Place.</p>
      </div>
    </div>
  );
}
