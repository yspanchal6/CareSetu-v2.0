import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";

const GUEST_ALLOWED_SUBPATHS = [
  "/patient/emergency",
  "/patient/doctor-ai",
];

export default function ProtectedRoute({ role, allowedRoles, children }: { role?: UserRole; allowedRoles?: string[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const token = localStorage.getItem("jwt");

  if (!token || !user) return <Navigate to="/login" replace />;

  const isGuest = Boolean(user.isGuest || user.role === "guest");

  if (isGuest) {
    const isAllowed = GUEST_ALLOWED_SUBPATHS.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + "/")
    );

    if (role === "patient" && isAllowed) {
      return <>{children}</>;
    }

    return <Navigate to="/patient/emergency" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role.toUpperCase())) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
