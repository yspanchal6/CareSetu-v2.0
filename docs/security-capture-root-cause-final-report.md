# CareSetu Security System — Final Root Cause Fix & Verification Report

## Executive Summary
This document details the root cause investigation, structural bug fixes, database persistence audit, real-time socket updates, and comprehensive test suite results for the CareSetu Hospital Security & Content Protection subsystem.

---

## 1. Root Cause Analysis

### A. Primary Cause of False 3/3 Block
In [`frontend/src/services/secure-content.service.ts`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/services/secure-content.service.ts), all security API methods (`reportViolation`, `getHospitalSecurityStatus`, `createViewSession`, `submitAppeal`, `getAdminViolations`, `unlockHospital`) were attempting to read authentication JWT tokens using:
```typescript
const token = localStorage.getItem('token') || sessionStorage.getItem('token');
```
However, the CareSetu platform stores authentication tokens in `sessionStorage` under the key `"caresetu_auth_token"`.

Because `token` evaluated to `null`:
1. `SecureContentService.reportViolation` triggered its fallback block:
   ```typescript
   if (!token) {
     return {
       allowed: false,
       attemptNumber: 3,
       remainingAttempts: 0,
       action: 'TEMPORARY_BLOCK',
       status: 'TEMPORARILY_BLOCKED'
     };
   }
   ```
   **Result:** The very first capture attempt (e.g. pressing PrintScreen once or a single shortcut) immediately returned a hardcoded 3/3 `TEMPORARILY_BLOCKED` response, falsely restricting the hospital portal without reaching the backend!
2. `SecureContentService.getHospitalSecurityStatus()` failed token checks, returning default values or failing to reconcile active backend status.

### B. Route Navigation & Page Refresh False-Positives
- **Cause:** Page initialization, route changes (`Dashboard`, `Emergency Cases`, `Active Cases`, `Patients`, etc.), tab focus/blur (`visibilitychange`), and component mounts/unmounts were previously triggering client-side security checks or state updates that evaluated against null tokens.
- **Rule Enforced:** Page navigation, route changes, component mounts, tab switching, and page refreshes **MUST NEVER** invoke `reportViolation()` or increment the violation counter. `GET /api/security/hospital-status` strictly **reads** existing PostgreSQL database status without mutating state.

---

## 2. Structural Fixes Implemented

### 1. Token Resolution Fix (`frontend/src/services/secure-content.service.ts`)
- Replaced all token lookups with `getAuthToken()` from [`api.ts`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/services/api.ts):
  ```typescript
  private static getToken(): string | null {
    return (
      getAuthToken() ||
      sessionStorage.getItem('caresetu_auth_token') ||
      localStorage.getItem('caresetu_auth_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token')
    );
  }
  ```
- **Fallback Rule:** If `!token`, `reportViolation` returns `{ allowed: true, attemptNumber: 0, remainingAttempts: 3, action: 'WARNING', status: 'ACTIVE' }`. A missing token **never** creates a local 3/3 block.

### 2. Idempotency & Event Deduplication
- Added automatic `clientGeneratedEventId` to `reportViolation` payload metadata:
  ```typescript
  const clientGeneratedEventId = payload.metadata?.clientGeneratedEventId || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  ```
- Backend (`backend/src/services/hospital-security.service.js`) uses pessimistic row locks (`SELECT ... FOR UPDATE`), 1.5s burst deduplication, and `clientGeneratedEventId` deduplication so duplicate network requests do not produce multiple counter increments.

### 3. Admin Real-Time Update & Email Dispatch
- In `backend/src/services/hospital-security.service.js`:
  - When the 3rd confirmed violation occurs (`isBlockingAttempt`), the backend emits a Socket.IO `HOSPITAL_SECURITY_BLOCKED` event to update connected Admin dashboards in real time.
  - Dispatches security restriction emails to both the hospital and `ADMIN_NOTIFICATION_EMAIL` (`admin@caresetu.in`).
  - Email failures are failure-isolated and **do not** roll back the database transaction.

---

## 3. Platform Capability Disclosure

