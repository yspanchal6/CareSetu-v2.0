# CareSetu Authentication COOP & Security State Lifecycle Verification Report

**Date:** September 28, 2026  
**System:** CareSetu Authentication, Security Headers, and Hospital Portal Security State Lifecycle  
**Status Summary:** GREEN (All authentication, COOP policy compatibility, `/api/auth/me` security payload, state persistence, and counter lifecycle requirements verified)

---

## Executive Summary

This report documents the root-cause analysis, security header adjustments, authentication flow stabilization, and complete security state machine lifecycle verification across user sign-in, session refresh, logout, re-login, portal restriction, and administrative unlock.

---

## Status Verification Matrix

| Requirement / Module | Status | Notes & Verification Evidence |
| :--- | :---: | :--- |
| **Firebase COOP Popup Compatibility** | `GREEN` | Helmet policy set to `same-origin-allow-popups` in `security-headers.middleware.js` and Vite dev server `server.headers`. Prevents `window.closed` browser error. |
| **Google Sign-In (`signInWithPopup`)** | `GREEN` | Google OAuth token exchange succeeds cleanly, issues CareSetu JWT, populates `/api/auth/me`. |
| **Email/Password Authentication** | `GREEN` | `POST /api/auth/login` verifies bcrypt hash, returns token & user payload without resetting backend security block. |
| **Authoritative `/api/auth/me` Payload** | `GREEN` | Enriched `toPublicUser` in `auth.controller.js` to return structured `user.security` object for `HOSPITAL` users. |
| **No Optimistic Security Reset on Login** | `GREEN` | `HospitalSecurityContext` loads authoritative backend status (`getHospitalSecurityStatus`). Login does NOT clear existing blocks. |
| **Logout Verification** | `GREEN` | Clears client session/token from storage without modifying backend violation counters or security epoch. |
| **Hospital Restriction Route Enforcement** | `GREEN` | `DashboardLayout` checks `TEMPORARILY_BLOCKED` or `UNDER_REVIEW` and renders `HospitalRestrictedView` across all hospital routes. |
| **3-Attempt Counter Lifecycle (0/3 → 3/3)** | `GREEN` | Captures 1, 2, and 3 correctly advance from 1/3 WARNING to 2/3 FINAL WARNING to 3/3 TEMPORARILY_BLOCKED. 4th attempt is capped at 3/3. |
| **Refresh & Re-login Persistence** | `GREEN` | Server-authoritative DB state maintains `TEMPORARILY_BLOCKED` across browser refresh, logout, re-login, and direct URL navigation. |
| **Admin Unlock & Security Epoch Rotation** | `GREEN` | Admin unlock sets status `ACTIVE`, resets active count to 0, preserves historical count, increments `securityEpoch` ($N \rightarrow N+1$), and rejects stale callbacks from epoch $N$. |
| **Frontend Production Build** | `GREEN` | `npm run build` compiled 2,621 modules with zero errors in 10.13s. |
| **Automated Security Test Suite** | `GREEN` | 12/12 test scenarios passed in `tests/capture-502-and-realtime-security.test.js`. |

---

## Technical Details & Implementation

### 1. Root Cause of Firebase COOP Error & Fix
- **Root Cause:** Standard Helmet `crossOriginOpenerPolicy` setting of `same-origin` causes modern web browsers to isolate popup windows (such as Firebase Auth's Google Sign-In popup). When Firebase attempts to call `popup.closed` or send `postMessage` back to the opener, the browser logs:
  ```text
  Cross-Origin-Opener-Policy policy would block the window.closed call.
  ```
- **Fix Applied:**
  1. Updated `backend/src/middleware/security-headers.middleware.js`:
     ```js
     crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
     ```
  2. Updated `frontend/vite.config.ts`:
     ```ts
     server: {
       headers: {
         'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
       }
     }
     ```
  3. Updated CSP directives to whitelist Firebase and Google Auth endpoints (`https://apis.google.com`, `https://*.firebaseapp.com`, `https://identitytoolkit.googleapis.com`, `https://accounts.google.com`).

---

### 2. Authoritative Security State in `/api/auth/me`
In `backend/src/controllers/auth.controller.js`, `toPublicUser` now builds a dedicated `security` object for `HOSPITAL` accounts:

```json
{
  "id": "6005a8cb-0caf-45a5-937c-5ae40602ff7f",
  "email": "hospital@caresetu.in",
  "role": "HOSPITAL",
  "security": {
    "status": "TEMPORARILY_BLOCKED",
    "currentViolationCount": 3,
    "historicalViolationCount": 3,
    "maxAttempts": 3,
    "remainingAttempts": 0,
    "securityEpoch": 1,
    "blockedAt": "2026-09-28T01:00:00.000Z",
    "blockReason": "Protected medical-content capture violation"
  }
}
```

---

### 3. Route Protection for Blocked Hospitals
- `DashboardLayout.tsx` checks `useHospitalSecurity()`. If `isHospital` is `true` and the security status is `TEMPORARILY_BLOCKED` or `UNDER_REVIEW`, `DashboardLayout` renders `HospitalRestrictedView` instead of standard page routes.
- This ensures that navigating to `/hospital/dashboard`, `/hospital/patients`, `/hospital/reports`, `/hospital/capacity`, or direct URLs cannot bypass the restriction screen.

---

### 4. Build & Test Results

#### Frontend Production Build
```bash
npm run build
> tsc -b && vite build
✓ 2621 modules transformed.
dist/index.html                        1.04 kB │ gzip:   0.57 kB
dist/assets/index-Ddv6V_s0.css        85.79 kB │ gzip:  18.81 kB
dist/assets/offlineDB-CN2MmwCc.js      2.80 kB │ gzip:   0.73 kB
dist/assets/index-BIdomZrE.js      1,689.36 kB │ gzip: 447.19 kB
✓ built in 10.13s
```

#### Security & Integration Suite
- `tests/capture-502-and-realtime-security.test.js`: **12/12 PASSED**
- All authentication, COOP policy headers, and state persistence rules verified against live PostgreSQL instance.
