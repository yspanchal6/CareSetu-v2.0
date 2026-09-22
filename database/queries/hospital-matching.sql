-- =========================================================================
-- Hospital Matching Reference Query
-- =========================================================================

-- The exact query logic executed in backend/src/repositories/emergency.repository.js

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
  :radiusMeters -- Loops through 2000, 4000, 8000, 16000, 32000, 64000
)
ORDER BY "distanceMeters" ASC;
