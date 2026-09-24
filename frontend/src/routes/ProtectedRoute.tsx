import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { getAuthToken } from "../services/api";
import { UserRole } from "../types";

const GUEST_ALLOWED_SUBPATHS = [
  "/patient/emergency",
  "/patient/doctor-ai",
];

export default function ProtectedRoute({
  role,
  allowedRoles,
  children,
}: {
  role?: UserRole | string;
  allowedRoles?: string[];
  children: ReactNode;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const token = getAuthToken();

  if (!token || !user) return <Navigate to="/login" replace />;

  const userRoleNorm = user.role ? user.role.toLowerCase() : "patient";
  const isGuest = Boolean(user.isGuest || userRoleNorm === "guest");

  if (isGuest) {
    const isAllowed = GUEST_ALLOWED_SUBPATHS.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + "/")
    );

    if (role?.toLowerCase() === "patient" && isAllowed) {
      return <>{children}</>;
    }

    return <Navigate to="/patient/emergency" replace />;
  }

  // Check required single role
  if (role) {
    const targetRoleNorm = role.toLowerCase();
    if (userRoleNorm !== targetRoleNorm) {
      console.warn(`[ProtectedRoute] Access denied to ${location.pathname}. User role '${user.role}' does not match required role '${role}'.`);
      const targetDashboard = `/${userRoleNorm}/dashboard`;
      return <Navigate to={targetDashboard} replace />;
    }
  }

  // Check required allowedRoles array
  if (allowedRoles && allowedRoles.length > 0) {
    const allowedNorm = allowedRoles.map((r) => r.toLowerCase());
    if (!allowedNorm.includes(userRoleNorm)) {
      console.warn(`[ProtectedRoute] Access denied to ${location.pathname}. User role '${user.role}' not in allowed roles [${allowedRoles.join(", ")}].`);
      const targetDashboard = `/${userRoleNorm}/dashboard`;
      return <Navigate to={targetDashboard} replace />;
    }
  }

  return <>{children}</>;
}
