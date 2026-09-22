-- =========================================================================
-- Reusable Spatial Queries & Snippets
-- =========================================================================

-- 1. Extracting Latitude/Longitude from JSON and converting to Geography Point
SELECT 
  id, 
  name,
  ST_SetSRID(
    ST_MakePoint(
      CAST(location->>'longitude' AS double precision), 
      CAST(location->>'latitude' AS double precision)
    ), 4326
  )::geography AS geo_point
FROM hospitals;

-- 2. Calculating distance (in meters) between two JSON locations
-- Example: Distance between a Hospital and a specific point (lng: 72.5714, lat: 23.0225)
SELECT 
  name,
  ST_Distance(
    ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
    ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography
  ) AS distance_meters
FROM hospitals;

-- 3. Filtering by Radius (DWithin)
-- Example: Find all hospitals within 5km (5000 meters)
SELECT name 
FROM hospitals
WHERE ST_DWithin(
  ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)::geography,
  ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326)::geography,
  5000
);
