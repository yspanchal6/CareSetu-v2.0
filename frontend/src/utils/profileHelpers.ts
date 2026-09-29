import { User } from "../types";

/**
 * Single reusable helper to determine if a patient profile is complete.
 * A patient profile is considered complete if:
 * 1. user.isProfileComplete is explicitly true, OR
 * 2. user.isVerified is true, OR
 * 3. The patient data contains a valid name, age > 0, and specified gender.
 */
export function isPatientProfileComplete(user?: User | null, patientData?: any): boolean {
  if (!user) return false;
  if (user.role && user.role.toLowerCase() !== "patient" && user.role.toLowerCase() !== "guest") {
    // Non-patient roles are verified separately via admin/document verification
    return Boolean(user.isVerified);
  }

  if (user.isProfileComplete === true) {
    return true;
  }

  const p = patientData || user.patient;
  if (!p) return false;

  const hasName = Boolean(p.name && String(p.name).trim().length >= 2);
  const hasAge = Boolean(typeof p.age === "number" && p.age > 0) || Boolean(p.age && Number(p.age) > 0);
  const hasGender = Boolean(p.gender && String(p.gender).toUpperCase() !== "UNSPECIFIED");

  return hasName && hasAge && hasGender;
}
