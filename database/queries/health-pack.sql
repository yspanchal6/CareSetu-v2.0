-- =========================================================================
-- Health Pack Queries
-- =========================================================================

-- 1. Patient retrieving their own Health Pack
SELECT * FROM "health_packs" 
WHERE "patientId" = :patientId;

-- 2. Check if a Hospital has consent to view a patient's Health Pack
-- Used during Health Pack decryption access control
SELECT * FROM "health_pack_shares" 
WHERE "healthPackId" = :healthPackId 
  AND "hospitalId" = :hospitalId 
  AND "status" = 'ACTIVE' 
  AND "expiresAt" > CURRENT_TIMESTAMP;

-- 3. Log a Health Pack access event in the AuditLog
INSERT INTO "audit_logs" (
  "id",
  "action",
  "userId",
  "resourceType",
  "resourceId",
  "metadata",
  "createdAt"
) VALUES (
  'uuid',
  'HEALTH_PACK_VIEWED',
  :hospitalUserId,
  'HEALTH_PACK',
  :healthPackId,
  '{"reason": "Emergency SOS match", "ipAddress": "..."}',
  CURRENT_TIMESTAMP
);
