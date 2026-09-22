# CareSetu Enterprise Security, Rate Limiting, RBAC & Document Security Architecture

## 1. Executive Summary
This document provides a comprehensive overview of the enterprise-grade security extensions implemented in the **CareSetu Post-Registration Document Verification OTP Flow** and backend infrastructure. The system enforces zero-trust authorization, shared rate limiting, load balancer preparedness, strict Role-Based Access Control (RBAC), database transaction safety, document magic byte validation, and automated PII redaction.

---

## 2. Server-Side Rate Limiting & Abuse Protection

### Configuration & Architecture
CareSetu implements multi-tiered rate limiting using `express-rate-limit` with an optional `rate-limit-redis` shared store fallback. When running in a load-balanced environment with multiple backend instances, Redis ensures shared counter tracking across nodes.

```
                  +-----------------------------------+
                  |        Reverse Proxy / LB         |
                  +-----------------+-----------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
+---------v---------+                               +---------v---------+
| Backend Instance 1|                               | Backend Instance 2|
+---------+---------+                               +---------+---------+
          |                                                   |
          +-------------------------+-------------------------+
                                    |
                        +-----------v-----------+
                        |  Redis Shared Store   |
                        | (Rate Limit Counters) |
                        +-----------------------+
```

### Rate Limiting Tiers

| Endpoint Category | Rate Limit Window | Max Requests | Identifiers | Action on Limit Exceeded |
|---|---|---|---|---|
| **Global API (`apiLimiter`)** | 15 minutes | 300 | IP Address / Auth User | HTTP 429 (`Retry-After` header) |
| **Login & Register (`loginRateLimiter`)** | 15 minutes | 5 | IP Address + Username | HTTP 429 (`Retry-After` header) |
| **Email OTP (`otpEmailLimiter`)** | 15 minutes | 3 | IP Address / Auth User | HTTP 429 (`Retry-After` header) |
| **SMS OTP (`otpSmsLimiter`)** | 15 minutes | 3 | IP Address / Auth User | HTTP 429 (`Retry-After` header) |
| **OTP Verification (`otpVerifyLimiter`)** | 15 minutes | 5 | IP Address / Auth User | HTTP 429 (`Retry-After` header) |
| **Document Upload (`docUploadLimiter`)** | 15 minutes | 10 | Auth User ID | HTTP 429 (`Retry-After` header) |
| **Document Download (`docDownloadLimiter`)** | 15 minutes | 20 | Auth User ID | HTTP 429 (`Retry-After` header) |
| **AI Chatbot (`aiChatLimiter`)** | 1 hour | 50 | Auth User ID | HTTP 429 (`Retry-After` header) |
| **Admin Endpoints (`adminLimiter`)** | 15 minutes | 60 | Auth User ID | HTTP 429 (`Retry-After` header) |

