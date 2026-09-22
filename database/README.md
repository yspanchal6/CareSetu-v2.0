# CareSetu Database Archives & Documentation

This `database/` directory contains read-only exports, seeds, and SQL reference documentation for the CareSetu PostgreSQL/PostGIS database.

**⚠️ CRITICAL SAFETY RULE:** 
**Prisma schema (`prisma/schema.prisma`) and Prisma migrations (`prisma/migrations/`) remain the absolute PRIMARY source of truth for the CareSetu database structure.**
The SQL files in this directory are purely for:
- Documentation and implementation reference
- Read-only exports and archives
- Local development/demo restoration
- Verification queries

They are **NOT** a second schema source of truth. Do NOT apply these files directly to a production or staging database.

## Directory Structure

### `postgresql/`
Contains the raw relational PostgreSQL structures.
- `schema.sql`: Full read-only database export.
- `seed.sql`: Development/demo data (contains real bcrypt hashes for testing).
- `extensions.sql`: Documented PostgreSQL extensions.
- `indexes.sql`: Documented indexes that exist in the live database.
- `constraints.sql`: Documented constraints that exist in the live database.
- `verification.sql`: Read-only queries to verify the PostgreSQL state.

### `postgis/`
Documents how CareSetu uses PostGIS for geographical tracking and hospital matching.
- `postgis_setup.sql`: Setup commands required to enable PostGIS.
- `spatial-queries.sql`: Reusable spatial query snippets.
- `hospital-matching.sql`: The exact progressive matching query logic.
- `verification.sql`: Read-only queries to verify PostGIS functionality.

### `queries/`
Contains application-level SQL references used natively by CareSetu's backend logic.
- `emergency-sos.sql`: Emergency SOS creation and state updates.
- `hospital-matching.sql`: The core hospital matching query loop.
- `idempotency.sql`: The database mechanisms protecting against duplicate SOS requests.
- `health-pack.sql`: Health pack retrieval and access logging.

## Single-Hospital Acceptance Protection
**NOT CURRENTLY IMPLEMENTED AT THE DATABASE LEVEL**
Application-level acceptance protection exists (via transactions and status checks in `EmergencyRepository`). A database-level partial unique index on `HospitalRequest` is RECOMMENDED for future database hardening, but does not currently exist in the schema.
