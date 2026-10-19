# CareSetu Phase 12B.10A — Legal Pages, Data Declaration, and User Consent Verification Report

**Date**: October 18, 2026  
**Environment**: Local Staging Readiness Pre-flight (`http://localhost:5173` / `http://localhost:3000`)  
**Scope**: Terms of Use, Privacy Policy, Data Declaration, Registration Consent Architecture, Audit Event Recording, and Non-disruptive Backward Compatibility.

---

## 1. Executive Summary
Phase 12B.10A has completed implementation and end-to-end verification of all three user-facing legal and compliance requirements:
1. **Terms of Use** (`/terms`)
2. **Privacy Policy** (`/privacy`)
3. **Data Declaration & Processing Matrix** (`/data-declaration`)

All three documents reflect CareSetu's authentic operational and architectural reality (including DPDP Act 2023 alignment, 20-second hospital matching candidates, non-replacement of statutory emergency services 108/112, AES-256-CBC envelope encryption for HealthPack files, and transactional SMS/Email relays). Explicit Terms acceptance is now enforced on both client and server at registration, recorded in the audit trail without destructive schema migrations, and backward-compatible with all existing users and sessions.

---

## 2. Files Changed & Routes Added

### A. New Public Pages & Components
- [`frontend/src/pages/legal/TermsOfUsePage.tsx`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/legal/TermsOfUsePage.tsx): Accessible, responsive Terms of Use covering platform scope, emergency dispatch disclaimer, OTP authentication, doctor role boundaries, and account termination.
- [`frontend/src/pages/legal/PrivacyPolicyPage.tsx`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/legal/PrivacyPolicyPage.tsx): Comprehensive privacy policy detailing SPHI handling, emergency GPS capture boundaries, sub-processors (TextBee, Brevo, FCM, Cloudflare R2), and DPO contact.
- [`frontend/src/pages/legal/DataDeclarationPage.tsx`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/legal/DataDeclarationPage.tsx): Data taxonomy matrix, cryptographic envelope specification, sub-processor disclosure, retention schedules, and erasure procedures.

### B. Router & Public Navigation
- [`frontend/src/App.tsx`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/App.tsx): Added routes under `PublicLayout`:
  - `/terms` &rarr; `<TermsOfUsePage />`
  - `/privacy` &rarr; `<PrivacyPolicyPage />`
  - `/data-declaration` &rarr; `<DataDeclarationPage />`
- [`frontend/src/components/layout/PublicFooter.tsx`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/components/layout/PublicFooter.tsx): Added a dedicated "Legal & Privacy" column and bottom bar links navigating to `/terms`, `/privacy`, and `/data-declaration`.

### C. Frontend Registration & Consent Control
- [`frontend/src/pages/auth/AuthFlowPages.tsx`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/auth/AuthFlowPages.tsx):
  - Added `termsAccepted` state (initialized to `false`, unchecked).
  - Rendered accessible checkbox with clickable links to `/terms`, `/privacy`, and `/data-declaration`.
  - Added pre-submit validation rejecting registration if `termsAccepted` is unchecked.
  - Included `termsAccepted: true` and `policyVersion: "2026.1"` in registration API payload.
- [`frontend/src/services/api.ts`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/services/api.ts):
  - Updated `SignUpPayload` interface with `termsAccepted?: boolean` and `policyVersion?: string`.

### D. Backend Enforcement & Audit Recording
- [`backend/src/controllers/auth.controller.js`](file:///D:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/auth.controller.js):
  - Updated `signupSchema` to validate `termsAccepted` (rejects with HTTP 400 when missing/false).
  - In `register` transaction, created an `AuditLog` entry with `action: 'CONSENT_GRANTED'`, `details: { type: 'TERMS_AND_PRIVACY', policyVersion: '2026.1', acceptedAt: ... }`.

---

## 3. Consent Behavior & Data Integrity

1. **Explicit, Unbundled Consent**:
   - The checkbox is unchecked by default. Registration fails both client-side and server-side if not explicitly checked.
   - Terms acceptance does **not** grant blanket health data sharing; purpose-specific HealthPack consent and Emergency SOS dispatch consent retain their granular toggles and revocation mechanisms.
2. **Zero Schema Migration Impact**:
   - Utilized existing Prisma `AuditLog` table with action `CONSENT_GRANTED`.
   - Avoided modifying existing `ConsentType` enum or generating risky database migrations.
3. **Existing Users & Backward Compatibility**:
   - Existing accounts, active sessions, and logins are completely unaffected. Existing users can log in without session invalidation or forced consent blocking.
   - All role-based routing (Hospital, Doctor, Patient, Admin) remains fully functional.

---

## 4. Test Results & Verification

| Test Scenario | Method / Tool | Expected Result | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Production Build** | `tsc -b && vite build` | Zero type errors, bundle completes | Built in 21.10s (dist output verified) | **PASSED** |
| **Server Rejection on Missing Consent** | `POST /api/auth/register` with `termsAccepted: false` | HTTP 400 with validation message | HTTP 400: *"You must accept the Terms of Use, Privacy Policy, and Data Declaration to register."* | **PASSED** |
| **Server Acceptance with Consent** | `POST /api/auth/register` with `termsAccepted: true` | HTTP 201 Created | HTTP 201: Account created with PATIENT role and token | **PASSED** |
| **Consent Audit Trail** | DB Query on `AuditLog` | Entry with `action: 'CONSENT_GRANTED'` | Record found with policyVersion `2026.1` | **PASSED** |
| **Immediate Login for New User** | `POST /api/auth/login` | HTTP 200 with JWT | HTTP 200: Successful authentication | **PASSED** |
| **Existing Account Non-interference** | `POST /api/auth/login` (`test.hospital@caresetu.local`) | HTTP 200 | HTTP 200: Role HOSPITAL authenticated | **PASSED** |

---

## 5. Unresolved Legal-Review Items
All three documents are explicitly marked with the badge:
`Draft v2026.1 • Under Legal Review`

The following items should be reviewed by legal/compliance counsel before public commercial deployment:
1. **Statutory Grievance Officer Designation**: Formal appointment name and physical address for the DPDP Act Grievance Officer (currently designated as `grievance@caresetu.in`).
2. **Entity Corporate Identity**: Insertion of full registered corporate entity name, CIN, and registered address once incorporated.
3. **Jurisdiction / Dispute Venue**: Standard arbitration clause currently references courts in New Delhi / State High Court; counsel should confirm preferred governing jurisdiction.

---

## 6. Deployment Gate Decision

- **Gate Status**: **APPROVED FOR PHASE 12B.11 STAGING DEPLOYMENT**
- **Rationale**:
  - All three legal requirements are active, responsive, and wired to the router and public footer.
  - End-to-end registration validation and consent auditing are proven and tested.
  - Production build compiles cleanly with zero TypeScript errors.
  - No database migration risks, session breaks, or regressions for existing users.
