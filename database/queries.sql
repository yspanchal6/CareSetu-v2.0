-- =========================================================================
-- CareSetu Core Queries Cheat Sheet
-- =========================================================================

-- 1. Hospital Matching Progressive Search (PostGIS)
-- This query runs inside a loop over radii: [2, 4, 8, 16, 32, 64] km
-- It extracts latitude/longitude from the JSON "location" column and casts them to geography types.

SELECT *,
  ST_Distance(
    ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
    ST_SetSRID(ST_MakePoint(:patient_longitude, :patient_latitude), 4326)::geography
  ) as "distanceMeters"
FROM hospitals
WHERE "emergencyAvailable" = true
AND location->>'longitude' IS NOT NULL
AND location->>'latitude' IS NOT NULL
AND ST_DWithin(
  ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
  ST_SetSRID(ST_MakePoint(:patient_longitude, :patient_latitude), 4326)::geography,
  :radiusMeters -- (e.g., 2000, 4000, 8000, ...)
)
ORDER BY "distanceMeters" ASC;

-- =========================================================================

-- 2. Idempotency Check
-- This query ensures offline SOS sync mechanisms in the PWA do not create duplicate emergency cases.
-- It is enforced via a UNIQUE constraint on the "idempotencyKey" column in the "EmergencyCase" table.

-- Look up existing case:
SELECT * FROM "EmergencyCase" 
WHERE "idempotencyKey" = :operationId_or_idempotencyKey 
LIMIT 1;

-- If inserting blindly, Prisma relies on the unique index:
CREATE UNIQUE INDEX "EmergencyCase_idempotencyKey_key" ON "EmergencyCase"("idempotencyKey");

-- =========================================================================

-- 3. Single-Hospital Acceptance Protection
-- A hospital cannot accept a case if another hospital already has.
-- While the application layer handles this inside a transaction, the database enforces safety 
-- via partial unique indexes if implemented, or simply through standard ACID transactions checking status:

-- Standard transactional lock approach used by CareSetu Prisma Client:
SELECT "status" FROM "EmergencyCase" WHERE "id" = :caseId FOR UPDATE;
-- If status === 'PENDING', update it:
UPDATE "EmergencyCase" SET "status" = 'ACCEPTED' WHERE "id" = :caseId;

-- If you want strict DB-level index protection (Partial Unique Index) 
-- to ensure only ONE 'ACCEPTED' record per EmergencyCase in HospitalRequest:
CREATE UNIQUE INDEX "HospitalRequest_single_acceptance_idx" 
ON "HospitalRequest" ("emergencyCaseId") 
WHERE "status" = 'ACCEPTED';
