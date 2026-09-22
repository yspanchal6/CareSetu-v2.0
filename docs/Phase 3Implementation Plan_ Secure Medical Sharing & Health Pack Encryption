# Phase 3 Implementation Plan: Secure Medical Sharing & Health Pack Encryption

This document outlines the inspection report and execution strategy for integrating the Phase 3 functionality with the actual Express HTTP layer.

## Inspection Report

### EXISTING
- **Database Schema**: `HealthPack`, `HealthPackShare`, `Consent`, and `AuditLog` models correctly exist in `schema.prisma`. 
- **Core Services**: We already implemented `crypto.js` (AES-256-GCM encryption appending `authTag` safely to avoid migrations) and `health-pack.service.js` (handles creation, consent, and logging).
- **Authentication**: `auth.middleware.js` correctly enforces JWT token parsing and Role-Based Access Control (`authorize('PATIENT', 'HOSPITAL')`).
- **Frontend**: A `HealthPackPage.tsx` component exists, but it currently relies entirely on static, hardcoded JSON data (`patients[2]`).

### MISSING
- **HTTP Layer**: The `health-pack.controller.js` and `health-pack.routes.js` files are missing, meaning the frontend cannot actually make HTTP requests to the HealthPack services.
- **Express Integration**: `app.js` does not mount any `/api/health-pack` routes.
- **HTTP E2E Testing**: Previous tests only invoked the backend service layer directly. An HTTP-driven E2E test suite using valid JWT tokens is missing.

### CONFLICTS
- None detected. The AES-256-GCM `authTag` injection into the existing `encryptedData` string perfectly avoids schema resetting or destructive migrations. 

### REQUIRED CHANGES
1. **Controller Layer (`health-pack.controller.js`)**: 
   - Wrap service calls with Express `req/res` handling.
   - Enforce explicit error statuses (400, 401, 403, 404, 500).
2. **Routing Layer (`health-pack.routes.js`)**:
   - `POST /` (Create Pack) -> `auth, authorize('PATIENT')`
   - `GET /my-pack` -> `auth, authorize('PATIENT')`
   - `GET /shared/:packId` -> `auth, authorize('HOSPITAL')`
3. **App Integration**:
   - Mount `app.use('/api/health-pack', healthPackRoutes)` in `src/app.js`.
4. **HTTP E2E Verification (`test_p3_http.js`)**:
   - Write a node script to spin up the Express server and use `fetch()` to verify the entire flow via network requests, simulating both a Patient and a Hospital JWT.

---

## User Review Required

> [!IMPORTANT]
> The frontend `HealthPackPage.tsx` currently uses static local data. Since the user asked to "connect the existing frontend Health Pack UI" if endpoints exist, I will attempt to wire up `HealthPackPage.tsx` to `GET /api/health-pack/my-pack` using standard React `useEffect`/`fetch`. However, the exact auth token management logic (e.g. `localStorage.getItem('token')`) might need assumptions. Are you okay with me modifying `HealthPackPage.tsx` to fetch from the API?

## Open Questions

> [!WARNING]
> The encryption key is currently falling back to a hardcoded string in `crypto.js` if `process.env.HEALTH_PACK_SECRET_KEY` is not present. This prevents server crash during E2E scripts. Is this acceptable for the MVP, or should I throw an explicit 500 error if the key is missing in production?
