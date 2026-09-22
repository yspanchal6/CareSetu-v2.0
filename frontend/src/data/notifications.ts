import { AppNotification, AuditLogEntry } from "../types";

export const notifications: AppNotification[] = [
  { id: "N1", title: "Hospital Assigned", message: "Apollo Cardiac Institute accepted your emergency case CASE7821.", type: "success", time: "2 min ago", read: false },
  { id: "N2", title: "Emergency Created", message: "Your emergency report has been received and is being processed.", type: "emergency", time: "12 min ago", read: false },
  { id: "N3", title: "Hospital Search", message: "Expanding search radius to 16 km to find a suitable hospital.", type: "info", time: "18 min ago", read: true },
  { id: "N4", title: "Transfer Started", message: "Ambulance dispatched. ETA 9 minutes to Shree Krishna Neuro Center.", type: "info", time: "34 min ago", read: true },
  { id: "N5", title: "Capacity Warning", message: "ICU availability below 15% at SSG General Hospital.", type: "warning", time: "1 hr ago", read: true },
  { id: "N6", title: "Case Completed", message: "Case CASE7824 marked as completed. Patient discharged.", type: "success", time: "5 hr ago", read: true },
  { id: "N7", title: "Health Pack Shared", message: "Your Health Pack was shared with Dr. Naik under emergency consent.", type: "info", time: "6 hr ago", read: true },
  { id: "N8", title: "New Emergency", message: "Critical cardiac case reported 2.1 km from your facility.", type: "emergency", time: "8 hr ago", read: true },
  { id: "N9", title: "System Alert", message: "Scheduled maintenance window tonight 1:00 AM – 2:00 AM.", type: "warning", time: "10 hr ago", read: true },
  { id: "N10", title: "Doctor Assigned", message: "Dr. Rina Naik has been assigned to case CASE7825.", type: "success", time: "1 day ago", read: true },
];

export const auditLogs: AuditLogEntry[] = [
  { id: "A1", user: "hospital@caresetu.com", action: "Accepted Case", resource: "CASE7821", device: "Chrome / Windows", status: "Success", timestamp: "2026-09-06 09:14:22" },
  { id: "A2", user: "doctor@caresetu.com", action: "Viewed Health Pack", resource: "Patient P003", device: "Safari / macOS", status: "Success", timestamp: "2026-09-06 09:16:05" },
  { id: "A3", user: "admin@caresetu.com", action: "Verified Hospital", resource: "H010", device: "Chrome / Windows", status: "Success", timestamp: "2026-09-06 08:02:11" },
  { id: "A4", user: "patient@caresetu.com", action: "Shared Health Pack", resource: "Consent HP-2291", device: "CareSetu App / Android", status: "Success", timestamp: "2026-09-06 08:41:52" },
  { id: "A5", user: "hospital@caresetu.com", action: "Rejected Case", resource: "CASE7809", device: "Chrome / Windows", status: "Success", timestamp: "2026-09-06 07:55:31" },
  { id: "A6", user: "unknown", action: "Login Attempt", resource: "Auth Service", device: "Unknown Device", status: "Failure", timestamp: "2026-09-06 07:30:00" },
];
