# Frontend TypeScript Types (`frontend/src/types`)

## Purpose
Contains TypeScript interface definitions, enum types, and API response shapes used throughout the React frontend codebase.

## Key Types Defined
- **`user.types.ts`:** `User`, `UserRole` (`PATIENT`, `HOSPITAL`, `DOCTOR`, `ADMINISTRATOR`).
- **`emergency.types.ts`:** `EmergencyCase`, `SOSStatus` (`DISPATCHING`, `ACCEPTED`, `ARRIVED`), `HospitalMatch`.
- **`chat.types.ts`:** `ChatMessage`, `DoctorAIResponse`, `AIIntent`, `EmergencyRedFlag`.
- **`healthpack.types.ts`:** `MedicalDocument`, `ConsentGrant`.

## Authentication & OTP Verification Flows
- **Consistent Back Button Navigation:** Every OTP verification view (`RegisterPage`, `LoginPage`, `ForgotPasswordPage`, `CredentialUpdateModal`) includes a standardized "← Back" button with keyboard accessibility (`Tab`, `Enter`, `Space`) and state preservation.
- **2-Step Dual OTP Forgot Password Flow:**
  - `ForgotPasswordPage`: Step 1 (Input registered Email & Phone) -> Step 2 (Verify Email OTP) -> Step 3 (Verify Phone OTP) -> Step 4 (Set new password with single-use reset token on `ResetPasswordPage`).
- **Session Revocation:** On Back button click, pending OTP sessions are revoked on backend (`cancelRegistration` / `cancelForgotPassword`), timers are cleared, and form inputs are preserved for correction.
