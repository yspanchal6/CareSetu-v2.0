# CARESETU — SECURE OTP-BASED ACCOUNT CREDENTIAL UPDATE SECURITY REPORT

**Project:** CareSetu-demo  
**Date:** September 18, 2026  
**Status:** FULLY VERIFIED (22/22 Tests Passing)  

---

## 1. EXISTING IMPLEMENTATION FINDINGS

Prior to this implementation, profile updates in CareSetu allowed direct mutation of user email and mobile phone numbers without verification via general settings endpoints. This posed significant security risks including account hijacking, typo-induced lockouts, and unauthorized credential changes.

---

## 2. FILES MODIFIED & CREATED

### Backend Architecture
- `backend/prisma/schema.prisma`: Added `CredentialType` (`EMAIL`, `MOBILE`), `PendingChangeStatus` (`PENDING`, `VERIFIED`, `CONSUMED`, `CANCELLED`, `EXPIRED`), `PendingCredentialChange` model, and relation to `User`.
- `backend/src/services/credential-update.service.js` (NEW): Core service encapsulating request generation, bcrypt hashing, Brevo/TextBee delivery, attempt tracking, rate limiting, and atomic database commits.
- `backend/src/services/settings.service.js`: Removed direct `email` and `phone` mutations from standard `updateProfile` to enforce mandatory OTP workflow.
- `backend/src/controllers/settings.controller.js`: Added `requestCredentialChange`, `verifyCredentialOtp`, and `cancelCredentialChange` endpoint handlers.
- `backend/src/routes/settings.routes.js`: Registered POST routes `/api/settings/credentials/request-change`, `/verify-otp`, `/cancel-change`.
- `backend/scratch/test_otp_credential_update.js` (NEW): 22-scenario automated verification test suite.

### Frontend Integration
- `frontend/src/services/api.ts`: Added `requestCredentialChange`, `verifyCredentialOtp`, and `cancelCredentialChange` methods to `settingsApi`.
- `frontend/src/components/common/CredentialUpdateModal.tsx` (NEW): Two-step secure UI modal with current password authorization, OTP input, countdown timers, resend cooldown, masked targets, and error handling.
- `frontend/src/pages/patient/PatientMiscPages.tsx`: Updated `PatientSettingsPage` with OTP credential update triggers.
- `frontend/src/pages/hospital/HospitalMiscPages.tsx`: Updated `HospitalSettingsPage` with OTP credential update triggers.
- `frontend/src/pages/admin/AdminMiscPages.tsx`: Updated `AdminSettingsPage` with OTP credential update triggers.

---

## 3. DATABASE SCHEMA & DATA MODEL

### `PendingCredentialChange` Model
```prisma
model PendingCredentialChange {
  id           String              @id @default(uuid())
  userId       String
  user         User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  type         CredentialType
  newValue     String
  otpHash      String              // Encrypted bcrypt hash cost 10
  expiresAt    DateTime
  attemptCount Int                 @default(0)
  maxAttempts  Int                 @default(5)
  status       PendingChangeStatus @default(PENDING)
  consumedAt   DateTime?
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@index([userId])
  @@index([status])
  @@index([type])
}
```

---

## 4. OTP GENERATION & STORAGE APPROACH

1. **Generation:** Cryptographically secure 6-digit random string (`crypto.randomInt(100000, 1000000)`).
2. **Storage:** Standard `bcrypt.hash(otp, 10)`. Plaintext OTP is NEVER stored in database, browser storage, or production logs.
3. **Expiry:** Valid for exactly 5 minutes (`Date.now() + 300,000ms`).
4. **Attempt Limits:** Maximum 5 verification attempts before automatic invalidation.
5. **Single-Use:** Status transitions atomically from `PENDING` -> `CONSUMED` upon first successful verification.

---

## 5. EMAIL / MOBILE UPDATE WORKFLOW

```
[ User Requests Change ] 
       │ (Submits new email/phone + current password)
       ▼
[ Authenticate & Validate ]
       │ ➔ Verify current password via bcrypt.compare
       │ ➔ Check duplicate ownership (User/Patient/Hospital tables)
       │ ➔ Check 60-second rate-limit cooldown
       │ ➔ Cancel any previous active PENDING change records
       ▼
[ Generate & Hash OTP ]
       │ ➔ Save PendingCredentialChange (status: PENDING, original user email/phone UNCHANGED)
       │ ➔ Send OTP to NEW email/phone via Brevo SMTP / TextBee SMS
       ▼
[ User Inputs OTP ]
       │ ➔ Check expiry & attempt limit (< 5)
       │ ➔ Compare OTP hash via bcrypt.compare
       ▼
[ Atomic DB Commit ]
       │ ➔ Execute Prisma $transaction
       │ ➔ Atomically transition PendingCredentialChange status: PENDING -> CONSUMED
       │ ➔ Re-check uniqueness constraints inside transaction
       │ ➔ Update User.email (or Patient.phone / Hospital.phone & Hospital.email)
       │ ➔ Log AuditLog SECURITY_EVENT & PROFILE_UPDATED
       ▼
[ Database Commit Complete ]
       │ ➔ Return HTTP 200 Success to Client
       │ ➔ Refresh User state on UI
```

