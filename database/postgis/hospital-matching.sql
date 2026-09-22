-- =========================================================================
-- CareSetu Progressive Hospital Matching Query
-- =========================================================================

-- The application uses a dynamic loop spanning these radii in kilometers:
-- [2, 4, 8, 16, 32, 64]
-- 
-- The following SQL represents the raw Prisma $queryRaw execution that happens 
-- in `emergency.repository.js` for each step of the loop.

-- Parameters supplied by Prisma at runtime:
-- :longitude = Patient's longitude (e.g., 72.5714)
-- :latitude  = Patient's latitude (e.g., 23.0225)
-- :radiusMeters = The current loop radius in meters (e.g., 2000, 4000, 8000...)

SELECT *,
  ST_Distance(
    ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
    ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
  ) as "distanceMeters"
FROM hospitals
WHERE "emergencyAvailable" = true
AND location->>'longitude' IS NOT NULL
AND location->>'latitude' IS NOT NULL
AND ST_DWithin(
  ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
  ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
  :radiusMeters
)
ORDER BY "distanceMeters" ASC;
