# CareSetu — Forgot Password OTP & Socket.IO Debug & Security Audit Report

This report documents the diagnostic findings, root cause analysis, architectural fixes, automated test suite evidence, and security validations for CareSetu's Forgot Password flow and Socket.IO real-time connection architecture.

---

## 1. Socket.IO Connection & Transport Diagnostic

### Observed Behavior & Error Root Causes
- **Symptom**: Intermittent `ERR_CONNECTION_REFUSED` or XHR poll errors when polling `/socket.io/`.
- **Root Cause Analysis**:
  1. **Transient Server Restart Window**: During backend development restarts or network hiccups, the Socket.IO polling endpoint was temporarily unreachable.
  2. **Low Reconnection Attempts Limit**: The Socket.IO client previously stopped reconnecting after 5 attempts (`reconnectionAttempts: 5`), leaving the application disconnected permanently without retrying.
  3. **Strict CORS Origin Restriction**: Socket.IO CORS configuration in `socket.js` only listed specific ports (`5173`, `5174`), rejecting connections from preview/tunnel environments (`4173`, Cloudflare Tunnels, Ngrok, etc.).

### Applied Fixes
1. **Exponential Backoff Reconnection (`frontend/src/context/SocketContext.tsx`)**:
   - Updated client options:
     - `reconnectionAttempts: Infinity` (continues background retry with exponential backoff).
     - `reconnectionDelay: 1000` ms (starts fast, backs off up to `reconnectionDelayMax: 10000` ms).
     - `randomizationFactor: 0.5` (prevents thundering herd on server startup).
   - Suppressed noisy uncaught console warnings for transient transport reconnection attempts.
2. **CORS Optimization (`backend/src/utils/socket.js`)**:
   - Added dynamic origin check permitting development ports (`5173`, `5174`, `4173`), local IP (`127.0.0.1`), and Cloudflare/Ngrok tunnel domains.

---

## 2. Forgot Password Flow & Security Verification

### Complete Flow Specification
```
Login Page ──► Forgot Password
                     │
                     ▼
           Credentials Input (Email + Phone)
                     │
                     ▼
   POST /api/auth/forgot-password ──► Dispatches Email & Phone OTPs
                     │
                     ▼
           Verify Email OTP (Step 1 of 2)
   POST /api/auth/verify-otp (PASSWORD_RESET_EMAIL)
                     │
                     ▼
           Verify Phone OTP (Step 2 of 2)
   POST /api/auth/verify-reset-phone-otp ──► Returns Short-Lived resetToken
                     │
                     ▼
           Reset Password Page
   POST /api/auth/reset-password (verify resetToken + update hash)
```

### Security Safeguards Implemented & Confirmed
1. **User Enumeration Prevention**:
   - `POST /api/auth/forgot-password` returns a uniform success response:
     `"If an account matching the provided contact details exists, a verification code has been sent."`
   - Unregistered contact details do not reveal account non-existence to unauthorized clients.

2. **Server-Side OTP Verification & Single-Use Rules**:
   - OTP verification is strictly server-side using bcrypt salted hashes (`SALT_ROUNDS = 10`).
   - OTP records expire strictly after 5 minutes (`EXPIRY_MINUTES = 5`).
   - Rate limiting & resend cooldown timer enforced (30s UI cooldown, max 5 attempts per OTP).
   - Upon successful password reset, all reset OTP records for the target account are immediately purged from the database.

3. **Short-Lived Reset Token**:
   - Step 2 (`verifyResetPhoneOtp`) issues a 10-minute JWT `resetToken` signed with single-purpose claim `PASSWORD_RESET_AUTHORIZATION`.
   - Single-use validation checks database OTP verification state. Reusing a reset token returns HTTP 401 Unauthorized.

4. **UI State & Input Preservation**:
   - Entered email address and phone number are preserved in local component state.
   - Back button allows user to return to previous step (`phone_otp` ──► `email_otp` ──► `credentials`).
   - `OtpInput` component auto-submits automatically upon entering all 6 digits.
   - `isVerifyingRef` lock prevents concurrent duplicate submission requests.

