-- =========================================================================
-- PostgreSQL Read-Only Verification Queries
-- =========================================================================

-- 1. Check PostgreSQL Version
SELECT version();

-- 2. Check Database Connection & Current DB
SELECT current_database();

-- 3. Check Important Tables Exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 4. Verify Important Indexes and Constraints on HospitalRequest
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'hospital_requests';

-- 5. Verify Important Indexes and Constraints on EmergencyCase
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'emergency_cases';
