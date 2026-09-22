-- =========================================================================
-- PostgreSQL Extensions Used by CareSetu
-- =========================================================================

-- 1. uuid-ossp
-- Commonly used for UUID generation (UUIDv4) in default constraints.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. postgis
-- Required for spatial routing and hospital radius matching.
-- Documented separately in the postgis/ folder.
-- CREATE EXTENSION IF NOT EXISTS "postgis";
