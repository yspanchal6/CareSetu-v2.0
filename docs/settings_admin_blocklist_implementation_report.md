# CARESETU — SETTINGS MANAGEMENT & ADMINISTRATOR CONTROL IMPLEMENTATION REPORT

**Project:** CareSetu-demo  
**Date:** September 18, 2026  
**Status:** GREEN (100% Verified with Empirical Test Evidence)

---

## 1. ARCHITECTURE & IMPLEMENTATION FINDINGS

Before modifying the codebase, we audited the existing backend, frontend, Prisma schema, and authorization model:
- **Role-Based Access Control (RBAC):** Backend uses `auth` middleware (verifying Bearer JWT or cookies) and `authorize(...roles)` middleware (`requireRole`). Server-side validation is strictly enforced on all admin endpoints (`authorize('ADMIN')`).
- **Data Isolation & Ownership:** Password hashing uses `bcrypt` with cost factor 12. User identity is derived strictly from the verified JWT payload (`req.user.userId`), never trusting client-supplied `userId` or payload role attributes.
- **Account Statuses:** User statuses include `ACTIVE`, `INACTIVE`, `BLOCKED`, and `PENDING`.
- **Database Schema:** Extended Prisma schema to incorporate a dedicated `AccountRestriction` model for blocklist tracking, supporting `PATIENT` and `HOSPITAL` target types, mandatory blocking reasons, expiration timestamps (`expiresAt`), revocation metadata (`revokedAt`, `revokedBy`), and relational foreign keys to `User`.

---

## 2. FILES INSPECTED

- `backend/prisma/schema.prisma`
- `backend/src/app.js`
- `backend/src/middleware/auth.middleware.js`
- `backend/src/controllers/auth.controller.js`
- `backend/src/controllers/admin.controller.js`
- `backend/src/routes/admin.routes.js`
- `backend/src/services/emergency.service.js`
- `backend/src/repositories/emergency.repository.js`
- `backend/src/services/medical-document.service.js`
- `backend/src/utils/socket.js`
- `frontend/src/services/api.ts`
- `frontend/src/pages/patient/PatientMiscPages.tsx`
- `frontend/src/pages/hospital/HospitalMiscPages.tsx`
- `frontend/src/pages/admin/AdminMiscPages.tsx`
- `frontend/src/App.tsx`

---

## 3. FILES CREATED OR MODIFIED

### Created Files:
1. `backend/src/services/settings.service.js` - Service handling profile view/update, bcrypt password change, and notification preferences.
2. `backend/src/controllers/settings.controller.js` - Controller endpoints for `/api/settings/*`.
3. `backend/src/routes/settings.routes.js` - Route definitions for settings guarded by `auth`.
4. `backend/src/services/admin-blocklist.service.js` - Service for account restrictions, auto-expiration, search, block history, and audit logging.
5. `backend/src/controllers/admin-blocklist.controller.js` - Controller endpoints for admin blocklist and audit operations.
6. `backend/scratch/test_settings_admin_blocklist.js` - Comprehensive automated test suite for 29 test requirements.
7. `docs/settings_admin_blocklist_implementation_report.md` - This implementation and audit report.

### Modified Files:
1. `backend/prisma/schema.prisma` - Added `AccountRestriction` model, `RestrictionStatus`, `RestrictionTargetType` enums, `notificationPreferences` JSON, and `User` relations.
2. `backend/src/app.js` - Mounted `/api/settings` route module.
3. `backend/src/routes/admin.routes.js` - Added blocklist, user search, hospital search, patient search, and audit log routes guarded by `auth, authorize('ADMIN')`.
4. `backend/src/controllers/auth.controller.js` - Added `isUserBlocked` check in `login` endpoint.
5. `backend/src/services/emergency.service.js` - Enforced block checks in `createEmergencyCase` (SOS creation) and `acceptEmergencyCase` (hospital acceptance).
6. `backend/src/repositories/emergency.repository.js` - Filtered out `BLOCKED` hospitals in `getActiveHospitalsInRadius` SQL query.
7. `backend/src/services/medical-document.service.js` - Enforced block check before document uploads.
8. `backend/src/utils/socket.js` - Enforced block check in Socket.IO handshake middleware.
9. `frontend/src/services/api.ts` - Added `settingsApi` and `adminApi` HTTP methods.
10. `frontend/src/pages/patient/PatientMiscPages.tsx` - Updated `PatientSettingsPage` with real profile editing, password update, and notification preferences.
11. `frontend/src/pages/hospital/HospitalMiscPages.tsx` - Updated `HospitalSettingsPage` with facility details editing, password update, and emergency availability toggle.
12. `frontend/src/pages/admin/AdminMiscPages.tsx` - Updated `AdminUsersPage`, `AdminHospitalsPage`, `AdminAuditLogsPage`, and `AdminSettingsPage` with real search, block/unblock confirmation modals with mandatory reason fields, and audit log history.

