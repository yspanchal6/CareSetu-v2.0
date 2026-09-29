import {
  LayoutDashboard, User, HeartPulse, FileText, ShieldCheck, Siren, Building2, Bell, Settings,
  ClipboardList, Bed, Users, Stethoscope, BarChart3, Hospital, ScrollText, KeyRound, UserCog,
  Activity, WifiOff, BrainCircuit, UploadCloud, CalendarDays, UserX, Database, GitCompare, ShieldAlert
} from "lucide-react";
import { NavItem } from "../components/layout/Sidebar";

export const patientNav: NavItem[] = [
  { to: "/patient/dashboard", label: "Dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/patient/profile", label: "Profile", key: "nav.profile", icon: User },
  { to: "/patient/medical-information", label: "Medical Information", key: "nav.medicalInformation", icon: FileText },
  { to: "/patient/health-pack", label: "Health Pack", key: "nav.healthPack", icon: ShieldCheck },
  { to: "/patient/upload-documents", label: "Upload Documents", key: "nav.uploadDocuments", icon: UploadCloud },
  { to: "/patient/doctor-ai", label: "Doctor AI", key: "nav.doctorAi", icon: BrainCircuit },
  { to: "/patient/book-sessions", label: "Book Sessions", key: "nav.bookSessions", icon: CalendarDays },
  { to: "/patient/emergency", label: "Report Emergency", key: "nav.reportEmergency", icon: Siren },
  { to: "/patient/hospitals", label: "Hospitals", key: "nav.hospitals", icon: Building2 },
  { to: "/patient/cases", label: "My Cases", key: "nav.myCases", icon: ClipboardList },
  { to: "/patient/notifications", label: "Notifications", key: "nav.notifications", icon: Bell },
  { to: "/patient/offline", label: "Offline Mode", key: "nav.offlineMode", icon: WifiOff },
  { to: "/patient/settings", label: "Settings", key: "nav.settings", icon: Settings },
];

export const hospitalNav: NavItem[] = [
  { to: "/hospital/dashboard", label: "Dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/hospital/emergencies", label: "Emergency Cases", key: "nav.emergencyCases", icon: Siren },
  { to: "/hospital/emergencies/active", label: "Active Cases", key: "nav.activeCases", icon: Activity },
  { to: "/hospital/matching-requests", label: "Matching Requests", key: "nav.matchingRequests", icon: ClipboardList },
  { to: "/hospital/patients", label: "Patients", key: "nav.patients", icon: Users },
  { to: "/hospital/capacity", label: "Capacity", key: "nav.capacity", icon: Bed },
  { to: "/hospital/reports", label: "Reports", key: "nav.reports", icon: BarChart3 },
  { to: "/hospital/staff", label: "Staff", key: "nav.staff", icon: UserCog },
  { to: "/hospital/notifications", label: "Notifications", key: "nav.notifications", icon: Bell },
  { to: "/hospital/profile", label: "Hospital Profile", key: "nav.profile", icon: Hospital },
  { to: "/hospital/settings", label: "Settings", key: "nav.settings", icon: Settings },
];

export const doctorNav: NavItem[] = [
  { to: "/doctor/dashboard", label: "Dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/doctor/cases", label: "Assigned Cases", key: "nav.assignedCases", icon: ClipboardList },
  { to: "/doctor/patients", label: "Patients", key: "nav.patients", icon: Users },
  { to: "/doctor/health-pack", label: "Health Pack", key: "nav.healthPack", icon: ShieldCheck },
  { to: "/doctor/clinical-notes", label: "Clinical Notes", key: "nav.clinicalNotes", icon: Stethoscope },
  { to: "/doctor/reports", label: "Reports", key: "nav.reports", icon: BarChart3 },
  { to: "/doctor/settings", label: "Settings", key: "nav.settings", icon: Settings },
];

export const adminNav: NavItem[] = [
  { to: "/admin/dashboard", label: "Dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", key: "nav.users", icon: Users },
  { to: "/admin/hospitals", label: "Hospitals", key: "nav.hospitals", icon: Building2 },
  { to: "/admin/security-reviews", label: "Security Reviews", key: "nav.securityReviews", icon: ShieldAlert },
  { to: "/admin/emergencies", label: "Emergencies", key: "nav.emergencyCases", icon: Siren },
  { to: "/admin/hospital-registry", label: "Hospital Registry", key: "nav.hospitalRegistry", icon: Hospital },
  { to: "/admin/government-data", label: "Government Health Data", key: "nav.governmentData", icon: Database },
  { to: "/admin/hospital-matching", label: "Hospital Matching", key: "nav.hospitalMatching", icon: GitCompare },
  { to: "/admin/deletions", label: "Deletions", key: "nav.deletions", icon: UserX },
  { to: "/admin/analytics", label: "Analytics", key: "nav.analytics", icon: Activity },
  { to: "/admin/audit-logs", label: "Audit Logs", key: "nav.auditLogs", icon: ScrollText },
  { to: "/admin/roles", label: "Roles & Permissions", key: "nav.roles", icon: KeyRound },
  { to: "/admin/settings", label: "Settings", key: "nav.settings", icon: Settings },
];

export const roleLabels: Record<string, string> = {
  patient: "Patient Portal",
  hospital: "Hospital Portal",
  doctor: "Doctor Portal",
  admin: "Admin Console",
};