---

## 6. ATOMICITY & CONCURRENCY CONTROLS

1. **Database Atomicity:** All database updates (credential mutation, OTP status transition, and audit logging) occur within a single `prisma.$transaction`.
2. **Race Condition Prevention:** Concurrency protection uses an atomic `UPDATE pending_credential_changes SET status = 'CONSUMED' WHERE id = :id AND status = 'PENDING'`. Under simultaneous verification attempts, exactly 1 request acquires the row lock and updates status; secondary requests update 0 rows and are safely rejected with `HTTP 400`.
3. **Uniqueness Protection:** Database unique constraints on `User.email`, `Patient.userId`, and `Hospital.userId` provide backstop protection against duplicate ownership claims.

---

## 7. AUTOMATED TEST RESULTS

Executed `node scratch/test_otp_credential_update.js`:

| # | Test Scenario | Expected Outcome | Result |
|---|---|---|---|
| 1 | Valid email change request | Sends OTP & creates pending record | **PASS** |
| 2 | Valid mobile change request | Sends OTP & creates pending record | **PASS** |
| 3 | Pre-verification email state | DB email remains original value | **PASS** |
| 4 | Pre-verification mobile state | DB phone remains original value | **PASS** |
| 5 | Correct OTP email commit | DB email updated atomically | **PASS** |
| 6 | Correct OTP mobile commit | DB phone updated atomically | **PASS** |
| 7 | Incorrect OTP rejection | Verification rejected, DB unchanged | **PASS** |
| 8 | Expired OTP rejection | Verification rejected, DB unchanged | **PASS** |
| 9 | Reused OTP rejection | Second verification rejected | **PASS** |
| 10 | Max attempt limit (5) | Blocked after 5 failed attempts | **PASS** |
| 11 | OTP resend invalidation | Previous OTP request marked CANCELLED | **PASS** |
| 12 | Duplicate email ownership | Returns 409 Conflict | **PASS** |
| 13 | Duplicate mobile ownership | Returns 409 Conflict | **PASS** |
| 14 | Cross-account IDOR attempt | Blocked when user B verifies user A request | **PASS** |
| 15 | Concurrent verification race | Exactly 1 request commits; race prevented | **PASS** |
| 16 | Transaction failure handling | Error handled safely; no false success | **PASS** |
| 17 | Rate limiting enforcement | 60s cooldown enforced between requests | **PASS** |
| 18 | OTP security in DB | OTP stored strictly as bcrypt hash | **PASS** |
| 19 | Privilege escalation check | Injection parameters ignored; role unchanged | **PASS** |
| 20 | Frontend response contracts | Returns masked target, expiry, request ID | **PASS** |
| 21 | Auth continuity | User login succeeds post-credential change | **PASS** |
| 22 | Failure state consistency | Original credentials preserved on error | **PASS** |

**Total:** **22 PASSED, 0 FAILED**

---

## 8. REQUIREMENT COMPLIANCE MATRIX

| Requirement Category | Compliance Status | Evidence / Notes |
|---|---|---|
| No DB Update Before OTP | **GREEN** | Verified in Tests 3 & 4. Original values remain untouched until Step 3 transaction. |
| Secure OTP Storage | **GREEN** | OTP hashed using `bcrypt` (cost 10). Plaintext never stored or logged. |
| Mandatory Password Step | **GREEN** | Current account password required on all `request-change` requests. |
| Rate Limiting & Expiry | **GREEN** | 5-minute expiry and 60-second request cooldown enforced. |
| Attempt Limiting | **GREEN** | Max 5 attempts enforced before status transitions to EXPIRED. |
| Multi-Portal UI Support | **GREEN** | Integrated into Patient, Hospital, and Admin settings pages. |
| Frontend TypeScript Build | **GREEN** | `npm run build` executed successfully without errors (`dist/assets/index-C1AaNmKn.js`). |
| Automated Test Suite | **GREEN** | `scratch/test_otp_credential_update.js` passed 22/22 tests cleanly. |

---

## 9. CONCLUSION

The secure OTP-based account credential update feature is **FULLY IMPLEMENTED, AUDITED, AND VERIFIED** across all portals in CareSetu. All 22 business rules, security mandates, and database atomicity constraints have been verified with concrete test evidence.
