# PostgreSQL Raw Schemas & Seeds (`database/postgresql`)

## Purpose
Contains read-only SQL exports, table definitions, foreign key constraints, and database verification scripts.

## Files
- `schema.sql`: Full read-only database export/archive generated via `pg_dump --schema-only`.
- `seed.sql`: Development/demo data exported directly from the database. Contains real bcrypt hashes for testing (e.g. `patient@test.com` / `password123`).
- `extensions.sql`: Documents PostgreSQL extensions required by CareSetu.
- `indexes.sql`: Documents PostgreSQL indexes that actually exist in the current database.
- `constraints.sql`: Documents constraints that actually exist in the current database.
- `verification.sql`: Read-only queries to quickly verify the local PostgreSQL state.

## Local Restore Guidance (Docker)
To restore this exact state locally using the Docker PostgreSQL container:

```bash
docker exec caresetu-db psql -U caresetu -d postgres -c "DROP DATABASE IF EXISTS caresetu_db;"
docker exec caresetu-db psql -U caresetu -d postgres -c "CREATE DATABASE caresetu_db;"
docker exec caresetu-db psql -U caresetu -d caresetu_db -f extensions.sql
docker exec caresetu-db psql -U caresetu -d caresetu_db -f schema.sql
docker exec caresetu-db psql -U caresetu -d caresetu_db -f seed.sql
```
*(Do NOT run this in production!)*
