# CareSetu — Google Login Account Existence Check, Role Binding & Role-Based Access Control

This document details the architectural design, security policies, implementation details, test suite verification, and browser evidence for CareSetu's Google Authentication and Role-Based Access Control (RBAC) system.

---

## 1. Overview & Core Security Principles

Google OAuth in CareSetu is strictly an **authentication method**, not a **role assignment or auto-account creation mechanism**.

1. **Unregistered Google User Protection**:
   - Google authentication alone does **NOT** create a CareSetu account during login.
   - If an email verified by Google does not have an existing registered account in CareSetu's backend database, login is rejected immediately with HTTP 404 `ACCOUNT_NOT_REGISTERED`.
   - The user is presented with a clear "Account Not Registered" modal instructing them to register first via the CareSetu registration flow.

2. **Role Immutability**:
   - The user role (`PATIENT`, `DOCTOR`, `HOSPITAL`, `ADMIN`) stored in CareSetu's PostgreSQL backend database is authoritative and immutable during login.
   - Any frontend-supplied parameters requesting a role change (e.g. `role=ADMIN`) are sanitized or ignored.
   - Users cannot change their role or enter unauthorized dashboards by modifying client-side state, local storage, or URL parameters.

3. **Backend-Driven Identity & Token Verification**:
   - All Google / Firebase ID tokens are verified server-side using the Firebase Admin SDK or Google OAuth2 library.
   - Signature, audience (`aud`), issuer (`iss`), expiration (`exp`), and verified email claims (`email_verified`) are strictly validated before matching any database records.

---

## 2. Authentication Flows

### A. Unregistered Google User Flow (Login Page)

```
User clicks "Continue with Google" on Login Page
       │
       ▼
Firebase Client SDK / Google OAuth Popup
       │
       ▼
ID Token sent to Backend POST /api/auth/google
       │
       ▼
Backend verifies Token Claims & Signature (Firebase Admin SDK)
       │
       ▼
Backend searches DB for existing User by verified Email
       │
       ├──► Account NOT Found
       │       │
       │       ▼
       │    Return HTTP 404 { code: "ACCOUNT_NOT_REGISTERED" }
       │       │
       │       ▼
       │    Frontend displays "Account Not Registered" Modal
       │       │
       │       ├──► Click "Register Now" ──► Redirect to /role-selection
       │       └──► Click "Back to Login" ──► Close Modal
```

### B. Existing Registered Google User Flow

```
User clicks "Continue with Google" on Login Page
       │
       ▼
ID Token sent to Backend POST /api/auth/google
       │
       ▼
Backend verifies Token Claims & Signature
       │
       ▼
Backend finds existing User Record & reads Authoritative Role
       │
       ├──► Check Account Status (If BLOCKED ──► Return HTTP 403 ACCOUNT_DISABLED)
       │
       ▼
Issue Secure JWT Session (7-day expiry)
       │
       ▼
Redirect to Role-Based Dashboard:
  • PATIENT  ──► /patient/dashboard
  • DOCTOR   ──► /doctor/dashboard (if verified/approved)
  • HOSPITAL ──► /hospital/dashboard (if verified/approved)
  • ADMIN    ──► /admin/dashboard
```

---

## 3. Role & Access Control Matrix

| Role | Self-Registration Allowed | Google Login Behavior | Approval/Verification Requirement |
|---|---|---|---|
| **PATIENT** | Yes | Logs in to Patient Dashboard using database role | Standard email/phone verification |
| **DOCTOR** | Yes | Logs in to Doctor Dashboard using database role | Requires document upload & verification |
| **HOSPITAL** | Yes | Logs in to Hospital Dashboard using database role | Requires license document & admin approval |
| **ADMIN** | **NO** (Backend Provisioned Only) | Authoritative database role required; frontend `role=ADMIN` requests strictly rejected | Administrative grant only |

---

## 4. API Response & Error Codes

The backend returns standardized, sanitized error payloads:

| HTTP Status | Error Code | Trigger Condition | User-Facing Message |
|---|---|---|---|
| **404 Not Found** | `ACCOUNT_NOT_REGISTERED` | Google login attempted with an unlinked/unregistered Google email | *"Your CareSetu account does not exist. Please register first."* |
| **403 Forbidden** | `ACCOUNT_DISABLED` | Google login attempted on a suspended or blocked account | *"Account is suspended. Please contact CareSetu support."* |
| **401 Unauthorized** | `AUTHENTICATION_FAILED` | Expired, invalid, or forged Google ID Token | *"Google ID token signature or format is invalid."* |
| **400 Bad Request** | `INVALID_INPUT` | Missing ID token or unverified Google email claim | *"Google account email is not verified."* |

---

## 5. Security Test Suite Evidence

The test suite (`backend/tests/google.oauth.security.test.js`) verifies all edge cases:

```
==================================================
CARESETU GOOGLE OAUTH SECURITY TEST SUITE
==================================================
[PASS] Empty Google ID token returns HTTP 400 Bad Request
[PASS] Empty token is rejected
[PASS] Expired Google ID token returns HTTP 401 Unauthorized
[PASS] Error message states token expired
[PASS] Expired Google ID token is rejected
[PASS] Wrong audience token returns HTTP 401 Unauthorized
[PASS] Error message states audience mismatch
[PASS] Token with wrong audience is rejected
[PASS] Wrong issuer token returns HTTP 401 Unauthorized
[PASS] Error message states issuer mismatch
[PASS] Token with untrusted issuer is rejected
[PASS] Unregistered Google login attempt returns HTTP 404 Not Found
[PASS] Returns code ACCOUNT_NOT_REGISTERED
[PASS] Error message instructs user to register first
[PASS] Unregistered Google login attempt is safely rejected
[PASS] Untrusted ADMIN role escalation request is sanitized to PATIENT
[PASS] Role escalation to ADMIN is strictly FORBIDDEN
[PASS] Existing user login returns isNewUser=false
[PASS] Finds exact registered user account
[PASS] Authoritative database role DOCTOR is preserved and immutable
[PASS] Suspended/Blocked account returns HTTP 403 Forbidden
[PASS] Error message states account is suspended
[PASS] Blocked account Google OAuth login is rejected
--------------------------------------------------
SUMMARY: 23 Passed, 0 Failed
==================================================
```

---

## 6. Frontend UI Specifications

### Button Placement & Visual Order

The Login page layout enforces the exact specified component hierarchy:

1. **Email & Password Input Fields**
2. **Primary `[ Log in ]` Button**
3. **Horizontal OR Divider (`──────── OR ────────`)**
4. **Google Login Button (`[ Google G   Continue with Google ]`)**

---

## 7. Operational & Technical Summary

- **Files Modified**:
  - `backend/src/services/google-auth.service.js`: Added existence checks, account registration separation, and role immutability.
  - `backend/src/controllers/auth.controller.js`: Handled `ACCOUNT_NOT_REGISTERED` (404) and `ACCOUNT_DISABLED` (403).
  - `frontend/src/services/api.ts`: Preserved error status and error code payloads on `ApiError`.
  - `frontend/src/components/common/GoogleAuthButton.tsx`: Added `isRegistration` prop, `ACCOUNT_NOT_REGISTERED` modal prompt, and safe navigation to `/role-selection`.
  - `backend/tests/google.oauth.security.test.js`: Comprehensive 23-test security verification suite.
- **Verification Result**: `npx tsc --noEmit` passed cleanly; `node tests/google.oauth.security.test.js` passed all 23 tests with 0 failures.
