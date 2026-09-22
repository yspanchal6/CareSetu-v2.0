# CareSetu Privacy & Data Protection Policy

## 1. Privacy-by-Design Core Principles

CareSetu enforces privacy-by-design standards across all patient, doctor, hospital, and emergency workflows.

---

## 2. Privacy & Data Protection Safeguards

### 1. Data Minimization & Purpose Limitation
- The application collects only personal and medical information strictly required for healthcare services, emergency dispatch, and identity verification.
- Sensitive medical records and HealthPack files are accessible only to authorized users and healthcare providers with explicit patient consent or active emergency SOS grants.

### 2. Automated PII & Credential Masking
- User email addresses are masked in UI screens and log streams (`y***@domain.com`).
- Mobile phone numbers are masked (`******1234`).
- Passwords, access tokens, OTP values, and medical document contents are scrubbed from all application logs via custom `logger.js` redaction middleware.

### 3. Secure Cookie & Session Storage Policy
- Authentication session tokens use signed, HttpOnly JWT cookies and authorization headers.
- Plain-text passwords, OTPs, and access tokens are never stored in browser `localStorage` or exposed in URL query parameters.

### 4. AI Assistant Data Privacy
- AI Doctor Chatbot queries pass through prompt injection scrubbing (`chat.controller.js`).
- PII and raw identity details are omitted from AI model prompts. Patient data is never used for external AI model training without explicit consent.

### 5. Audit Logging & Access Traceability
- Sensitive operations (document uploads, document deletions, OTP verifications, HealthPack access, admin blocklist actions) generate immutable `AuditLog` records in PostgreSQL.
- Audit logs record actor ID, action type, timestamp, IP address, and resource ID without logging plain-text passwords or medical record payloads.
