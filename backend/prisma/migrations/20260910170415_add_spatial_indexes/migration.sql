-- Enable PostGIS if not already
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add GIST index for hospital location JSON lookups
-- (uses expression index on JSON fields)
CREATE INDEX IF NOT EXISTS hospitals_location_lat_lng_idx
ON hospitals (
  ((location->>'latitude')::float),
  ((location->>'longitude')::float)
);

-- Optional: Add PostGIS geography column for future migration
-- (Do NOT populate yet — JSON remains source of truth)
-- ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS location_geog geography(Point, 4326);
-- CREATE INDEX IF NOT EXISTS hospitals_location_geog_idx ON hospitals USING GIST(location_geog);