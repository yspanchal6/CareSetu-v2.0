-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID extension (often used with Prisma defaults)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- Core Spatial Indexes
-- =========================================================================
-- NOTE: CareSetu currently stores locations as standard JSON objects ({"latitude": 23, "longitude": 72}).
-- Because of this, standard PostGIS geometry columns (@db.Geometry) and direct GIST indexes 
-- are NOT currently implemented in the database schema.
-- 
-- RECOMMENDED FUTURE DATABASE HARDENING — NOT CURRENTLY IMPLEMENTED:
-- To natively index these JSON columns spatially, an expression index could be added:
-- CREATE INDEX "Hospital_location_idx" ON "hospitals" USING GIST (
--   ST_SetSRID(ST_MakePoint(CAST(location->>'longitude' AS double precision), CAST(location->>'latitude' AS double precision)), 4326)
-- );

-- =========================================================================
-- Core Spatial Query Mechanics
-- =========================================================================
-- CareSetu uses JSON location objects in the API: { "latitude": 23.02, "longitude": 72.57 }
-- The PostGIS database expects standard WKB/Geometry (Point, 4326).
-- Example of converting lat/lng float parameters to PostGIS Point:
-- ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)

-- Example of measuring distance (in meters) between a point and hospital locations:
-- ST_DistanceSphere("location", ST_MakePoint(72.5714, 23.0225))

-- Example of finding hospitals within an 8km radius (8000 meters):
-- ST_DWithin("location", ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 8000)
