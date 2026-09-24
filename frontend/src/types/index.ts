export type UserRole = "patient" | "hospital" | "doctor" | "admin" | "guest";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  isVerified?: boolean;
  isProfileComplete?: boolean;
  verificationStatus?: string;
  isGuest?: boolean;
  patient?: any;
}


export type AvailabilityStatus = "Available" | "Limited" | "Busy" | "Unavailable";
export type CaseSeverity = "Critical" | "Urgent" | "Stable";
export type CaseAction = "Accepted" | "Rejected" | "Pending";

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone?: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  beds: number;
  bedsAvailable: number;
  icuBeds: number;
  icuAvailable: number;
  ventilators: number;
  ventilatorsAvailable: number;
  specialists: string[];
  capabilities: string[];
  availability: AvailabilityStatus;
  responseTimeMin: number;
  rating: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  bloodGroup: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  emergencyContacts: { name: string; phone: string; relation: string }[];
}

export type EmergencyStage =
  | "Reported"
  | "LocationCaptured"
  | "CaseAnalysed"
  | "FindingHospital"
  | "HospitalAssigned"
  | "Transfer"
  | "Treatment"
  | "Completed";

export interface EmergencyCase {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  severity: CaseSeverity;
  symptoms: string;
  requiredCapability: string;
  location: string;
  distanceKm: number;
  etaMin: number;
  stage: EmergencyStage;
  assignedHospital?: string;
  createdAt: string;
}

export type NotificationType = "emergency" | "info" | "warning" | "success";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  time: string;
  read: boolean;
}

export interface AuditLogEntry {
  id: string;
  user: string;
  action: string;
  resource: string;
  device: string;
  status: "Success" | "Failure";
  timestamp: string;
}
