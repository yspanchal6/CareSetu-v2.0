# CARESETU V2.0 — HEALTHPACK CASE ACCESS 403 BUG FIX & SECURITY DOCUMENTATION

## 1. Executive Summary & Root Cause

* **Failing Endpoint**: `GET /api/health-pack/case/:caseId` (Target case: `CASE-20260927-6B1AAB`)
* **Observed Failure**: Returned `HTTP 403 Forbidden` with message `Unauthorized access: HealthPack access expired or not shared.` when an assigned hospital clicked "View Health Pack" on an active emergency case.
* **Root Cause Identified**:
  1. In `backend/src/services/health-pack.service.js`, the `shareHealthPackWithHospital(patientId, hospitalId, hospitalUserId)` method looked up existing `HealthPackShare` records. If a share record existed (even if its `expiresAt` timestamp was in the past), it returned `existingShare` without renewing its expiration time (`expiresAt`) or setting its status to `'ACTIVE'`.
  2. When emergency case `CASE-20260927-6B1AAB` was accepted by hospital `ys panchal` (`6005a8cb-0caf-45a5-937c-5ae40602ff7f`) on Sept 27, an `existingShare` created on Sept 23 (with `expiresAt: 2026-09-24`) was returned unmodified.
  3. During `getDecryptedHealthPackForCase`, active shares were filtered with `s.status === 'ACTIVE' && (!s.expiresAt || new Date(s.expiresAt) > new Date())`. Because `expiresAt` had passed, `isSharedWithMember` evaluated to `false`, throwing an `Unauthorized access` exception (HTTP 403).

---

## 2. Intended Authorization Model & Architectural Fix

### Intended Rules
1. **Authoritative Backend**: The backend is the sole authority for HealthPack access; frontend claims or role-only checks (`role === 'HOSPITAL'`) are insufficient.
2. **Case & Hospital Binding**: Access requires that:
   - The requesting user has a valid `Hospital` profile.
   - The hospital is legitimately assigned to the emergency case (`emergencyCase.hospitalId === hospital.id`) OR has an active accepted/pending request (`HospitalRequest`).
   - The emergency case is active (not `CLOSED` or `CANCELLED`).
3. **Automatic Emergency Sharing & Expiration Renewal**:
   - When a hospital accepts an emergency case or views an active assigned case, temporary 24-hour HealthPack access is created or renewed (`expiresAt = now + 24 hours`).
   - For non-active/closed cases or unassigned hospitals, expired or revoked shares are strictly rejected with HTTP 403 Forbidden.

### Database Relationships
- `EmergencyCase`: ID `e65a7994-c7d2-4ff6-ac9d-d86e57aa50ca`, `caseId: CASE-20260927-6B1AAB`, Status: `TRANSFER`, `patientId`, `hospitalId` (`6005a8cb-0caf-45a5-937c-5ae40602ff7f`).
- `HealthPack`: Encrypted patient medical profile (`AES-256-CBC` / `AES-256-GCM`).
- `HealthPackShare`: Maps `(healthPackId, sharedWithHospitalId, sharedWithUserId, expiresAt, status)`.

---

## 3. Implemented Fixes

### 1. Backend Service Fix (`backend/src/services/health-pack.service.js`)
- **Share Renewal**: Updated `shareHealthPackWithHospital` so that if an `existingShare` is found but is expired or non-active, it executes a Prisma `update` extending `expiresAt` by +24 hours and resetting `status = 'ACTIVE'`.
- **Auto-Access for Active Cases**: Updated `getDecryptedHealthPackForCase` so that if `isSharedWithMember` is false but the hospital IS legitimately assigned/requested for an active emergency case (`status !== 'CLOSED' && status !== 'CANCELLED'`), it automatically calls `shareHealthPackWithHospital` to grant/renew temporary 24-hour access.
- **Enum Fix**: Updated Prisma `HospitalRequestStatus` query filter to use valid enum values `['ACCEPTED', 'PENDING']`.

### 2. Frontend UX & Security Polish (`frontend/src/pages/hospital/HospitalEmergencyPages.tsx`)
- **Modal Error Action Buttons**: Updated the HealthPack modal so that when authorization fails or access is unavailable, a user-friendly Access Control card is rendered with explicit **Retry Request** and **Close** buttons.
- **Print Summary Protection**: Wrapped the "Print Summary" button in `healthPackData && !packLoading && !packError` so that Print Summary cannot be clicked or leak data when access fails.
- **State Cleanup**: Guaranteed that `healthPackData` is reset to `null` immediately upon modal opening or network/authorization error, preventing stale medical data caching.

---

## 4. IDOR & Security Enforcement

| Scenario | Request / Context | Response | Result |
| :--- | :--- | :--- | :--- |
| **Authorized Hospital (Active Case)** | Hospital `ys panchal` requests `CASE-20260927-6B1AAB` | `HTTP 200 OK` | Decrypted HealthPack returned; share renewed +24h |
| **Unauthorized Hospital (IDOR Attempt)** | Hospital A requests Hospital B's case `CASE-SEC-1790522361894-78` | `HTTP 403 Forbidden` | Blocked: `Unauthorized: Hospital is not assigned or requested for this emergency case.` |
| **Guessed / Non-existent Case ID** | Request `/api/health-pack/case/CASE-GUESSED-99999` | `HTTP 404 Not Found` | Blocked cleanly |
| **Expired Share on Closed Case** | Hospital requests closed case with expired share | `HTTP 403 Forbidden` | Blocked: `Unauthorized access: HealthPack access expired or not shared.` |
| **Revoked Share** | Share record status = `REVOKED` | `HTTP 403 Forbidden` | Access denied |
| **Unauthenticated / Wrong Role** | Non-hospital or unauthenticated user | `HTTP 401 / 403` | Blocked by auth middleware |

---

## 5. Automated Test & Build Verification Results

1. **IDOR & HealthPack Security Test Suite** (`node backend/tests/healthpack-case-access-security.test.js`):
   - `6 PASSED, 0 FAILED`
2. **HealthPack Data Flow Test Suite** (`node backend/tests/healthpack.data.flow.test.js`):
   - `60 PASSED, 0 FAILED`
3. **Authentication Security Test Suite** (`node backend/tests/auth.security.test.js`):
   - `20 PASSED, 0 FAILED`
4. **Hospital Matching Test Suite** (`node backend/tests/hospital-matching.test.js`):
   - `25 PASSED, 0 FAILED`
5. **Emergency SOS Service Contract Test Suite** (`node backend/tests/emergency-sos-contract.test.js`):
   - `4 PASSED, 0 FAILED`
6. **Database Integrity & Provenance Audit** (`node backend/tests/audit-db-integrity.js`):
   - `26 CareSetu Hospitals, 21 Government Health Records, 33 Emergency Cases` (0 duplicate groups, 0 orphans) — `PASSED`
7. **Frontend Production Build** (`npm run build`):
   - `✓ built in 16.65s` (0 TypeScript / Rollup errors)
