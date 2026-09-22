-- =========================================================================
-- PostgreSQL Constraints Currently Existing in CareSetu
-- =========================================================================
-- These constraints exist in the live database. Do NOT invent new ones here.

-- 1. Unique Constraints (Enforced via Unique Indexes)

-- User Email Uniqueness
-- ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");

-- Patient 1:1 mapping with User
-- ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_key" UNIQUE ("userId");

-- Hospital 1:1 mapping with User
-- ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_userId_key" UNIQUE ("userId");

-- EmergencyCase Idempotency Key (Prevents offline duplicate SOS)
-- ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_idempotencyKey_key" UNIQUE ("idempotencyKey");

-- HospitalRequest unique constraint (One request per hospital per case)
-- ALTER TABLE "hospital_requests" ADD CONSTRAINT "hospital_requests_emergencyCaseId_hospitalId_key" UNIQUE ("emergencyCaseId", "hospitalId");

-- HealthPack 1:1 mapping with Patient
-- ALTER TABLE "health_packs" ADD CONSTRAINT "health_packs_patientId_key" UNIQUE ("patientId");


-- 2. Foreign Key Constraints
-- (Automatically managed by Prisma @relation)
-- e.g., hospital_requests_emergencyCaseId_fkey, hospital_requests_hospitalId_fkey, etc.