| Environment | Protection Capability | Authoritative Signal |
| :--- | :--- | :--- |
| **Web / PWA** | Layered privacy backdrop on tab blur/visibility loss, Blob streams, dynamic watermarks | Explicit protected viewer events (`PrintScreen`, `Ctrl+P`, `Cmd+Shift+3/4/5`) |
| **Android Native** | `WindowManager.LayoutParams.FLAG_SECURE` blocks OS screenshots, screen recording & task switcher | OS native hardware signal `OS_CAPTURE_DETECTED` |
| **iOS / iPadOS Native** | `UIScreen.main.isCaptured` / `sceneCaptureState` monitoring & UI redaction | OS native hardware signal `SCREEN_CAPTURE_STATE_CHANGED` |

*Note: Page refresh, tab focus/blur (`visibilitychange`), and route navigation serve as UI privacy redaction triggers only and NEVER increment security violations.*

---

## 4. Test Matrix Verification (Tests A – J)

| Test ID | Test Scenario | Expected Outcome | Status |
| :---: | :--- | :--- | :---: |
| **Test A** | Normal Page Load (Dashboard) | 0/3 `ACTIVE`, no violation created | **GREEN** |
| **Test B** | Page Navigation & Route Switching | Navigates across all hospital tabs, 0/3 `ACTIVE` | **GREEN** |
| **Test C** | Protected HealthPack Capture #1 | Confirmed capture event → 1/3 `WARNING` | **GREEN** |
| **Test D** | Protected HealthPack Capture #2 | Confirmed capture event → 2/3 `FINAL_WARNING` | **GREEN** |
| **Test E** | Protected HealthPack Capture #3 | Confirmed capture event → 3/3 `TEMPORARILY_BLOCKED`, Admin review created | **GREEN** |
| **Test F** | Page Refresh After Block | Reads 3/3 `TEMPORARILY_BLOCKED` from DB, counter remains 3 (never 4) | **GREEN** |
| **Test G** | Logout & Re-login | Session restored, reads 3/3 `TEMPORARILY_BLOCKED` from DB | **GREEN** |
| **Test H** | Submit Hospital Appeal | Appeal created with `status: PENDING`, status becomes `UNDER_REVIEW` | **GREEN** |
| **Test I** | Admin Unlock | Status restored to `ACTIVE`, `currentViolationCount = 0`, `securityEpoch` incremented | **GREEN** |
| **Test J** | Capture Event After Unlock | First capture in new epoch registers as 1/3 (not 4/3) | **GREEN** |

---

## 5. Verification Results
- **Capture Security Suite (`backend/tests/capture-violation-security.test.js`):** **24 PASSED, 0 FAILED**
- **Google OAuth Security Suite (`backend/tests/google.oauth.security.test.js`):** **35 PASSED, 0 FAILED**
- **Core Auth Security Suite (`backend/tests/auth.security.test.js`):** **20 PASSED, 0 FAILED**
- **Frontend Build (`cmd /c npm run build`):** **PASSED** (Exit code 0)

---

## 6. Final Acceptance Checklist
- [x] Page refresh does NOT create security violation
- [x] Route navigation does NOT create security violation
- [x] React remount / StrictMode does NOT create security violation
- [x] Socket reconnect does NOT create security violation
- [x] 0/3 remains 0/3 until a real supported capture event occurs
- [x] Confirmed protected capture #1 = 1/3
- [x] Confirmed protected capture #2 = 2/3
- [x] Confirmed protected capture #3 = 3/3
- [x] 4th attempt remains capped at 3/3
- [x] Counter UI is dynamic (`currentViolationCount / maxAttempts`)
- [x] Backend database is authoritative
- [x] Admin Security Reviews display blocked hospital
- [x] Admin Socket.IO real-time event (`HOSPITAL_SECURITY_BLOCKED`) emitted
- [x] Admin notification email dispatched
- [x] Hospital appeal saved and visible in Admin Dashboard
- [x] Admin unlock increments `securityEpoch` and resets current count to 0
- [x] Historical violation count preserved
- [x] New enforcement cycle starts at 0/3 in new epoch
