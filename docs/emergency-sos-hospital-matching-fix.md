# CareSetu — Emergency SOS 500 Error Fix & Hospital Matching Contract Documentation

## 1. Root Cause Analysis
During emergency SOS creation (`POST /api/emergency/sos`), the backend failed with `HTTP 500 Internal Server Error` due to a service-contract mismatch between `backend/src/services/emergency.service.js` and `backend/src/services/hospital-matching.service.js`:

- **Issue 1 (Export Structure)**: `hospital-matching.service.js` exported `{ HospitalMatchingService }` as a named export (`module.exports = { HospitalMatchingService }`), whereas `emergency.service.js` imported it via CommonJS as `const hospitalMatchingService = require('./hospital-matching.service')`. Consequently, `hospitalMatchingService` resolved to `{ HospitalMatchingService }` without top-level method bindings.
- **Issue 2 (Missing Method)**: The static method `findBestHospitals({ latitude, longitude, emergencyType })` was missing from `HospitalMatchingService` class, causing `hospitalMatchingService.findBestHospitals` to evaluate to `undefined` and throw `TypeError: hospitalMatchingService.findBestHospitals is not a function`.

---

## 2. Implementation & Fix Details

### A. Hospital Matching Service Contract ([hospital-matching.service.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/services/hospital-matching.service.js))
- Implemented `static async findBestHospitals({ latitude, longitude, emergencyType = 'MEDICAL', radiusKm = 50, limit = 5 })` inside `HospitalMatchingService` class:
  - Validates numeric GPS bounds (-90 to 90 latitude, -180 to 180 longitude).
  - Queries active CareSetu network hospitals (`user: { status: 'ACTIVE' }`, `emergencyAvailable: true`).
  - Computes Haversine distance between patient location and hospital coordinates.
  - Performs specialty capability filtering (`hasCardiology` for `CARDIAC`, `hasTraumaUnit` for `TRAUMA`/`ACCIDENT`, `hasICU` for `BREATHING`).
  - Ranks candidates using proximity score, capability bonus, and verification status.
  - Performs progressive radius expansion if initial search yields 0 candidates.
- Updated `module.exports` to export both `HospitalMatchingService` class AND standalone functions (`findBestHospitals`, `generateCandidates`, `getStats`, etc.), ensuring full compatibility regardless of require style.

### B. Resilient Emergency Service Execution ([emergency.service.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/services/emergency.service.js))
- Added numeric GPS coordinate validation in Step 2 (-90 to 90 for latitude, -180 to 180 for longitude).
- Wrapped hospital discovery step in a resilient `try...catch` block:
  - If hospital matching is unavailable or returns 0 matches, emergency creation logs an informational notice and proceeds with the persisted `emergencyCase`.
  - Emits real-time Socket.IO events (`emergency:created`, `hospital:found`, `emergency:request-sent`, `emergency:no-hospital`).
  - Preserves 108/112 emergency phone fallbacks and idempotency keys (`idempotencyKey`).

---

## 3. Test Suites & Verification

1. **Service Contract Tests**: `node tests/emergency-sos-contract.test.js` (**4/4 PASSED, 0 FAILED**)
   - Verified module export shape (`HospitalMatchingService` & `findBestHospitals`).
   - Verified `findBestHospitals` execution with valid coordinates and specialty capability filtering.
   - Verified graceful handling of out-of-bounds / NaN coordinates.

2. **Patient SOS & Idempotency Tests**: `node tests/patient.profile.sos.test.js` (**14/14 PASSED, 0 FAILED**)
   - Verified `POST /api/emergency/sos` for PATIENT role succeeds (HTTP 201).
   - Verified auto-creation of missing patient profile.
   - Verified HTTP 403 Forbidden for unauthorized roles (DOCTOR, HOSPITAL).
   - Verified HTTP 401 Unauthorized for unauthenticated requests.
   - Verified idempotency key deduplication (retrying same key returns existing case without duplicate records).

3. **Frontend Production Build**: `cd frontend && npm run build` (**SUCCESS, Exit Code 0, 2617 modules transformed**).

4. **Real Browser E2E Verification**:
   - Authenticated as patient user and triggered emergency SOS at `/patient/emergency`.
   - Verified case creation (`CASE-20260927-873F7F`), zero HTTP 500 errors, zero console errors, and successful live tracking navigation to `/patient/emergency/status/CASE-20260927-873F7F`.
