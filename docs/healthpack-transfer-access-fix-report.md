# CARESETU — HEALTHPACK TRANSFER ACCESS & AES-256-CBC ENCRYPTION AUDIT & FIX REPORT

---

## EXECUTIVE SUMMARY

An end-to-end technical audit and remediation were conducted on the CareSetu backend for emergency case acceptance and encrypted HealthPack transfer access (`GET /api/healthpack/:caseId`). 

Prior to this fix, when a hospital accepted an emergency case, permission grants were not written inside a Prisma transaction, `HealthPackShare` permissions were not updated during case acceptance, route bindings for `GET /api/healthpack/:caseId` were missing, and cipher algorithm/encoding mismatches existed.

All 12 required scenarios—including transaction safety, permission inheritance, dual route bindings, AES-256-CBC hex encoding, RBAC enforcement, expiration checks, corrupted ciphertext handling, and database persistence—have been fixed and verified with automated integration tests.

---

## ROOT CAUSE ANALYSIS

1. **Missing HealthPack Permission Grant on Case Acceptance**:
   `acceptCase` in `hospital.controller.js` previously only updated `EmergencyCase.status` to `ACCEPTED` and assigned `hospitalId`. It failed to create or activate a `HealthPackShare` record mapping the patient's `HealthPack` to the accepting hospital.

2. **Missing Route Binding**:
   `health-pack.routes.js` bound `GET /api/healthpack/case/:caseId` but lacked a direct binding for `GET /api/healthpack/:caseId`. Calling `GET /api/healthpack/:caseId` resulted in route mismatches or unhandled access errors.

3. **Transaction Isolation Absence**:
   Case status updates were executed outside a Prisma transaction (`$transaction`). If downstream permission assignment failed, the case remained marked as `ACCEPTED` without giving the hospital access to the patient's HealthPack.

4. **Encryption Algorithm & Encoding Mismatch**:
   `crypto.js` was previously using `aes-256-gcm` with colon-delimited tags, whereas CareSetu architecture requirements strictly mandate `aes-256-cbc` with `hex` string encodings for both `encrypted_data` and `iv`.

---

## FILES CHANGED

| File Path | Summary of Modifications |
| :--- | :--- |
| `backend/src/utils/crypto.js` | Updated encryption engine to **AES-256-CBC** with 32-byte key buffer, 16-byte IV buffer, and strict **hex** encoding for `encryptedData` and `iv`. Preserved legacy GCM fallback for backward compatibility. |
| `backend/src/controllers/hospital.controller.js` | Refactored `acceptCase` to execute inside `prisma.$transaction`. Ensures atomic case claiming, `HealthPack` auto-generation, and `HealthPackShare` permission assignment. Overwriting/deleting existing shares and creating duplicate shares are prevented. Rollback occurs if permission assignment fails. |
| `backend/src/services/health-pack.service.js` | Updated `getDecryptedHealthPackForCase` to normalize `shared_with` as string UUIDs, check hospital assignment and `shared_with` membership, enforce expiry and revocation rules, log non-sensitive diagnostics, and return sanitized decrypted HealthPacks without exposing keys or ciphertexts. |
| `backend/src/controllers/health-pack.controller.js` | Updated `getCaseHealthPack` controller to pass `req.user.role` to service diagnostics and handle `req.user.id`/`req.user.userId` safely. |
| `backend/src/routes/health-pack.routes.js` | Registered direct route `GET /:caseId` alongside `GET /case/:caseId` for hospital users. |
| `backend/src/routes/hospital.routes.js` | Registered route alias `POST /cases/:caseId/accept` alongside `POST /:caseId/accept`. |
| `backend/scratch/test_healthpack_transfer_access_fix.js` | Built a 12-scenario automated integration test suite verifying case acceptance, duplicate prevention, RBAC, 403/404 handling, key/IV error handling, concurrent acceptance, transaction rollback, and database persistence. |
| `docs/healthpack-transfer-access-fix-report.md` | Comprehensive final audit report. |

---

## PRISMA SCHEMA ASSUMPTIONS & MAPPINGS

The implementation aligns with `backend/prisma/schema.prisma`:

- **EmergencyCase**: `model EmergencyCase`
  - `id`: UUID (Primary Key)
  - `caseId`: Public human-readable case ID (`CASE-YYYYMMDD-XXXX`)
  - `patientId`: Foreign key to `Patient.id`
  - `hospitalId`: Assigned `Hospital.id`
  - `status`: Enum `CaseStatus` (`PENDING`, `MATCHING`, `HOSPITAL_REQUESTED`, `ACCEPTED`, `CLOSED`, etc.)