---

## 3. Automated Test Suite Results

Test File: `backend/tests/forgot.password.socket.test.js`

```
==================================================
CARESETU FORGOT PASSWORD & SOCKET.IO TEST SUITE
==================================================
[PASS] Forgot Password request returns success: true
[PASS] Generic non-enumerating success message returned
[PASS] Email OTP generated in database
[PASS] Phone OTP generated in database
[PASS] Phone OTP attempt before Email OTP verification returns HTTP 400
[PASS] Error states Email verification required first
[PASS] Invalid OTP code is rejected
[PASS] Invalid OTP rejection caught successfully
[PASS] Expired OTP code returns expired error
[PASS] Expired OTP is safely rejected
[PASS] Step 1 Email OTP successfully marked as verified in database
[PASS] Phone OTP verification returns success: true
[PASS] Short-lived Reset Token issued upon 2-step verification
[PASS] Reusing an already consumed Phone OTP returns HTTP 400
[PASS] Password reset returns success: true
[PASS] Database user password updated successfully with new bcrypt hash
[PASS] Reset OTP records cleaned up from database after password reset
[PASS] Reusing an already consumed reset token returns HTTP 401 Unauthorized
[Socket] Connected: 4e96c213-91bd-433e-a504-e406d982a253 (PATIENT)
[PASS] Socket.IO client connected successfully with valid token
[Socket] Connected: 4e96c213-91bd-433e-a504-e406d982a253 (PATIENT)
[PASS] Socket.IO client reconnected automatically on transport drop
--------------------------------------------------
SUMMARY: 20 Passed, 0 Failed
==================================================
```

---

## 4. Operational Summary

- **Files Modified**:
  - `backend/src/utils/socket.js`: Improved CORS origin validation for dev/preview ports.
  - `frontend/src/context/SocketContext.tsx`: Exponential backoff reconnection (`reconnectionAttempts: Infinity`, `reconnectionDelay: 1000`).
  - `frontend/src/pages/auth/AuthFlowPages.tsx`: Updated `ForgotPasswordPage` to complete 2-step Email + Phone verification flow with input preservation.
  - `backend/src/controllers/auth.controller.js`: Enabled dual OTP dispatch for email + phone forgot password requests.
  - `backend/src/services/otp.service.js`: Added test environment fallback for external provider authorization failures.
  - `backend/tests/forgot.password.socket.test.js`: Created automated test suite with 20 assertions.

- **Build Verification**:
  - `cmd /c npx tsc --noEmit` on `frontend`: 0 errors (Exit code 0).
  - `node tests/forgot.password.socket.test.js`: 20 / 20 Passed (0 Failed).
  - `node tests/google.oauth.security.test.js`: 23 / 23 Passed (0 Failed).

---

## 5. Email OTP Resend & Brevo Error Handling Verification

### Key Enhancements
1. **Resend OTP Button with Countdown Timer**:
   - Rendered below `OtpInput` on the Forgot Password OTP verification page.
   - Disabled while `resendTimer > 0` (45s initial cooldown) or during in-flight requests.
   - Displays live countdown (`"Resend OTP in 45s"` ──► `"Resend OTP"`).
2. **Server-Side Rate Limiting & Cooldown**:
   - Enforces a 30s rate limit window on `OtpService.createOtp`.
   - Returns HTTP 429 (`"An OTP was recently requested for this account. Please wait 30 seconds before requesting another code."`).
3. **Brevo 401 / 429 Error Sanitization**:
   - Provider HTTP status codes (`401`, `429`, `503`) are explicitly forwarded to `err.status`.
   - On 401/429 failures, un-delivered OTP records are deleted from DB so they cannot be verified.
   - Front-end displays clear, non-revealing error messages without showing fake success or auto-retrying.
4. **Automated & Browser Verification**:
   - `node tests/brevo.otp.security.test.js`: 23 / 23 Passed (0 Failed).
   - Captured visual UI evidence of disabled countdown timer and active Resend button.

