# CareSetu — Enterprise Security Audit & Remediation Report

## 1. Executive Summary

This report presents the findings, risk assessment, and remediation steps from the full-stack security audit of the CareSetu codebase.

---

## 2. Hardcoded Secrets & Credentials Audit

### Audit Scope
Every directory in the repository was searched for hardcoded credentials, API keys, private keys, JWT secrets, database URLs, SMTP credentials, Firebase service account keys, TextBee/Brevo keys, and hardcoded tokens.

### Discovered Secrets & Security Findings
1. **Fallback JWT Secret Key**:
   - **Location**: `backend/src/controllers/auth.controller.js`, `backend/src/middleware/auth.middleware.js`, `backend/src/utils/socket.js`.
   - **Finding**: Hardcoded fallback string `'your-secret-key-change-in-production'`.
   - **Remediation**: Enforced strict runtime environment checks. In production (`NODE_ENV === 'production'`), any missing `JWT_SECRET` throws an explicit configuration error and refuses execution.

2. **Fallback HealthPack Encryption Key**:
   - **Location**: `backend/src/utils/crypto.js`.
   - **Finding**: Fallback string `'12345678901234567890123456789012'`.
   - **Remediation**: Added production guard enforcing 32-byte key presence in `process.env.HEALTH_PACK_KEY` or `process.env.HEALTH_PACK_SECRET_KEY`.

3. **Service Account JSON & Environment Variables**:
   - **Location**: `.gitignore` audit.
   - **Finding**: `.env` and `*service-account*.json` are excluded in root and package `.gitignore` files.
   - **Remediation**: Confirmed no `.env` or service account JSON files are committed to Git tracking. Added `.env.example` templates with non-sensitive placeholders.

---

## 3. Environment & Configuration Security

- Secrets must never be exposed to Vite / React frontend bundles.
- Frontend public variables are strictly restricted to `VITE_` prefixes (`VITE_API_URL`, `VITE_FIREBASE_*`).
- Production backend keys (`JWT_SECRET`, `DATABASE_URL`, `HEALTH_PACK_KEY`, `TEXTBEE_API_KEY`, `BREVO_API_KEY`) remain server-side only.

---

## 4. Authentication, Role Enforcement & OTP Safety

- **Password Requirements**: Enforced server-side via Zod schema and `validatePasswordStrength()` (min 8 chars, max 128 chars, uppercase, lowercase, digit, special character).
- **OTP Delivery & Verification**:
  - OTPs are cryptographically generated (`crypto.randomInt`), hashed with bcrypt/SHA256, stored with short 5-minute expiration and max attempt counters (5 attempts).
  - Production mode (`DEV_OTP_MODE=false`) strictly disables mock OTP fallback. Delivery failures result in clean user-facing error messages without marking contacts verified.
- **Google OAuth / Firebase Login**:
  - Server verifies Firebase ID tokens via `firebase-admin` auth.
  - Accounts must exist or register via the standard user flow; role promotion and creation cannot be bypassed via public Google login.
- **Guest Mode Isolation**:
  - Restricted to temporary guest sessions without database account creation.
  - Restricted from accessing HealthPacks, uploading medical documents, or making account changes.

---

## 5. Security Remediation Actions Checklist

- [x] Hardcoded secret fallback guards hardened for production environments.
- [x] Sensitive parameters scrubbed from application logging via `logger.js`.
- [x] `.env.example` updated with comprehensive environment variable definitions.
- [x] IDOR protection verified on user resources (`requireSelfOrAdmin`).
- [x] Socket.IO room subscriptions authorized at connection and event boundaries.
