import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

export default function PublicFooter() {
  const navigate = useNavigate();
  const { isAuthenticated, startGuestSession } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleEmergencyClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      if (!isAuthenticated) {
        await startGuestSession();
      }
      navigate("/patient/emergency");
    } catch (err) {
      console.error("[Footer] Guest emergency error:", err);
      navigate("/patient/emergency");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-navy text-white mt-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky flex items-center justify-center">
              <HeartPulse className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="font-extrabold text-lg">CareSetu</span>
          </div>
          <p className="text-sm text-white/60 mt-3 max-w-xs">Right Care. Right Time. Right Place.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90 mb-3">Product</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link to="/how-it-works" className="hover:text-white">How it works</Link></li>
            <li><Link to="/features" className="hover:text-white">Features</Link></li>
            <li><Link to="/register" className="hover:text-white">For Hospitals</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90 mb-3">Company</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li><Link to="/about" className="hover:text-white">About</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90 mb-3">Emergency</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li>
              <a href="/patient/emergency" onClick={handleEmergencyClick} className="hover:text-white">
                {loading ? "Connecting..." : "Report Emergency"}
              </a>
            </li>
            <li><Link to="/login" className="hover:text-white">Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
        © 2026 CareSetu. All rights reserved.
      </div>
    </footer>
  );
}