---

## 4. DATABASE & SCHEMA CHANGES

```prisma
enum RestrictionStatus {
  ACTIVE
  REVOKED
  EXPIRED
}

enum RestrictionTargetType {
  PATIENT
  HOSPITAL
}

model AccountRestriction {
  id            String                @id @default(uuid())
  targetUserId  String
  targetType    RestrictionTargetType
  status        RestrictionStatus     @default(ACTIVE)
  reason        String
  createdBy     String
  createdByUser User                  @relation("RestrictionsCreated", fields: [createdBy], references: [id], onDelete: Cascade)
  createdAt     DateTime              @default(now())
  expiresAt     DateTime?
  revokedAt     DateTime?
  revokedBy     String?
  revokedByUser User?                 @relation("RestrictionsRevoked", fields: [revokedBy], references: [id], onDelete: SetNull)

  @@index([targetUserId])
  @@index([targetType])
  @@index([status])
  @@index([createdBy])
  @@map("account_restrictions")
}
```

- Synchronized database with `npx prisma db push`.
- Re-generated client with `npx prisma generate` (v7.10.0).

---

## 5. API ENDPOINTS SUMMARY

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/settings/profile` | GET | Authenticated | Fetch authenticated user's profile details |
| `/api/settings/profile` | PATCH | Authenticated | Update permitted profile fields (strips role/privilege changes) |
| `/api/settings/password` | PATCH | Authenticated | Change password securely with bcrypt verification |
| `/api/settings/notifications` | PATCH | Authenticated | Update notification preferences |
| `/api/admin/dashboard/stats` | GET | ADMIN | Get platform statistics & emergency case metrics |
| `/api/admin/users` | GET | ADMIN | Search/filter all user accounts with restriction status |
| `/api/admin/hospitals` | GET | ADMIN | Search/filter hospital accounts with restriction status |
| `/api/admin/patients` | GET | ADMIN | Search/filter patient accounts with restriction status |
| `/api/admin/blocklist` | POST | ADMIN | Restrict patient or hospital account with mandatory reason |
| `/api/admin/blocklist/unblock` | POST | ADMIN | Revoke restriction and restore account status |
| `/api/admin/blocklist/history` | GET | ADMIN | View administrative blocklist history |
| `/api/admin/audit-logs` | GET | ADMIN | View security and administrative audit logs |

---

## 6. BLOCKLIST ENFORCEMENT POLICY

1. **Authentication:** Blocked accounts attempting to log in receive HTTP 403 Forbidden (`Account is restricted by an administrator. Reason: ...`).
2. **Emergency SOS Creation:** Blocked patient accounts calling `POST /api/emergency/sos` receive HTTP 403 Forbidden.
3. **Hospital Matching:** `getActiveHospitalsInRadius` excludes `BLOCKED` hospital accounts from emergency dispatch candidate pools.
4. **Hospital Case Acceptance:** Blocked hospital accounts calling `POST /api/emergency/accept/:caseId` receive HTTP 403 Forbidden.
5. **Medical Documents:** Blocked patients cannot upload medical documents (`POST /api/patient/documents`).
6. **Realtime Socket.IO:** Blocked accounts attempting to establish Socket.IO connections are rejected in handshake middleware.
7. **Auto-Expiration:** When `expiresAt` timestamp has passed, `isUserBlocked()` automatically updates the restriction to `EXPIRED` and restores user status to `ACTIVE`.
8. **Emergency Care Safety:** Active emergency care cases in progress are preserved and not cancelled mid-treatment if a user gets restricted.

---

## 7. AUDIT LOGGING IMPLEMENTATION

- Every block action logs an `ADMIN_ACTION` entry with `entity: 'AccountRestriction'`, actor admin ID, target user ID, restriction reason, and timestamp.
- Every unblock action logs an `ADMIN_ACTION` entry recording the revoking admin ID and reason.
- Profile and password updates record `PROFILE_UPDATED` and `SECURITY_EVENT` audit logs.
- Sensitive credentials (passwords, JWT secrets, decrypted medical summary payloads) are explicitly omitted from all audit logs and API responses.

---

## 8. AUTOMATED TEST RESULTS

Automated test suite `backend/scratch/test_settings_admin_blocklist.js` was executed against the running database and server:

```
====================================================
STARTING CARESETU SETTINGS & ADMIN BLOCKLIST SUITE
====================================================
[PASS] Test 1: Patient views own settings
[PASS] Test 2: Hospital views own settings
[PASS] Test 3: Administrator views permitted settings
[PASS] Test 4: Patient updates permitted profile fields
[PASS] Test 5: Hospital updates permitted profile fields
[PASS] Test 6: Unauthorized profile update is rejected
[PASS] Test 7: Role escalation attempt is rejected
[PASS] Test 8: Password update validates current password
[PASS] Test 9: Password is securely hashed
[PASS] Test 10: Sensitive values absent from responses
[PASS] Test 11: Admin dashboard requires admin authorization
[PASS] Test 12: Patient cannot access admin APIs
[PASS] Test 13: Hospital cannot access admin APIs
[PASS] Test 14: Admin can search permitted accounts
[PASS] Test 15: Admin can block a patient with a reason
[PASS] Test 16: Admin can block a hospital with a reason
[PASS] Test 17: Missing block reason is rejected
[PASS] Test 18: Duplicate active block is handled safely
[PASS] Test 19: Admin can unblock an account
[PASS] Test 20: Block/unblock actions create audit records
[PASS] Test 21: Blocked patient restriction is enforced
[PASS] Test 22: Blocked hospital restriction is enforced
[PASS] Test 23: Emergency workflow behavior is verified
[PASS] Test 24: Hospital acceptance behavior is verified
[PASS] Test 25: Socket authorization respects account restrictions
[PASS] Test 26: Unauthorized users cannot bypass restrictions by changing IDs
[PASS] Test 27: Expired restrictions behave according to policy
[PASS] Test 28: Existing emergency cases are handled safely
[PASS] Test 29: Medical information is not exposed through blocklist endpoints

