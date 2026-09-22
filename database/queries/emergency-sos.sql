-- =========================================================================
-- Emergency SOS Creation & Tracking
-- =========================================================================

-- 1. Create a new Emergency Case (Prisma Translation)
/*
  prisma.emergencyCase.create({
    data: { ... }
  })
*/
INSERT INTO "emergency_cases" (
  "id", 
  "patientId", 
  "emergencyType", 
  "severity", 
  "location", 
  "idempotencyKey", 
  "status"
) VALUES (
  'uuid', 
  'patient_id', 
  'CARDIAC', 
  'HIGH', 
  '{"latitude": 23.0225, "longitude": 72.5714}', 
  'TEST-IDEMP-001', 
  'MATCHING'
);

-- 2. Update Emergency Case Status to Accepted
UPDATE "emergency_cases" 
SET "status" = 'ACCEPTED', "updatedAt" = CURRENT_TIMESTAMP 
WHERE "id" = :caseId;
