-- =========================================================================
-- PostGIS Read-Only Verification Queries
-- =========================================================================

-- 1. Verify PostGIS is installed and return its version
SELECT PostGIS_Version();

-- 2. Verify Spatial Reference Systems (WGS 84 exists)
SELECT srid, auth_name, auth_srid 
FROM spatial_ref_sys 
WHERE srid = 4326;

-- 3. Test a basic spatial calculation (Distance between two coordinates)
-- Should return a valid double precision float (meters)
SELECT ST_Distance(
  ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
  ST_SetSRID(ST_MakePoint(72.5800, 23.0300), 4326)::geography
) AS test_distance;
