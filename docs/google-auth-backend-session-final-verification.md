# Google Auth & CareSetu Backend Session Verification Report

## Executive Summary
This document provides the complete root cause analysis, fix implementation, and verification matrix for the CareSetu Google Authentication & Backend Session Exchange system.

Previously, Google Account authentication (Firebase popup) succeeded, but the CareSetu backend session exchange failed, resulting in:
1. Premature success toast: `"Logged in successfully with Google."`
2. Immediate error toast: `"Unable to connect to the server. Please try again."`
3. Stale Socket context: Socket remaining connected as `[Socket] Connected (PATIENT)` regardless of logged-in user.
4. Browser console warnings for COOP and unprompted notification permission requests.

Following the fix, Google authentication is only declared successful **after** the CareSetu backend session exchange and `/api/auth/me` user/role resolution succeed.

---

## 1. Failed Endpoint & Root Cause Analysis

### Exact Failed Endpoint
- **HTTP Method:** `POST`
- **URL:** `/api/auth/google`

### Root Cause Details
1. **Un-awaited Promise in Controller:**
   In `backend/src/controllers/auth.controller.js` (line 503), `toPublicUser(user)` is an `async` function. The code returned `user: toPublicUser(user)` without `await`. In Express `res.json()`, `JSON.stringify(new Promise(...))` serializes to `{}` (an empty object).
2. **TypeError on Frontend:**
   In `frontend/src/components/common/GoogleAuthButton.tsx`, `res.user` was `{}`. Accessing `res.user.role.toLowerCase()` threw `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`.
3. **Premature Success Toast & Error Interception:**
   `GoogleAuthButton.tsx` called `showToast("success", ...)` before validating session establishment. When `res.user.role.toLowerCase()` threw a `TypeError`, the `catch` block caught it and misidentified it as a network error, showing `"Unable to connect to the server. Please try again."` immediately after the success toast.
4. **Stale Socket Instance:**
   `SocketContext.tsx` kept existing socket connections open without checking whether `socketRef.current` belonged to the current user ID and session token.
5. **Unprompted Notification Permission Request:**
   `firebase.ts` called `Notification.requestPermission()` automatically during app initialization, triggering a Chromium browser violation (`[Violation] Only request notification permission in response to a user gesture`).

---

## 2. Comprehensive Solution & Architecture Fix

### A. Backend Fix (`backend/src/controllers/auth.controller.js`)
- Added `await` to `toPublicUser(user)` in `exports.googleAuth` and `exports.register`.
- Verified that `user` payload returned to the frontend contains full authoritative DB user attributes (`id`, `email`, `role`, `hospitalSecurityStatus`, `security`, etc.).

### B. Frontend Success Toast & Session Flow (`GoogleAuthButton.tsx`)
- Refactored `handleGoogleSignIn` sequence:
  ```
  Firebase Google Sign-In Popup
  ↓
  Obtain Firebase ID Token
  ↓
  POST /api/auth/google
  ↓
  Backend verifies token & returns CareSetu User + JWT
  ↓
  await setSession(res.user, res.token) (AuthContext updated)
  ↓
  ONLY THEN: showToast("success", "Logged in successfully with Google.")
  ↓
  Navigate to role dashboard
  ```
- If backend session exchange fails:
  - DO NOT display success toast.
  - Log diagnostic `[GOOGLE_AUTH_DEBUG]` info (status, endpoint, error code) without exposing tokens or PII.
  - Display safe user message: `"Google authentication succeeded, but CareSetu could not establish your session. Please try again."`
  - For unregistered Google emails (HTTP 404), display the **Account Not Registered** modal.

### C. Socket Context Session Management (`SocketContext.tsx`)
- Track `_sessionToken` and `_sessionUserId` on the active socket instance.
- Automatically disconnect previous socket whenever session token or user ID changes or logout occurs.
- Connects socket with authoritative role from `/api/auth/me` / `AuthContext`:
  - `PATIENT` → `[Socket] ✅ Connected (PATIENT)`
  - `HOSPITAL` → `[Socket] ✅ Connected (HOSPITAL)`
  - `ADMIN` → `[Socket] ✅ Connected (ADMIN)`

### D. COOP & Notification Cleanup (`firebase.ts` & `security-headers.middleware.js`)
- **COOP Policy:** Maintained `Cross-Origin-Opener-Policy: same-origin-allow-popups` in backend helmet configuration to ensure stability of the Google Account Chooser popup.
- **Notification Permission:** Modified `requestNotificationPermission()` to check `Notification.permission === 'granted'` before fetching FCM tokens. Added `requestNotificationPermissionWithUserGesture()` for explicit user click handlers.

---

## 3. Verification Matrix

| Verification Test Item | Expected Result | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Google Account Chooser** | Opens popup, allows account selection | **GREEN** | Stable popup lifecycle |
| **Firebase Auth Token Verification** | Validates signature, email, claims | **GREEN** | Rejects invalid/expired/wrong-aud tokens |
| **CareSetu Backend Exchange** | Returns valid JWT + user payload | **GREEN** | `user` object properly resolved |
| **`/api/auth/me` Verification** | Returns authoritative DB user & role | **GREEN** | Matches PostgreSQL user record |
| **Success Toast Timing** | Displayed ONLY after session confirmed | **GREEN** | No premature success toast |
| **Failed Session Toast** | Displays error message, no false success | **GREEN** | Safe error handling |
| **Stale Socket Clean Up** | Old socket disconnected on re-auth | **GREEN** | Role-based connection updated |
| **PATIENT Role Verification** | DB role = PATIENT | **GREEN** | Connected (PATIENT) |
| **HOSPITAL Role Verification** | DB role = HOSPITAL | **GREEN** | Connected (HOSPITAL) |
| **ADMIN Role Verification** | DB role = ADMIN | **GREEN** | Connected (ADMIN) |
| **Security Counter (`/api/hospital/security-status`)** | Belongs to authenticated hospital | **GREEN** | Correct security Epoch and violation count |
| **Security Counter Increment (1/3 → 2/3 → 3/3)** | Transitions to `TEMPORARILY_BLOCKED` | **GREEN** | Block enforced across session/refresh |
| **Admin Unlock** | Resets violations to 0, status `ACTIVE` | **GREEN** | Increments security Epoch |
| **COOP Header Compliance** | `same-origin-allow-popups` active | **GREEN** | Popup works without header conflict |
| **Notification Gesture Warning** | No unprompted permission prompt | **GREEN** | Console violation resolved |
| **TypeScript Build Check** | `npx tsc --noEmit` passes with 0 errors | **GREEN** | Clean compilation |

---

## 4. Final Acceptance Checklist
- [x] Google Account Chooser works
- [x] Firebase authentication works
- [x] CareSetu backend session exchange works
- [x] `/api/auth/me` returns authoritative DB user & role
- [x] Success toast appears ONLY after backend session success
- [x] Failed backend exchange does NOT produce false success
- [x] No stale PATIENT socket
- [x] Correct role reaches SocketContext
- [x] HOSPITAL receives HOSPITAL session
- [x] Security status belongs to the authenticated hospital identity
- [x] Notification permission requested only via user gesture
- [x] Google popup lifecycle is stable
- [x] No unresolved CareSetu authentication errors remain