- **Hospital**: `model Hospital`
  - `id`: UUID (Primary Key)
  - `userId`: Foreign key to `User.id`
- **Patient**: `model Patient`
  - `id`: UUID (Primary Key)
  - `userId`: Foreign key to `User.id`
- **HealthPack**: `model HealthPack`
  - `id`: UUID (Primary Key)
  - `patientId`: Foreign key to `Patient.id`
  - `encryptedData`: AES-256-CBC hex-encoded ciphertext
  - `iv`: 16-byte AES-256-CBC hex-encoded IV
  - `status`: Enum `HealthPackStatus` (`ACTIVE`, `ARCHIVED`, `EXPIRED`)
  - `expiresAt`: DateTime
- **HealthPackShare (`shared_with`)**: `model HealthPackShare`
  - `id`: UUID (Primary Key)
  - `healthPackId`: Foreign key to `HealthPack.id`
  - `sharedWithHospitalId`: String UUID of hospital receiving access
  - `sharedWithUserId`: String UUID of hospital user
  - `status`: Enum `HealthPackShareStatus` (`ACTIVE`, `REVOKED`, `EXPIRED`)
  - `expiresAt`: DateTime

---

## DATABASE PERSISTENCE EVIDENCE

Direct Prisma query verification during test execution:

```json
{
  "emergencyCase": {
    "id": "75155072-dc70-4b06-a636-4eeece23c55d",
    "caseId": "CASE-AUDIT-1790176966094-1",
    "status": "ACCEPTED",
    "hospitalId": "d0e5a0dc-7b5a-40ce-999d-53f3db66b1d9"
  },
  "healthPack": {
    "id": "45c7d547-eec6-4873-a80e-49794368e29c",
    "patientId": "6cddab91-ba54-4ba1-9801-ce82db5c5777",
    "status": "ACTIVE",
    "encryptedData": "4b971a82f3c0...",
    "iv": "3a70f90114b3d819920194bc028148e1"
  },
  "healthPackShare": {
    "id": "9a12c8b0-4411-477c-88bf-71ff02a901bb",
    "healthPackId": "45c7d547-eec6-4873-a80e-49794368e29c",
    "sharedWithHospitalId": "d0e5a0dc-7b5a-40ce-999d-53f3db66b1d9",
    "status": "ACTIVE"
  }
}
```

---

## AUTHORIZATION EVIDENCE

Safe diagnostic log output captured during API execution:

```text
[HealthPack Diagnostic Log] {
  caseId: 'CASE-AUDIT-1790176966094-1',
  hospitalId: 'd0e5a0dc-7b5a-40ce-999d-53f3db66b1d9',
  hospitalRole: 'HOSPITAL',
  healthPackId: '45c7d547-eec6-4873-a80e-49794368e29c',
  sharedWithMembershipResult: 'AUTHORIZED'
}
```

- **Authorized Hospital**: Returns HTTP `200 OK` with decrypted `healthData`.
- **Unassigned / Non-Shared Hospital**: Returns HTTP `403 Forbidden` (`Unauthorized: Hospital is not assigned or requested for this emergency case`).
- **Non-Hospital Role (Patient/Doctor)**: Returns HTTP `403 Forbidden` (`Permission denied in requireRole`).
- **Expired HealthPack**: Returns HTTP `403 Forbidden` (`Unauthorized access: HealthPack has expired.`).

---

## ENCRYPTION & DECRYPTION EVIDENCE

- **Algorithm**: `AES-256-CBC`
- **Key Length**: 32 bytes (256 bits) derived via `getSecretKeyBuffer` from `HEALTH_PACK_KEY` or `HEALTH_PACK_SECRET_KEY`.
- **IV Length**: 16 bytes (128 bits) generated via `crypto.randomBytes(16)`.
- **Ciphertext Encoding**: Hexadecimal (`hex`).
- **IV Encoding**: Hexadecimal (`hex`).
- **Data Redaction**: `encryptedData`, `iv`, and encryption keys are strictly omitted from `GET /api/healthpack/:caseId` JSON responses. Diagnostic logs omit keys, tokens, and plaintext medical contents.

---

## AUTOMATED TEST RESULTS

Test command executed: `node backend/scratch/test_healthpack_transfer_access_fix.js`

