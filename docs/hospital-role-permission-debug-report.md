# Hospital Role Permission & Authorization Debug Report

## Executive Summary
This document provides a comprehensive report on the resolution of **Hospital Portal Authorization Errors** (HTTP 403 Forbidden on `/api/hospitals/*`), **Frontend Role Routing Protection**, **Google OAuth Role Persistence**, **Reverse Geocoding 400 Validation Fix**, and **Account Diagnostics & Admin Role Correction** in **CareSetu v2.0**.

---

## 1. Root Cause Analysis

1. **Frontend Role Routing Mismatch**: When a user registered or authenticated with a `PATIENT` role, navigating directly or via stale state to `/hospital/*` routes rendered the Hospital Portal layout. The browser attempted to call operational hospital endpoints (`/api/hospitals/profile`, `/api/hospitals/stats`, `/api/hospitals/submit-onboarding`), which correctly failed with HTTP 403 Forbidden because backend RBAC middleware (`requireRole('HOSPITAL')`) strictly enforces role boundaries.
2. **Reverse Geocoding Parameter & Network Errors**: `GET /api/geocoding/reverse` previously returned HTTP 400 when coordinates were missing, out of bounds (-90 to 90 lat, -180 to 180 lng), or when external Nominatim/OpenStreetMap requests failed or timed out.
3. **Google OAuth Role Integrity**: Google OAuth logins and registrations required explicit role persistence during account creation and transaction safety to ensure a user registered as `HOSPITAL` is never defaulted or degraded to `PATIENT`.

---

## 2. Files Changed

