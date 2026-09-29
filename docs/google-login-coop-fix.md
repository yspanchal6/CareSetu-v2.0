# CareSetu Google Sign-In & COOP Error Resolution Report

**Date:** September 28, 2026  
**System:** CareSetu Authentication & Security Headers Subsystem  
**Status Summary:** Code fix applied and backend Google OAuth regression suite passed. Browser popup and Google Console verification require a running deployment and are not claimed here.

---

## 1. Root Cause Analysis

Modern browsers enforce strict Cross-Origin Opener Policy (`Cross-Origin-Opener-Policy`). When an application serves HTML responses with `Cross-Origin-Opener-Policy: same-origin`, the browser isolates any top-level popups opened by the window. 

During Google Sign-In via Firebase Auth (`signInWithPopup`), Firebase opens a Google OAuth popup window (`accounts.google.com` / `caresetu-37de6.firebaseapp.com`). Because `same-origin` was previously configured globally in Helmet security middleware, the browser severed the opener context (`window.opener`), logging the error:

```text
Cross-Origin-Opener-Policy policy would block the window.closed call.
```

---

## 2. Existing Google Auth Architecture

The CareSetu Google Sign-In workflow is structured as follows:

```
[ User Clicks "Continue with Google" ]
               │
               ▼
[ GoogleAuthButton.tsx ] ──> signInWithPopup(auth, googleProvider)
               │
               ▼
[ Google OAuth Popup / Account Chooser ]
               │
               ▼
[ ID Token Returned to Client ]
               │
               ▼
[ POST /api/auth/google ]
               │
               ▼
[ backend/src/controllers/auth.controller.js ]
               │
               ▼
[ backend/src/services/google-auth.service.js ]
  └── Verify Token via Firebase Admin SDK / Google OAuth2 Client
  └── Match or Create User in PostgreSQL via Prisma Transaction
  └── Issue CareSetu JWT Token
               │
               ▼
[ Client Saves Session & Navigates to User Role Dashboard ]
```

---

## 3. COOP Problem and Fix

The popup-compatible policy is `same-origin-allow-popups`. The backend Helmet middleware and Vite development/preview servers now use that value. The frontend does not implement `window.open`, `window.closed` polling, or custom `postMessage` handling; Firebase owns the popup lifecycle through `signInWithPopup`.

## 4. Exact Files and Security Changes

- `frontend/src/components/common/GoogleAuthButton.tsx`: removed the synthetic-token fallback; Firebase cancellation, popup blocking, configuration, network, and unknown failures now stop locally with safe messages. Backend 401/403 responses remain mapped to safe user-facing messages.
- `frontend/vite.config.ts`: sends `Cross-Origin-Opener-Policy: same-origin-allow-popups` from both dev and preview servers.
- `backend/src/middleware/security-headers.middleware.js`: Helmet uses `same-origin-allow-popups`, keeps COEP disabled for popup compatibility, and retains the existing security headers/CSP allowlist.
- `backend/src/app.js`: CORS now accepts configured origins from `FRONTEND_URL`/`CORS_ORIGINS` plus the existing approved Cloudflare tunnel suffix; arbitrary origins are rejected.

---

## 5. Security Controls Preserved

- **Backend Verification**: ID tokens are verified server-side using Firebase Admin SDK or `google-auth-library` (`OAuth2Client`).
- **Role Sanitization**: Untrusted role escalation attempts (e.g. requesting `ADMIN` during registration) are automatically sanitized to `PATIENT`.
- **CORS Credentials**: `Access-Control-Allow-Origin: *` is not used. Allowed origins are restricted to configured frontend URLs and the existing approved tunnel pattern.
- **Account Disabling**: Suspended users (`status = 'BLOCKED'`) are rejected with HTTP 403.
- **Account Linking**: Login attempts for non-existent accounts return HTTP 404 (`ACCOUNT_NOT_REGISTERED`), prompting registration.

---

