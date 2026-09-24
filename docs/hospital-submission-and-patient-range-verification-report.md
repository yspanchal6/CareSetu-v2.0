# Hospital Submission & Patient Range Verification Report

## Executive Summary
This document summarizes the complete implementation and verification of the **Hospital Onboarding Flow**, **Optional Document Upload**, **Final Onboarding Submission**, **PostGIS Geographic Range-Based Hospital Search**, and **Patient Portal Visibility Controls** in **CareSetu v2.0**.

---

## 1. Root Causes Found & Addressed

1. **Document Upload Enforcement**: Step 5 was previously treating document uploads as strict blockers before final review. The flow has been updated so document upload is optional during initial onboarding while displaying clear disclaimers that verification and emergency dispatch access require document review and admin approval.
2. **File MIME & Signature Validation**: Previous uploads relied primarily on file extension checks. Enhanced both frontend file signature checks and backend magic bytes validation (`%PDF-`, `\x89PNG`, `\xFF\xD8\xFF`) to ensure real security.
3. **Database Transaction & Onboarding Persistence**: Missing transaction wrapper on final onboarding submission allowed partial updates. Implemented `prisma.$transaction` across `Hospital` updates and `AuditLog` creation (`action: 'PROFILE_UPDATED'`).
4. **Idempotency & Double Submission**: Multiple clicks on "Submit for Verification" could previously send redundant requests. Added server-side idempotency tracking and frontend submit loading/disabled states.
5. **Patient Portal Hospital Visibility Leak**: Unverified (`isVerified: false`) or draft hospitals were previously queryable. Added explicit `AND h."isVerified" = true` filter to SQL queries in `getActiveHospitalsInRadius`.

---

## 2. Files Changed

### Backend Core
- [`backend/src/controllers/hospital.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/hospital.controller.js):
  - Updated `findNearbyHospitals` to support configurable radius parameter up to 200 km, formatted distance strings (`distanceKm`, `distance`), verification badges, and location coordinates.
  - Implemented `submitHospitalOnboarding` and `updateHospitalProfile` with coordinate validation (-90 to 90 lat, -180 to 180 lng), transaction safety, audit logging, and idempotency key checks.
- [`backend/src/repositories/emergency.repository.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/repositories/emergency.repository.js):
  - Added `h.city` and `h."isVerified"` to `getActiveHospitalsInRadius` SQL projection.
  - Enforced `AND h."isVerified" = true` in spatial Haversine SQL query to guarantee unverified/pending hospitals are never exposed to patients.
- [`backend/src/routes/hospital.routes.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/routes/hospital.routes.js):
  - Registered `POST /api/hospitals/submit-onboarding` and `GET /api/hospitals/nearby`.

### Frontend Core & UI
- [`frontend/src/services/api.ts`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/services/api.ts):
  - Added `hospitalApi.submitOnboarding` and updated `hospitalApi.nearby` to accept `radius` parameter.
  - Updated `NearbyHospital` interface with `isVerified`, `verificationStatus`, `distanceKm`, `distance`, `city`, and `lastUpdated`.
- [`frontend/src/pages/hospital/HospitalProfileVerificationPage.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/hospital/HospitalProfileVerificationPage.tsx):
  - Step 5 Optional Document Upload: Added clear notice banner (*"Document upload is optional at this stage. Verification and emergency dispatch access require the required documents and approval."*).
  - Implemented client-side magic byte file signature validation (PDF, PNG, JPG <= 10MB).
  - Preserved document state across step navigation.
  - Step 6 Final Submission: Added consent confirmation checkbox, review summary, `submitOnboarding` API integration, loading spinner, error message retention with safe retry, and success toast + redirect to `/hospital/dashboard`.
- [`frontend/src/pages/patient/PatientHospitalsPage.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/patient/PatientHospitalsPage.tsx):
  - Integrated range-based hospital search calling `hospitalApi.nearby(lat, lng, radius)`.
  - Added GPS location request (`navigator.geolocation.getCurrentPosition`) with consent badge.
  - Added manual location fallback input fields (latitude/longitude & preset Indian metro cities).
  - Added configurable search radius selector dropdown (5 km, 10 km, 25 km, 50 km default, 100 km, 200 km).
  - Added range-based empty state with "Expand Search Radius to 100 km / 200 km" quick action.

---

## 3. API Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/hospitals/submit-onboarding` | Authenticated `HOSPITAL` | Final onboarding submission. Validates coordinates, sets status to `PENDING_REVIEW` & `SUBMITTED`, logs audit event. |
| `GET` | `/api/hospitals/nearby?lat=&lng=&radius=` | Public / Patient | Returns approved hospitals within configured radius with distance in km, capabilities, and verification badge. |
| `POST` | `/api/hospitals/profile` | Authenticated `HOSPITAL` | Save draft or updated profile details. |
| `POST` | `/api/documents/upload` | Authenticated `HOSPITAL` | Upload optional license/registration document with magic bytes validation. |

---

## 4. Database Schema & Persistence

- **Models Utilized**: `Hospital`, `User`, `AuditLog`, `HospitalDocument`.
- **Status Fields**:
  - `verificationStatus`: `PENDING_REVIEW` upon submission (`APPROVED` upon admin verification).
  - `onboardingStatus`: `SUBMITTED`.
  - `isVerified`: `false` during onboarding; set to `true` by system admin approval.
- **Location Storage**: PostGIS/JSON coordinate object `{ latitude, longitude }` with bounds validation (-90 to 90 lat, -180 to 180 lng).

---

## 5. Verification & Test Results

### Automated Test Suite Execution (`backend/test_hospital_submission_and_range.js`)

```bash
cmd /c "node test_hospital_submission_and_range.js"
```

**Results**:
- ✅ **New hospital initialized as unverified (`isVerified = false`)**: PASSED
- ✅ **Rejects invalid latitude > 90 with HTTP 400**: PASSED
- ✅ **Returns clear latitude validation error**: PASSED
- ✅ **Onboarding submission returned HTTP 200 OK**: PASSED
- ✅ **Response payload has `success: true`**: PASSED
- ✅ **Verification status set to `PENDING_REVIEW`**: PASSED
- ✅ **Onboarding status set to `SUBMITTED`**: PASSED
- ✅ **Audit log created for `PROFILE_UPDATED`**: PASSED
- ✅ **Unverified / `PENDING_REVIEW` hospital EXCLUDED from patient search results**: PASSED
- ✅ **Approved hospital INCLUDED when within 50 km radius**: PASSED
- ✅ **Approved hospital outside tiny 1m search radius correctly filtered out**: PASSED

**Total Summary**: **11 Passed, 0 Failed**.

---

### Frontend Build Verification (`frontend/`)

```bash
cmd /c "npm run build"
```

**Results**:
- `tsc -b && vite build` built successfully in 11.81s with **0 TypeScript errors**.

---

## 6. Remaining Limitations & Recommendations

1. **Admin Approval UI**: System admins verify documents via backend API or admin portal; real-world document verification happens asynchronously.
2. **TextBee Rate Limits**: In production deployment, ensure SMS provider quota is monitored to avoid HTTP 429 warnings during emergency dispatches.
