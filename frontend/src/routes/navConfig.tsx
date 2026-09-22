import {
  LayoutDashboard, User, HeartPulse, FileText, ShieldCheck, Siren, Building2, Bell, Settings,
  ClipboardList, Bed, Users, Stethoscope, BarChart3, Hospital, ScrollText, KeyRound, UserCog,
  Activity, WifiOff, BrainCircuit, UploadCloud, CalendarDays,
} from "lucide-react";
import { NavItem } from "../components/layout/Sidebar";

export const patientNav: NavItem[] = [
  { to: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/patient/profile", label: "Profile", icon: User },
  { to: "/patient/medical-information", label: "Medical Information", icon: FileText },
  { to: "/patient/health-pack", label: "Health Pack", icon: ShieldCheck },
  { to: "/patient/upload-documents", label: "Upload Documents", icon: UploadCloud },
  { to: "/patient/doctor-ai", label: "Doctor AI", icon: BrainCircuit },
  { to: "/patient/book-sessions", label: "Book Sessions", icon: CalendarDays },
  { to: "/patient/emergency", label: "Report Emergency", icon: Siren },
  { to: "/patient/hospitals", label: "Hospitals", icon: Building2 },
  { to: "/patient/cases", label: "My Cases", icon: ClipboardList },
  { to: "/patient/notifications", label: "Notifications", icon: Bell },
  { to: "/patient/offline", label: "Offline Mode", icon: WifiOff },
  { to: "/patient/settings", label: "Settings", icon: Settings },
];

export const hospitalNav: NavItem[] = [
  { to: "/hospital/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/hospital/emergencies", label: "Emergency Cases", icon: Siren },
  { to: "/hospital/emergencies/active", label: "Active Cases", icon: Activity },
  { to: "/hospital/matching-requests", label: "Matching Requests", icon: ClipboardList },
  { to: "/hospital/patients", label: "Patients", icon: Users },
  { to: "/hospital/capacity", label: "Capacity", icon: Bed },
  { to: "/hospital/reports", label: "Reports", icon: BarChart3 },
  { to: "/hospital/staff", label: "Staff", icon: UserCog },
  { to: "/hospital/notifications", label: "Notifications", icon: Bell },
  { to: "/hospital/profile", label: "Hospital Profile", icon: Hospital },
  { to: "/hospital/settings", label: "Settings", icon: Settings },
];

export const doctorNav: NavItem[] = [
  { to: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/doctor/cases", label: "Assigned Cases", icon: ClipboardList },
  { to: "/doctor/patients", label: "Patients", icon: Users },
  { to: "/doctor/health-pack", label: "Health Pack", icon: ShieldCheck },
  { to: "/doctor/clinical-notes", label: "Clinical Notes", icon: Stethoscope },
  { to: "/doctor/reports", label: "Reports", icon: BarChart3 },
  { to: "/doctor/settings", label: "Settings", icon: Settings },
];

export const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/hospitals", label: "Hospitals", icon: Building2 },
  { to: "/admin/emergencies", label: "Emergencies", icon: Siren },
  { to: "/admin/hospital-registry", label: "Hospital Registry", icon: Hospital },
  { to: "/admin/analytics", label: "Analytics", icon: Activity },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export const roleLabels: Record<string, string> = {
  patient: "Patient Portal",
  hospital: "Hospital Portal",
  doctor: "Doctor Portal",
  admin: "Admin Console",
};
