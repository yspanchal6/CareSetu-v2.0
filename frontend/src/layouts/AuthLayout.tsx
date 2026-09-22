import { Link, Outlet } from "react-router-dom";
import { HeartPulse } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-paleblue flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-sky flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-navy text-xl tracking-tight">CareSetu</span>
        </Link>
        <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-7 sm:p-8">
          <Outlet />
        </div>
        <p className="text-center text-xs text-text-secondary mt-6">Right Care. Right Time. Right Place.</p>
      </div>
    </div>
  );
}