====================================================
TEST SUMMARY: TOTAL: 29 | PASSED: 29 | FAILED: 0
====================================================
```

Frontend production build was verified:
`npm run build` in `frontend/` compiled 1756 modules cleanly without any TypeScript errors.

---

## 9. REQUIREMENT COMPLIANCE MATRIX

| Requirement Section | Status | Verification Evidence |
| :--- | :---: | :--- |
| **1. Settings Menu — All Portals** | **GREEN** | Verified profile view, edit, password update & notifications across Patient, Hospital, and Admin portals. |
| **2. Secure Profile Update API** | **GREEN** | Verified endpoints `/api/settings/*` with ownership check, bcrypt password hashing, input validation, and zero payload leakage. |
| **3. Administrator — Central Authority** | **GREEN** | Verified RBAC middleware protection, server-side role validation, user search, and administrative audit logging. |
| **4. Blocklist System** | **GREEN** | Dedicated `AccountRestriction` model, mandatory reason, optional expiration, revocation tracking, and active restriction checks. |
| **5. Blocklist Enforcement** | **GREEN** | Enforced at login, SOS creation, hospital matching, hospital acceptance, document upload, and socket connection. |
| **6. Administrator UI** | **GREEN** | Full admin control UI with user/hospital search, account status badges, confirmation modals with mandatory reasons, and audit log history. |
| **7. Security and Privacy** | **GREEN** | Rejection of IDOR, role escalation, mass assignment, unauthenticated requests, and password/medical data leakage. |
| **8. Testing Requirements** | **GREEN** | 29/29 tests PASSED in automated test suite `test_settings_admin_blocklist.js`. |
| **9. Verification** | **GREEN** | Database push, Prisma Client generation, backend test suite, and Vite production build all succeeded with zero errors. |