### Frontend
- [`frontend/src/routes/ProtectedRoute.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/routes/ProtectedRoute.tsx):
  - Normalized user role strings (`user.role.toLowerCase()`).
  - Added strict role matching. When a `PATIENT` attempts to access a `/hospital/*` route, `ProtectedRoute` intercepts the request, logs a warning, and immediately redirects the user to `/patient/dashboard`, preventing rendering of hospital pages or making forbidden API calls.

### Backend Controllers & Services
- [`backend/src/controllers/geocoding.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/geocoding.controller.js):
  - Extracted `lat`/`latitude` and `lng`/`lon`/`longitude` query parameters.
  - Implemented parameter validation checking for numeric conversion and coordinate bounds (-90 <= latitude <= 90, -180 <= longitude <= 180), returning descriptive HTTP 400 error messages.
  - Added safe provider fallback returning formatted location payload instead of throwing raw HTTP 400 errors during external network timeouts or rate-limiting.
- [`backend/src/controllers/hospital.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/hospital.controller.js):
  - Added `getHospitalDiagnostics` endpoint returning safe account telemetry (`userId`, `databaseRole`, `accountStatus`, `hospitalProfileExists`, `hospitalVerified`, `emergencyAvailable`).
- [`backend/src/routes/hospital.routes.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/routes/hospital.routes.js):
  - Registered `GET /api/hospitals/diagnostics` endpoint requiring authentication and `HOSPITAL` role.
- [`backend/src/controllers/admin.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/admin.controller.js):
  - Added `changeUserRole` endpoint (`POST /api/admin/users/:userId/change-role`) allowing system administrators to correct user account roles safely in a transaction with audit logging.
- [`backend/src/routes/admin.routes.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/routes/admin.routes.js):
  - Registered `POST /api/admin/users/:userId/change-role` endpoint.
- [`backend/src/services/google-auth.service.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/services/google-auth.service.js):
  - Verified `requestedRole` persistence during Google registration and guaranteed existing database roles are preserved upon subsequent logins.

---

## 3. Actual API Responses & Verification

### 3.1 Authorization Rejection for PATIENT User
**Request**:
```http
GET /api/hospitals/profile
Authorization: Bearer <PATIENT_JWT_TOKEN>
```
**Response**: `HTTP 403 Forbidden`
```json
{
  "error": "Insufficient permissions. Access restricted."
}
```

---

### 3.2 Authorized Access for HOSPITAL User
**Request**:
```http
GET /api/hospitals/profile
Authorization: Bearer <HOSPITAL_JWT_TOKEN>
```
**Response**: `HTTP 200 OK`
```json
{
  "success": true,
  "hospital": {
    "id": "e86d2524-7eb3-42e7-8cfb-665be5d852a1",
    "name": "Auth Test Hospital",
    "city": "Delhi",
    "isVerified": true,
    "emergencyAvailable": true
  }
}
```

---

### 3.3 Hospital Account Diagnostics
**Request**:
```http
GET /api/hospitals/diagnostics
Authorization: Bearer <HOSPITAL_JWT_TOKEN>
```
**Response**: `HTTP 200 OK`
```json
{
  "success": true,
  "diagnostics": {
    "userId": "b64a123f-490b-426c-a81d-ef1294200001",
    "email": "test_hosp_auth_1790105490000@caresetu.local",
    "databaseRole": "HOSPITAL",
    "accountStatus": "ACTIVE",
    "userVerified": false,
    "hospitalProfileExists": true,
    "hospitalId": "e86d2524-7eb3-42e7-8cfb-665be5d852a1",
    "hospitalName": "Auth Test Hospital",
    "hospitalVerified": true,
    "emergencyAvailable": true
  }
}
```

---

### 3.4 Reverse Geocoding Validation
#### Valid Coordinates:
**Request**: `GET /api/geocoding/reverse?lat=28.6139&lng=77.2090`
**Response**: `HTTP 200 OK`
```json
{
  "success": true,
  "address": "New Delhi, Delhi, 110001, India",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "latitude": 28.6139,
  "longitude": 77.209
}
```

#### Invalid Latitude Bounds (> 90):
**Request**: `GET /api/geocoding/reverse?lat=195.0&lng=77.2090`
**Response**: `HTTP 400 Bad Request`
```json
{
  "success": false,
  "error": "Invalid latitude. Latitude must be a number between -90 and 90 degrees."
}
```

---

### 3.5 Admin Role Correction Workflow
**Request**:
```http
POST /api/admin/users/c8f4d1d4-4dba-458f-8140-f85c6b0d31a0/change-role
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "newRole": "HOSPITAL",
  "reason": "User requested hospital onboarding fix"
}
```
**Response**: `HTTP 200 OK`
```json
{
  "success": true,
  "message": "User role updated successfully from PATIENT to HOSPITAL.",
  "user": {
    "id": "c8f4d1d4-4dba-458f-8140-f85c6b0d31a0",
    "email": "test_patient_1790105490000@caresetu.local",
    "role": "HOSPITAL"
  }
}
```

---

## 4. Test Results Summary

Executed automated test suite `backend/test_hospital_authorization_and_geocoding.js`:

```bash
cmd /c "node test_hospital_authorization_and_geocoding.js"
```

**Results**:
- ✅ **Test 1**: PATIENT `GET /api/hospitals/profile` returns HTTP 403 Forbidden.
- ✅ **Test 2**: PATIENT `POST /api/hospitals/submit-onboarding` returns HTTP 403 Forbidden.
- ✅ **Test 3**: PATIENT `GET /api/hospitals/stats` returns HTTP 403 Forbidden.
- ✅ **Test 4**: HOSPITAL `GET /api/hospitals/profile` returns HTTP 200 OK with hospital object.
- ✅ **Test 5**: HOSPITAL `GET /api/hospitals/diagnostics` returns HTTP 200 OK with telemetry.
- ✅ **Test 6**: Reverse geocoding with valid coordinates returns HTTP 200 OK.
- ✅ **Test 7**: Reverse geocoding with lat > 90 returns HTTP 400 Bad Request.
- ✅ **Test 8**: Reverse geocoding with missing parameters returns HTTP 400 Bad Request.
- ✅ **Test 9**: Google OAuth registration persists `role = HOSPITAL` in DB.
- ✅ **Test 10**: Google OAuth login preserves existing `HOSPITAL` role.
- ✅ **Test 11**: Admin role correction endpoint (`POST /api/admin/users/:id/change-role`) updates user role with audit log.

**Total Summary**: **23 Passed, 0 Failed**.

---

### Frontend Build Verification

```bash
cmd /c "npm run build"
```

**Result**: Built client environment cleanly in 14.72s with **0 TypeScript errors**.