### Anti-Enumeration & Headers
- Generic error messages (`"Too many attempts, please try again later."`) prevent account enumeration.
- Standard headers set: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After`.

---

## 3. Load Balancer & Scalability Architecture

### Stateless Backend Design
1. **Session & Auth State:** Authenticated state is governed by signed, HttpOnly JWT cookies and bearer tokens. Backend nodes maintain zero in-memory user sessions.
2. **OTP & Verification State:** Incomplete registration and document verification state are persisted in PostgreSQL (`User`, `Verification`, `DocumentVerificationRecord` tables) and single-use OTP hashes in Redis/PostgreSQL.
3. **Socket.IO Scaling:** Socket.IO handles real-time notifications. For multi-node deployments, `@socket.io/redis-adapter` enables event broadcasting across instances.
4. **Reverse Proxy & Trust Proxy:** Configured `app.set('trust proxy', 1)` in Express to securely process `X-Forwarded-For` and `X-Forwarded-Proto` headers when deployed behind ALB/Nginx/Cloudflare.

### Health Checks & Graceful Shutdown
- `/health` and `/api/health` provide deep checks, verifying PostgreSQL database responsiveness, system uptime, and environment status.
- `server.js` catches `SIGTERM` and `SIGINT` signals, draining active HTTP connections and cleanly closing Prisma database pools.

---

## 4. Role-Based Access Control (RBAC) & IDOR Protection

### Deny-by-Default Matrix

| Resource / Action | Patient | Doctor | Hospital | Admin | Super Admin |
|---|---|---|---|---|---|
| **View Own Profile / Documents** | :white_check_mark: Allow | :white_check_mark: Allow | :white_check_mark: Allow | :white_check_mark: Allow | :white_check_mark: Allow |
| **View Other User Documents (Unshared)** | :x: Deny (403) | :x: Deny (403) | :x: Deny (403) | :x: Deny (403) | :white_check_mark: Allow (Audit) |
| **Upload Post-Registration Docs** | :white_check_mark: Allow (Self) | :white_check_mark: Allow (Self) | :white_check_mark: Allow (Self) | :x: Deny | :x: Deny |
| **Verify OTP for Document Submission** | :white_check_mark: Allow (Self) | :white_check_mark: Allow (Self) | :white_check_mark: Allow (Self) | :x: Deny | :x: Deny |
| **Access Emergency Patient HealthPack** | :x: Deny | :white_check_mark: Allow (Consent) | :white_check_mark: Allow (Consent) | :x: Deny | :x: Deny |
| **System User Management / Admin API** | :x: Deny (403) | :x: Deny (403) | :x: Deny (403) | :white_check_mark: Allow | :white_check_mark: Allow |

### IDOR Enforcement (`requireSelfOrAdmin`)
Middlewares check that `req.user.userId === req.params.userId` or `req.user.userId === resource.userId`. If a user attempts to view, upload, delete, or verify documents belonging to another user, the request is immediately rejected with `HTTP 403 Forbidden` and audited.

---

## 5. Database Security & Transaction Safety

1. **Query Parameterization:** Enforced exclusively via Prisma ORM. Raw string-concatenated SQL queries are strictly prohibited.
2. **Zod Validation:** All incoming payloads are validated before database queries execute.
3. **Prisma Atomic Transactions (`$transaction`):**
   - Document Upload & Verification Status updates execute inside atomic transactions.
   - OTP consumption clears/marks the OTP record as used atomically to prevent race conditions and replay attacks.
4. **Credential & OTP Storage:**
   - User passwords hashed using Argon2id / bcrypt.
   - OTP values hashed using SHA-256 before storage (`crypto.createHash('sha256')`).
5. **Unique Constraints:** Database schema enforces unique constraints on email, mobile number, and active verification records.

---

## 6. Document Security & Storage Specifications

1. **File Type & Magic Byte Validation:**
   - File extensions and MIME headers are inspected against an explicit allowlist: `.pdf` (`application/pdf`), `.jpg` / `.jpeg` (`image/jpeg`), `.png` (`image/png`).
   - Magic byte header signatures are verified before storage:
     - PDF: `%PDF-` (`0x25 0x50 0x44 0x46`)
     - JPG: `0xFF 0xD8 0xFF`
     - PNG: `0x89 0x50 0x4E 0x47`
2. **Random Server Filenames:** Original user filenames are stripped to prevent path traversal (`../../`). Filenames are re-generated using UUID v4 / crypto random hashes.
3. **Isolated Private Storage:** Files are stored in `backend/uploads/documents/` outside the public static server root. Direct HTTP web access to document files is impossible.
4. **Authenticated Download Endpoints:** Documents can only be retrieved via `GET /api/documents/:id/download`, which executes explicit ownership and RBAC permissions checks.

---

## 7. User Privacy & Data Protection (PII Scrubbing)

1. **Automated Structured Logging with Scrubbing:**
   - Custom `logger.js` automatically redacts sensitive keys: `password`, `token`, `otp`, `secret`, `authorization`, `creditCard`.
   - Pattern scrubbing masks email addresses (`y***@domain.com`) and phone numbers (`******1234`).
   - Zero plain-text logging of OTPs or passwords in production or development logs.
2. **Security Headers (`security-headers.middleware.js`):**
   - `Helmet` enables `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff`, HSTS, and strict Content Security Policy (CSP).
   - Correlation IDs (`X-Request-ID`) added to every request header and log entry for request tracing.

---

## 8. Verification & Evidence Matrix

All 15 automated enterprise security test cases have been executed against a live test backend environment with 100% pass rate.

| # | Test Name | Expected Result | Actual Result | HTTP Status / Evidence | Status |
|---|---|---|---|---|---|
| 1 | **Helmet & Security Headers** | Security headers set, `X-Request-ID` generated | `X-Frame-Options: DENY`, `X-Request-ID` present | HTTP 200 OK | **GREEN** |
| 2 | **Deep Health Check** | DB connectivity verified, uptime returned | `{ status: "healthy", db: "connected" }` | HTTP 200 OK | **GREEN** |
| 3 | **Authorized Doc Upload** | Upload permitted for self | Doc record created with random filename | HTTP 201 Created | **GREEN** |
| 4 | **IDOR Prevention** | Cross-user doc deletion blocked | `{ error: "Access denied" }` | HTTP 403 Forbidden | **GREEN** |
| 5 | **RBAC Endpoint Protection** | Patient blocked from `/api/admin/users` | `{ error: "Access denied. Required role: ADMIN" }` | HTTP 403 Forbidden | **GREEN** |
| 6 | **Mass Assignment Prevention** | Role escalation attempt ignored/blocked | User registered as `PATIENT`, not `ADMIN` | HTTP 201 Created | **GREEN** |
| 7 | **SQL Injection Defense** | Malicious SQL payload sanitized by Prisma | Search query executed safely with 0 results | HTTP 200 OK | **GREEN** |
| 8 | **Magic Byte Check** | Spoofed file content rejected | `{ error: "File content does not match extension" }` | HTTP 400 Bad Request | **GREEN** |
| 9 | **File Size Limit** | Files > 10MB rejected | `{ error: "File size exceeds 10MB limit" }` | HTTP 400 Bad Request | **GREEN** |
| 10 | **Path Traversal Protection** | Filenames sanitized cleanly | Filename path characters stripped | HTTP 201 Created | **GREEN** |
| 11 | **PII Redaction in Logs** | Emails, phones, OTPs scrubbed | Logs show `y***@domain.com`, `******1234` | Empirical Log Inspection | **GREEN** |
| 12 | **Single-Use OTP & Replay** | Used OTP cannot be re-used | Second OTP submission returns `Invalid OTP` | HTTP 400 Bad Request | **GREEN** |
| 13 | **Database State Persistence**| `isVerified` set to `true` upon verification | Verified in PostgreSQL DB via Prisma | DB State Check | **GREEN** |
| 14 | **Rate Limit Headers** | Standard rate limit headers returned | `RateLimit-Limit: 300`, `RateLimit-Remaining: 299` | HTTP 200 OK | **GREEN** |
| 15 | **Audit Log Generation** | Security events logged to `AuditLog` table | Audit log entries recorded for upload & verify | DB Audit Query | **GREEN** |

---

## 9. Production Deployment Requirements & Known Limitations

### Deployment Requirements
1. **Redis Server:** Provision Redis instance (`redis://...`) and configure `REDIS_URL` in `.env` for multi-instance rate limiting and Socket.IO scaling.
2. **Database Connection Pooling:** Set `DATABASE_URL` with connection limit parameters suitable for backend pool sizes (e.g. `connection_limit=20`).
3. **Environment Secrets:** Ensure `JWT_SECRET`, `BREVO_API_KEY`, and `TEXTBEE_API_KEY` are stored in secure environment secrets managers.

### Known Limitations & Future Enhancements
1. **ClamAV Malware Scanning:** File uploads are validated via MIME type, file size, and magic byte signatures. Integration with an external ClamAV scanning daemon is recommended for enterprise environments requiring live viral payload scanning.
2. **Client-Side Screenshot Prevention:** Browser UI includes CSS/JS watermark protection overlays; however, hardware-level screen capture cannot be prevented by client code.
