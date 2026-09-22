-- =========================================================================
-- PostgreSQL Indexes Currently Existing in CareSetu
-- =========================================================================
-- These indexes exist in the live database. Do NOT invent new ones here.

-- Performance Indexes on HospitalRequest
-- Index on status for faster filtering
-- CREATE INDEX "hospital_requests_status_idx" ON "hospital_requests"("status");

-- Index on emergencyCaseId
-- CREATE INDEX "hospital_requests_emergencyCaseId_idx" ON "hospital_requests"("emergencyCaseId");

-- Index on hospitalId
-- CREATE INDEX "hospital_requests_hospitalId_idx" ON "hospital_requests"("hospitalId");

-- Index on requestedAt
-- CREATE INDEX "hospital_requests_requestedAt_idx" ON "hospital_requests"("requestedAt");

-- Performance Indexes on EmergencyCase
-- CREATE INDEX "emergency_cases_status_idx" ON "emergency_cases"("status");
-- CREATE INDEX "emergency_cases_patientId_idx" ON "emergency_cases"("patientId");

-- Performance Indexes on Notifications
-- CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
-- CREATE INDEX "notifications_status_idx" ON "notifications"("status");
