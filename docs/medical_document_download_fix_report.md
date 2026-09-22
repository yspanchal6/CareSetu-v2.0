# CARESETU — MEDICAL DOCUMENT DOWNLOAD FIX & AUDIT REPORT

**Date:** September 18, 2026  
**Project:** CareSetu — AI-Integrated Healthcare Platform  
**Target:** Medical Document Download Flow (`/api/patient/documents/:documentId/download`)  

---

## 1. Executive Summary & Root Cause Analysis

### Problem Description
Hospital users clicking "Open Document →" inside the Health Pack modal encountered an **HTTP 404 Not Found** or **HTTP 401 Unauthorized** error when requesting patient medical documents.

### Root Cause Analysis
1. **Route Prefix & Alias Registration:** The primary backend route was registered at `/api/patient/documents/:documentId/download`, but variations in request parameters or alternate document paths (`/api/documents/:documentId/download` or `/api/patient/documents/:documentId`) lacked alias route handlers.
2. **Hospital Authorization Verification:** The backend service originally looked up hospitals exclusively by `userId`. If the hospital JWT contained `hospitalId` or if user profile lookup returned null due to missing explicit `userId` relation mapping, the lookup threw `'Hospital profile not found.'`, which matched `'not found'` error filters and produced an HTTP 404 response instead of checking emergency case assignment.
3. **Emergency Case Authorization Gap:** Hospital authorization previously relied solely on `HealthPackShare` records. If an emergency case was accepted/assigned to a hospital without an explicit active `HealthPackShare` record existing prior, document requests were rejected.

---

## 2. Technical Modifications

### A. Route & Application Mounting ([`backend/src/app.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/app.js))
- Added route aliases to ensure requests routed to `/api/documents` or `/api/medical-documents` are seamlessly handled by `medicalDocumentRoutes`.
```js
app.use('/api/patient/documents', medicalDocumentRoutes);
app.use('/api/documents', medicalDocumentRoutes);
app.use('/api/medical-documents', medicalDocumentRoutes);
```

### B. Router Configuration ([`backend/src/routes/medical-document.routes.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/routes/medical-document.routes.js))
- Registered route parameter aliases (`/:documentId/download`, `/download/:documentId`, `/:documentId`).
- Enforced `auth` JWT middleware and `authorize('PATIENT', 'HOSPITAL')` RBAC protection across all document download endpoints.

### C. Service Authorization & Storage Logic ([`backend/src/services/medical-document.service.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/services/medical-document.service.js))
- **Dual Authorization Verification:** Hospitals are authorized if:
  1. An active, non-expired `HealthPackShare` exists (`consentGranted: true`), **OR**
  2. An `EmergencyCase` exists linking the hospital and patient in active or closed emergency state (`PENDING`, `MATCHING`, `HOSPITAL_REQUESTED`, `ACCEPTED`, `IN_PROGRESS`, `CLOSED`).
- **Path Traversal Protection:** Validates document IDs and resolves paths against `UPLOAD_DIR`, rejecting any `..`, `/`, or `\` path traversal attempts with HTTP 403.
- **Physical File Verification:** Ensures the file exists on disk (`fs.existsSync(fullPath)`), returning HTTP 404 if missing.

### D. Controller Response Formatting ([`backend/src/controllers/medical-document.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/medical-document.controller.js))
- Sets sanitized `Content-Disposition: inline; filename="..."` headers.
- Dynamically assigns `Content-Type` header (`application/pdf`, `image/jpeg`, `image/png`, etc.).
- Prioritizes error response codes:
  - `HTTP 400 Bad Request` for invalid input parameters.
  - `HTTP 401 Unauthorized` for missing/invalid JWT tokens.
  - `HTTP 403 Forbidden` for path traversal attempts and unauthorized patient/hospital requests.
  - `HTTP 404 Not Found` for missing database records or missing physical files on disk.

### E. Frontend Authenticated Fetch ([`frontend/src/pages/hospital/HospitalEmergencyPages.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/hospital/HospitalEmergencyPages.tsx))
- Replaced unauthenticated `<a href="...">` plain links with `<button onClick={() => openDocument(doc.id, doc.fileName)}>`.
- `openDocument` executes `fetch()` with `Authorization: Bearer <token>` header, converts response to Blob, creates Object URL (`URL.createObjectURL(blob)`), and opens it in a viewer tab with popup-blocker fallback.
- Object URLs are automatically revoked after 60 seconds to prevent memory leaks.

---

## 3. Test Verification & Audit Results

### Test Suite: `backend/scratch/test_medical_document_download.js`

Executed via `node backend/scratch/test_medical_document_download.js`:

| # | Test Scenario | Expected Status | Actual Status | Result |
|---|---------------|-----------------|---------------|--------|
| 1 | Authorized assigned hospital downloads document | 200 OK | 200 OK | ✅ PASS |
| 2 | Patient downloads their own permitted document | 200 OK | 200 OK | ✅ PASS |
| 3 | Unauthenticated request rejected | 401 Unauthorized | 401 Unauthorized | ✅ PASS |
| 4 | Unassigned hospital request rejected | 403 Forbidden | 403 Forbidden | ✅ PASS |
| 5 | Patient B attempting to access Patient A document | 403 Forbidden | 403 Forbidden | ✅ PASS |
| 6 | Invalid document ID format handled safely | 400/403 | 403 Forbidden | ✅ PASS |
| 7 | Missing physical file on disk | 404 Not Found | 404 Not Found | ✅ PASS |
| 8 | Expired HealthPack share rejected | 403 Forbidden | 403 Forbidden | ✅ PASS |
| 9 | Revoked HealthPack share rejected | 403 Forbidden | 403 Forbidden | ✅ PASS |
| 10 | Closed emergency case document access authorized | 200 OK | 200 OK | ✅ PASS |
| 11 | Path traversal attempt safely rejected | 403 Forbidden | 403 Forbidden | ✅ PASS |
| 12 | Direct public static URL access (`/uploads/documents/...`) | 404 Not Found | 404 Not Found | ✅ PASS |
| 13 | Correct Content-Type (`application/pdf`) returned | `application/pdf` | `application/pdf` | ✅ PASS |
| 14 | Log privacy (No medical data or credentials in logs) | Verified | Verified | ✅ PASS |
| 15 | Route alias (`/api/documents/:id/download`) compatibility | 200 OK | 200 OK | ✅ PASS |

**Final Test Summary:** 15 PASSED, 0 FAILED (100% Success Rate).

---

## 4. Build Validation
- **Frontend TypeScript & Vite Build (`npm run build`):** Executed cleanly with exit code `0`.
- **Backend Syntax & Security Audit:** All routes and services pass strict path-traversal and authorization checks.

---

## 5. Remaining Limitations & Recommendations
1. **Document Storage:** Physical documents are currently stored on local disk under `backend/uploads/documents/`. For production scale across multiple server instances, transition to Google Cloud Storage (GCS) or S3 signed URLs while retaining server-side auth verification.
2. **Audit Logging:** Every document download by a hospital generates audit log entries (`HEALTH_PACK_VIEWED`); ensure log rotation rules are configured in production.
