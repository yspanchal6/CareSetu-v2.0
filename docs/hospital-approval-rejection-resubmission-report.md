# CareSetu v2.0 Hospital Verification Workflow Report

## Executive Summary
This report documents the architectural fixes, database transaction enforcement, role-based status banners, resubmission flow, and one-time 3-second approval celebration toast implemented for **CareSetu v2.0 Hospital Verification Workflow**.

All verification decisions are strictly driven by backend PostgreSQL database transactions, enforcing `verificationStatus = APPROVED` and `hospitalStatus = ACTIVE` as the single source of truth.

---

## 1. Root Cause of Incorrect "Verified" Screen
- **Previous Issue**: `DocumentVerificationPage.tsx` was displaying `"Document Verification Successful"` / `"Account Status: Verified"` whenever `isVerified` was boolean true on the user object (e.g. after uploading a document or verifying an OTP). It failed to verify whether Admin approval had actually occurred for hospital accounts.
- **Root Cause**: Frontend code checked standard email/document verification flags without validating backend hospital verification status (`verificationStatus = APPROVED` AND `hospitalStatus = ACTIVE`).
- **Remediation**:
  1. Updated `DocumentVerificationPage.tsx` so hospital accounts only render the verified success step when backend confirms `verificationStatus === 'APPROVED'` and `hospitalStatus === 'ACTIVE'`.
  2. Deprecated and removed cached/hardcoded verification flags and stale localStorage state.

---

## 2. Files Modified & Created

### Backend Component Updates
- [`backend/src/controllers/admin.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/admin.controller.js):
  - Updated `approveHospital` to wrap DB updates, audit logging, and `HOSPITAL_APPROVAL_EVENT` system notification in a safe Prisma transaction.
  - Updated `rejectHospital` to enforce mandatory rejection reason, update DB audit logs (`HospitalRejection`), and set hospital status `INACTIVE`.
  - Fixed timestamp parsing and audit log association to accurately report `REJECTED` vs `PENDING_REVIEW`.
- [`backend/src/controllers/hospital.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/hospital.controller.js):
  - Updated `getHospitalProfile` to parse audit log details and compute current `verificationStatus` and `rejectionReason`.
  - Implemented `getUnseenApprovalEvent` and `consumeApprovalEvent` handlers.
  - Updated `getAllHospitals` to filter strictly on `isVerified = true` and `user.status = ACTIVE`.
- [`backend/src/repositories/emergency.repository.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/repositories/emergency.repository.js):
  - Updated `getActiveHospitalsInRadius` PostGIS/SQL query to filter strictly by `h.isVerified = true` and `u.status = ACTIVE`.
- [`backend/src/routes/hospital.routes.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/routes/hospital.routes.js):
  - Registered `GET /api/hospitals/approval-event` and `POST /api/hospitals/approval-event/consume`.
- [`backend/src/services/document-verification.service.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/services/document-verification.service.js):
  - Updated `getVerificationStatus` to include `verificationStatus` and `hospitalStatus`.

### Frontend Component Updates
- [`frontend/src/services/api.ts`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/services/api.ts):
  - Extended `DocumentVerificationStatus` and added `getApprovalEvent()` and `consumeApprovalEvent(eventId)` to `hospitalApi`.
- [`frontend/src/pages/auth/DocumentVerificationPage.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/auth/DocumentVerificationPage.tsx):
  - Enforced strict backend check (`verificationStatus === 'APPROVED'` & `hospitalStatus === 'ACTIVE'`).
- [`frontend/src/pages/hospital/HospitalDashboard.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/hospital/HospitalDashboard.tsx):
  - Added modern one-time 3-second celebration toast modal with close button, auto-dismiss (3s), smooth animation, and accessibility (`role="status"`).
  - Integrated role-specific status banners (`PENDING_REVIEW`, `REJECTED` with Admin feedback, `APPROVED`, `BLOCKED`).
- [`frontend/src/pages/hospital/HospitalProfileVerificationPage.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/hospital/HospitalProfileVerificationPage.tsx):
  - Rendered Admin Rejection Feedback Banner when loaded in `REJECTED` state, allowing pre-filled data edits and resubmission.