## 6. Google Identity Services, FedCM, and Authentication Flow

This project uses Firebase Auth's Google provider rather than direct `google.accounts.id`, `google.accounts.oauth2`, or deprecated `gapi.auth2`. No custom FedCM option was added. Firebase returns the ID token to the button, which sends it only to `/api/auth/google`; the backend verifies it with Firebase Admin SDK or `google-auth-library`, applies existing account/role rules, issues the existing CareSetu JWT, and the frontend performs the existing role redirect.

## 7. CORS and Origin Configuration

Development uses the frontend origin `http://localhost:5173` and the proxied API path `/api`. The backend reads `FRONTEND_URL` and comma-separated `CORS_ORIGINS`. Google/Firebase domains are not added to backend CORS. Firebase authorized domains and Google Cloud OAuth origins must still match the actual deployed frontend and were not changeable from this workspace.

## 8. Test Results

### Automated Unit Test Suite (`tests/google.oauth.security.test.js`)
```text
==================================================
CARESETU GOOGLE OAUTH SECURITY TEST SUITE
==================================================
[PASS] Empty Google ID token returns HTTP 400 Bad Request
[PASS] Expired Google ID token returns HTTP 401 Unauthorized
[PASS] Wrong audience token returns HTTP 401 Unauthorized
[PASS] Token with wrong audience is rejected
[PASS] Wrong issuer token returns HTTP 401 Unauthorized
[PASS] Unregistered Google login attempt returns HTTP 404 Not Found
[PASS] Untrusted ADMIN role escalation request is sanitized to PATIENT
[PASS] Existing user login returns isNewUser=false
[PASS] Suspended/Blocked account returns HTTP 403 Forbidden
[PASS] HOSPITAL Google registration returns isNewUser=true
[PASS] DOCTOR Google registration returns isNewUser=true
[PASS] PATIENT Google registration returns isNewUser=true
--------------------------------------------------
SUMMARY: 35 Passed, 0 Failed
==================================================
```

### Frontend build
`npm run build` was invoked, but the terminal integration returned only npm's startup notice and no completion marker. Workspace diagnostics reported no errors for the touched TypeScript/Vite files, so a successful build is not claimed here.

### Backend syntax
`node --check backend/src/app.js` and `node --check backend/src/middleware/security-headers.middleware.js` completed successfully.

---

## 9. Verification Status Summary

| Area | Status | Evidence |
| :--- | :---: | :--- |
| **COOP configuration** | `APPLIED` | Helmet, Vite dev, and Vite preview use `same-origin-allow-popups`; live response header still needs deployment verification. |
| **Google popup handling** | `APPLIED` | Uses Firebase `signInWithPopup`; no custom `window.closed` polling; browser click-through not run here. |
| **Error handling** | `APPLIED` | Cancellation, popup blocked, configuration, network, 401, 403, and generic failures are handled without token logging. |
| **Backend Google security tests** | `PASSED` | 35/35 assertions passed in `backend/tests/google.oauth.security.test.js`. |
| **Frontend production build** | `UNCONFIRMED` | Command invoked; terminal did not expose a completion result. |

## 10. Browser and Google Console Verification

Not performed in this environment. The following remain deployment checks: inspect the actual login-page response for `Cross-Origin-Opener-Policy: same-origin-allow-popups`, complete a real Google account chooser flow, verify backend session creation and role redirect, and confirm the actual frontend origin in Firebase/Google Cloud Console.

## 11. Regression Scope

No email/password, OTP, registration, session restoration, logout, RBAC, portal, SOS, HealthPack, hospital directory/matching, government-health-data, or i18n business logic was changed. The existing backend Google verification and role authorization paths remain authoritative.

## 12. Remaining Limitations

Real Google credentials, an interactive browser, and the deployed reverse proxy were unavailable for this run. Browser cancellation, popup blocking, account switching, refresh/session persistence, and live response-header behavior should be exercised against the configured deployment before release.
