# Database Repositories Directory (`backend/src/repositories`)

## Purpose
Implements the Repository pattern to abstract raw Prisma database queries away from business logic services.

## Key Repositories
- **`user.repository.js`:** Handles CRUD operations for User profiles, account updates, and authentication lookup.
- **`emergency.repository.js`:** Handles creation, status tracking, and hospital mapping queries for Emergency SOS cases.
- **`hospital.repository.js`:** Manages hospital profile queries, PostGIS spatial radius searches, and bed capacity updates.
- **`healthpack.repository.js`:** Manages medical document metadata and hospital consent grant records.
