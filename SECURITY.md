# Security Policy & Vulnerability Reporting

The CareSetu team prioritizes data privacy, medical confidentiality, and application security.

---

## Supported Versions

Only the latest release version on the `master` branch receives active security updates.

| Version | Supported |
|---|---|
| v1.0.x (Current) | :white_check_mark: Yes |
| < 1.0.0 | :x: No |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in CareSetu:
1. Email your findings directly to `security@caresetu.org`.
2. Include a detailed description of the vulnerability, proof-of-concept steps, and potential impact.
3. Allow up to **48 hours** for our security team to acknowledge receipt.
4. We request responsible disclosure and will work with you to patch the issue before public announcement.

---

## Core Security Safeguards

- **Strict Rate Limiting & Abuse Protection:** Multi-tiered rate limiters for auth, OTP, upload, and admin APIs with Redis shared store support.
- **Role-Based Access Control (RBAC) & IDOR Protection:** Deny-by-default authorization on all protected routes and single-resource ownership checks.
- **Patient Data Privacy:** HealthPack medical history is isolated per patient with automated PII log redaction.
- **Deterministic Triage Primacy:** Emergency red flags override LLM logic to prevent AI hallucination during life-threatening events.
- **Input Sanitization & Parameterized Queries:** Prompt injection scrubbing on text/docs and Prisma ORM parameterized queries to defeat SQL injection.
- **Strict File Upload Security:** File uploads restricted to PDF, JPG, and PNG formats up to 10MB per file with magic byte verification and non-public storage.
- **Single-Use Hashed OTP Verification:** OTPs hashed using SHA-256 and invalidated immediately upon consumption.

For full technical specifications, architecture diagrams, and testing evidence, see [docs/security/ENTERPRISE_SECURITY.md](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/docs/security/ENTERPRISE_SECURITY.md).