```text
================================================================
 CARESETU - HEALTHPACK TRANSFER ACCESS & ENCRYPTION AUDIT TEST 
================================================================

--- TEST 1: HOSPITAL CASE ACCEPTANCE & HEALTHPACK SHARE CREATION ---
POST /api/hospitals/75155072-dc70-4b06-a636-4eeece23c55d/accept 200 79.464 ms - 61
✅ PASS: Hospital 1 accepted emergency case successfully
✅ PASS: EmergencyCase status is ACCEPTED in PostgreSQL
✅ PASS: EmergencyCase.hospitalId matches Hospital 1 UUID in PostgreSQL
✅ PASS: Active HealthPack exists for patient in PostgreSQL
✅ PASS: HealthPackShare created for Hospital 1 UUID in PostgreSQL

--- TEST 2: PREVENT DUPLICATE SHARES ---
POST /api/hospitals/75155072-dc70-4b06-a636-4eeece23c55d/accept 409 8.040 ms - 55
✅ PASS: Re-accept request blocked or handled gracefully (409 Conflict)
✅ PASS: Duplicate HealthPackShare record was NOT created

--- TEST 3: AUTHORIZED HOSPITAL GET /api/healthpack/:caseId ---
GET /api/healthpack/75155072-dc70-4b06-a636-4eeece23c55d 200 29.844 ms - 447
✅ PASS: Authorized Hospital 1 retrieved HealthPack
✅ PASS: Decrypted healthData is returned
✅ PASS: encryptedData is NOT exposed in response payload
✅ PASS: iv is NOT exposed in response payload
✅ PASS: Encryption key is NOT exposed in response payload
GET /api/healthpack/case/CASE-AUDIT-1790176966094-1 200 11.878 ms - 447
✅ PASS: Authorized Hospital 1 retrieved HealthPack via /case/:caseId alias

--- TEST 4: UNAUTHORIZED HOSPITAL RECEIVES 403 ---
GET /api/healthpack/75155072-dc70-4b06-a636-4eeece23c55d 403 7.610 ms - 104
✅ PASS: Unauthorized Hospital 2 received HTTP 403

--- TEST 5: NON-HOSPITAL USER RECEIVES 403 ---
GET /api/healthpack/75155072-dc70-4b06-a636-4eeece23c55d 403 2.186 ms - 56
✅ PASS: Patient role received HTTP 403

--- TEST 6: MISSING CASE / HEALTHPACK RETURNS 404 ---
GET /api/healthpack/NON_EXISTENT_CASE_UUID_9999 404 3.800 ms - 53
✅ PASS: Missing case returned HTTP 404

--- TEST 7: EXPIRED HEALTHPACK RETURNS 403 ---
GET /api/healthpack/c41246d7-cbba-4be4-81c9-285a80bb380f 403 6.022 ms - 72
✅ PASS: Expired HealthPack returned HTTP 403

--- TEST 8: INVALID ENCRYPTION KEY HANDLED SAFELY ---
✅ PASS: Invalid key error caught safely without leaking data

--- TEST 9: INVALID IV HANDLED SAFELY ---
✅ PASS: Invalid IV error caught safely

--- TEST 10: CORRUPTED CIPHERTEXT HANDLED SAFELY ---
✅ PASS: Corrupted ciphertext handled safely without process crash

--- TEST 11: CONCURRENT ACCEPTANCE CONFLICT PREVENTION ---
POST /api/hospitals/55323834-d3e4-4204-9440-ac0183cf81bf/accept 200 13.969 ms - 61
POST /api/hospitals/55323834-d3e4-4204-9440-ac0183cf81bf/accept 409 236.133 ms - 55
✅ PASS: Exactly ONE hospital successfully accepted the concurrent case
✅ PASS: The competing hospital received HTTP 409 Conflict
✅ PASS: Concurrent case status is ACCEPTED
✅ PASS: Concurrent case assigned to single winning hospital

--- TEST 12: TRANSACTION ROLLBACK SAFETY ---
✅ PASS: Simulated transaction error caught
✅ PASS: EmergencyCase status remained PENDING after transaction rollback
✅ PASS: EmergencyCase hospitalId remained null after transaction rollback

================================================================
 🟢 ALL 12 AUDIT TEST SCENARIOS PASSED SUCCESSFULLY (GREEN)
================================================================
```

---

## REMAINING LIMITATIONS & SYSTEM BOUNDARIES

1. **Third-Party External Services**: Live SMS (TextBee) and email OTP (Brevo) providers require valid API credentials and IP whitelisting when running live external integration tests.
2. **KMS Secret Key Management**: Encryption key loading uses `HEALTH_PACK_KEY` / `HEALTH_PACK_SECRET_KEY` from environment variables. Automated key rotation policies should be managed through cloud KMS services (e.g. AWS KMS / GCP Secret Manager).

---

## FINAL SYSTEM STATUS

### **STATUS: GREEN 🟢**
The HealthPack transfer access fix and AES-256-CBC encryption engine have been completely audited, implemented, tested, and verified.
