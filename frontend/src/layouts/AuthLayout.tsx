import { Link, Outlet } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import ThemeToggle from "../components/common/ThemeToggle";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-paleblue dark:bg-slate-950 flex flex-col justify-between px-4 py-6 sm:py-10 transition-colors duration-200">
      {/* Top Header Bar for utility controls like theme toggle */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 px-2">
        <Link to="/" className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky rounded-lg">
          <div className="w-8 h-8 rounded-xl bg-sky flex items-center justify-center">
            <HeartPulse className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-extrabold text-navy dark:text-white text-lg tracking-tight transition-colors">CareSetu</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle size="sm" />
        </div>
      </header>

      {/* Main Auth Form Container */}
      <main className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card border border-slate-100 dark:border-slate-800 p-7 sm:p-8 transition-colors">
          <Outlet />
        </div>
        <p className="text-center text-xs text-text-secondary dark:text-slate-400 mt-6">Right Care. Right Time. Right Place.</p>
      </main>

      {/* Subtle Footer Placeholder / Spacer */}
      <footer className="w-full text-center py-2 text-[11px] text-slate-400 dark:text-slate-500">
        CareSetu Emergency Network &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