### Test & Automation Scripts
- [`backend/test_hospital_approval_rejection_resubmission.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/test_hospital_approval_rejection_resubmission.js):
  - End-to-end integration test verifying all 10 workflow scenarios.

---

## 3. Database Status Transitions

| Action / State | `isVerified` (User/Hosp) | `status` (User) | `verificationStatus` | Patient Search Visibility |
| :--- | :--- | :--- | :--- | :--- |
| **Initial Onboarding Submit** | `false` | `INACTIVE` | `PENDING_REVIEW` | ❌ Excluded |
| **Admin Rejects Request** | `false` | `INACTIVE` | `REJECTED` | ❌ Excluded |
| **Hospital Resubmits Details** | `false` | `INACTIVE` | `PENDING_REVIEW` | ❌ Excluded |
| **Admin Approves Request** | `true` | `ACTIVE` | `APPROVED` | ✅ Included |
| **Admin Blocks Account** | `false` / `true` | `BLOCKED` | `BLOCKED` | ❌ Excluded |

---

## 4. Admin Workflow & Audit Logging
1. Admin reviews incoming verification requests via `GET /api/admin/hospitals/verification-requests`.
2. Admin rejects request with mandatory feedback string (`POST /api/admin/hospitals/:id/reject`).
   - Transaction creates `HospitalRejection` audit log and sends email notification.
3. Admin approves request (`POST /api/admin/hospitals/:id/approve`).
   - Transaction sets `isVerified = true`, `status = ACTIVE`, creates `HospitalApproval` audit log, and creates `HOSPITAL_APPROVAL_EVENT` notification in database.

---

## 5. Resubmission Workflow
1. Hospital sees `REJECTED` banner on Hospital Dashboard with Admin feedback reason.
2. Hospital clicks **"Update Documents & Resubmit →"**.
3. Navigates to `/hospital/profile-verification` where all previously entered details are preserved.
4. Admin feedback banner is highlighted at the top.
5. Hospital modifies details/documents and clicks **"Submit for Verification"**.
6. Profile update executes with `isFinalSubmit = true`, logging `HOSPITAL_ONBOARDING_SUBMITTED` and transitioning status to `PENDING_REVIEW`.

---

## 6. One-Time 3-Second Approval Toast
- When Admin approves a hospital, a notification record with `title: 'HOSPITAL_APPROVAL_EVENT'` and `status: 'UNREAD'` is written to PostgreSQL.
- When hospital user logs in or views the dashboard:
  1. Frontend calls `GET /api/hospitals/approval-event`.
  2. If `hasUnseenApproval = true`, toast modal displays: `"Congratulations! Admin has successfully approved your hospital registration. Your hospital portal is now active."`
  3. Frontend immediately invokes `POST /api/hospitals/approval-event/consume` to set `status = READ` in PostgreSQL.
  4. Toast automatically dismisses after 3 seconds or when user clicks close button.
  5. Subsequent page refreshes or logins detect `hasUnseenApproval = false` and do NOT display the toast again.

---

## 7. Integration Test Execution & Results

### Execution Command
```bash
node test_hospital_approval_rejection_resubmission.js
```

### Console Output Evidence
```text
====================================================
STARTING CARESETU v2.0 HOSPITAL WORKFLOW TESTS
====================================================

[TEST 1 PASSED] Hospital account created with initial status: INACTIVE, isVerified: false
[TEST 1.1 PASSED] Hospital submitted onboarding. Status returned: PENDING_REVIEW
[TEST 1.2 PASSED] Hospital profile verificationStatus: PENDING_REVIEW
[TEST 2 PASSED] Patient search excludes PENDING_REVIEW hospital: true
[BREVO_PROVIDER] Dispatching email to h***2@caresetu.org (Attempt 1/3)
[BREVO_PROVIDER] HTTP 401 Unauthorized: Server IP (152.59.32.201) is not authorized or API key is invalid.
[BREVO_PROVIDER] Diagnostic hint: Whitelist 152.59.32.201 in Brevo dashboard: https://app.brevo.com/security/authorised_ips
[TEST 3 PASSED] Admin rejected request with reason: Clinical license document missing registration stamp.
[TEST 4 PASSED] Hospital sees status REJECTED with reason: Clinical license document missing registration stamp.
[TEST 5 PASSED] Patient search excludes REJECTED hospital: true
[TEST 6 PASSED] Hospital resubmitted. Status returned: PENDING_REVIEW
[TEST 6.1 PASSED] Resubmitted status in profile: PENDING_REVIEW
[BREVO_PROVIDER] Dispatching email to h***2@caresetu.org (Attempt 1/3)
[BREVO_PROVIDER] HTTP 401 Unauthorized: Server IP (152.59.32.201) is not authorized or API key is invalid.
[BREVO_PROVIDER] Diagnostic hint: Whitelist 152.59.32.201 in Brevo dashboard: https://app.brevo.com/security/authorised_ips
[TEST 7 PASSED] Admin approved hospital. Returned status: APPROVED
[TEST 7.1 PASSED] Approved status in hospital profile: APPROVED
[TEST 8 PASSED] Unseen approval event detected: true Event ID: ce8c6475-9d42-4db9-9508-867f1fc5afb7
[TEST 8.1 PASSED] Second check after consumption hasUnseenApproval: false
[TEST 9 PASSED] Patient search includes APPROVED & ACTIVE hospital: true
[TEST 10 PASSED] Patient search excludes BLOCKED hospital: true

====================================================
ALL 10 INTEGRATION VERIFICATION TESTS SUCCEEDED PERFECTLY!
====================================================
```

### Frontend Build Verification
```bash
cmd /c "npm run build"
```
**Output**: `built in 12.03s` with 0 TypeScript/ESLint errors.

---

## 8. Remaining Limitations
- **External Brevo Email Delivery**: If Brevo API key is invalid or IP address is not whitelisted, email dispatch logs a warning (HTTP 401), but database transactions and in-app verification proceed safely without failure.
