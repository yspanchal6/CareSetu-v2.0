##  Security Architecture
*   **Data at Rest/Transit:** AES-256 encryption applied via Node.js native `crypto` for the Emergency Health Pack. Decryption keys exchange strictly upon case `ACCEPTED` status.
*   **Authentication:** Bcrypt password hashing and short-lived JSON Web Tokens (JWTs).
*   **Auditability:** Immutable logging of all Health Pack access events.


```text
                          INCOMING REQUEST
                                 |
                                 v
        +----------------------------------------------+
        |          LAYER 1 — NETWORK SECURITY          |
        |----------------------------------------------|
        |  HTTPS / SSL Certificate (data encrypted)    |
        |  Firewall (only necessary ports open)        |
        |  Rate Limiting (max 100 req/min)             |
        |  DDoS Protection                             |
        +----------------------------------------------+
                                 |
                          (blocked: HTTP, DB port,
                           excess requests)
                                 v
        +----------------------------------------------+
        |     LAYER 2 — AUTHENTICATION (Who are you)   |
        |----------------------------------------------|
        |  Login (email + password)                    |
        |  Password Hashing (bcrypt)                   |
        |  JWT Token (24h valid, sent every request)   |
        |  Session Management                          |
        +----------------------------------------------+
                                 |
                        (invalid creds/token
                              rejected)
                                 v
        +----------------------------------------------+
        |   LAYER 3 — ACCESS AUTHORIZATION (RBAC)      |
        |----------------------------------------------|
        |  Patient Role   Hospital Role   Admin Role   |
        |  own data only  assigned cases  full access  |
        |  send SOS       accept/reject   manage users |
        |  chat with AI   download pack   verify hosp. |
        +----------------------------------------------+
                                 |
                          (role mismatch
                             → blocked)
                                 v
        +----------------------------------------------+
        |       LAYER 4 — INPUT VALIDATION             |
        |----------------------------------------------|
        |  Schema Validation (Zod)                     |
        |  XSS Prevention                              |
        |  CSRF Protection                             |
        |  SQL Injection Prevention                    |
        +----------------------------------------------+
                                 |
                                 v
        +----------------------------------------------+
        |      LAYER 5 — AUDIT & COMPLIANCE            |
        |----------------------------------------------|
        |  Audit Logging                               |
        |  Consent Management                          |
        |  Data Minimization                           |
        |  Privacy Compliance                          |
        +----------------------------------------------+
                                 |
                                 v
                        REQUEST REACHES
                        APPLICATION LOGIC
 
   ────────────────  CROSS-CUTTING: DATA SECURITY  ────────────────
        Encryption at Rest (AES-256) | Encryption in Transit (TLS 1.3)
        Secure File Storage | Database Security Hardening
```

### Layer 1 — Network Security
 
**Purpose:** Checking who is coming from outside into the system
 
| Tool | Function |
|---|---|
| HTTPS (SSL Certificate) | All data encrypted — hackers cannot read it |
| Firewall | Only necessary ports/doors open, rest closed |
| Rate Limiting | Same client can't spam repeatedly — max 100 requests/minute |
| DDoS Protection | Guards against flood attacks |
 
**Example flow:**
```
User → HTTPS → Firewall → Rate Limit → Backend
 
✗ Plain HTTP request        → Blocked (must use HTTPS)
✗ Direct DB port 5432 access → Blocked (database not public)
✗ 200 requests/min from 1 IP → Blocked (exceeds limit)
```
 
---
 
### Layer 2 — Authentication (Proving who you are)
 
**Purpose:** Proving who you are
 
| Tool | Function |
|---|---|
| Login (email + password) | Must have correct email & password |
| Password Hashing (bcrypt) | Password stored encrypted — no raw password ever in DB |
| JWT Token | Issued after login, sent with every request, valid 24 hours |
| Session Management | Tracks active sessions |
 
**Example flow:**
```
S1: User enters email/password
S2: Backend checks credentials
S3: If correct → generate JWT token
S4: Send token to user
S5: User sends token with every subsequent request
S6: Backend verifies token → allows access
```
 
---
 
### Layer 3 — Access Authorization (RBAC)
 
**Purpose:** Access based on your role/authorization
 
| Role | Permissions |
|---|---|
| **Patient** | Can only view own data, send SOS, chat with AI |
| **Hospital** | Can only view assigned cases, accept/reject cases, download Health Pack |
| **Admin** | Can see everything, manage users, verify hospitals |
 
**Example flow:**
```
1) Patient  → /api/admin/users     → ✗ Blocked
2) Hospital → /api/patients/all    → ✗ Blocked
3) Admin    → /api/admin/users     → ✓ Allowed
```
 
---
 
### Layer 4 — Input Validation
 
**Purpose:** Preventing malicious/malformed input from reaching the system
 
- Schema validation (Zod)
- XSS (Cross-Site Scripting) prevention
- CSRF (Cross-Site Request Forgery) protection
- SQL Injection prevention
---
 
### Layer 5 — Audit & Compliance
 
**Purpose:** Traceability and regulatory/privacy compliance
 
- Audit logging
- Consent management
- Data minimization
- Privacy compliance
---
 
### Data Security (cross-cutting)
 
- Encryption at rest: **AES-256**
- Encryption in transit: **TLS 1.3**
- Secure file storage
- Database security hardening

----

