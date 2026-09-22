-- =========================================================================
-- Idempotency Mechanism 
-- =========================================================================

-- CareSetu uses the `idempotencyKey` column on the `EmergencyCase` table.
-- The PWA frontend generates a unique string (or uses an operationId) when 
-- storing the SOS intent offline. Upon network reconnection, this same key 
-- is sent. 

-- 1. Look up existing case to prevent duplicates
SELECT * FROM "emergency_cases" 
WHERE "idempotencyKey" = :idempotencyKey 
LIMIT 1;

-- 2. Enforced at the database level via unique constraint:
-- ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_idempotencyKey_key" UNIQUE ("idempotencyKey");

-- Note: CareSetu does NOT use a separate "operationId" column. The `idempotencyKey` 
-- acts as the unique operation identifier.
