# CareSetu — Brevo Email OTP Integration & Troubleshooting Guide

## Executive Summary

- **Issue:** `POST /api/auth/request-otp` returned HTTP 502 due to Brevo REST API returning HTTP 401 Unauthorized (`"Server IP 152.58.37.157 is not authorized"`).
- **Security Resolution:** Upgraded `brevo.provider.js` and `otp.service.js` to handle provider rejections safely:
  1. Internal server IP addresses (`152.58.37.157`) and diagnostic URLs are **never leaked** in user-facing HTTP responses or frontend errors.
  2. HTTP 401 Authorization errors are **fast-failed without retries** (retrying unauthorized requests is ineffective and wastes resources).
  3. Undelivered OTP records are **automatically deleted from PostgreSQL** upon delivery failure, preventing verification of phantom/undelivered OTP codes.
  4. User receives a clean, non-leaking message: `"Email verification is temporarily unavailable. Please try again later."`

---

## 🔍 Root Cause Analysis of Brevo HTTP 401

Brevo (formerly Sendinblue) enforces IP Whitelisting security on API keys created with authorized IP restrictions.

When the CareSetu backend server makes an API request to `https://api.brevo.com/v3/smtp/email`:
- If the server's egress IP address (`152.58.37.157`) is not listed under Brevo's **Authorized IPs**, Brevo rejects the request with HTTP 401 Unauthorized.
- Previously, the backend forwarded this raw Brevo error string to the client browser, causing internal IP exposure and a 502 Bad Gateway response.

---

## 🛠️ Step-by-Step Fixes for Local Development & Production

### 1. Local Development (Authorizing Current IP)

To authorize your local development machine IP (`152.58.37.157`):
1. Log into your Brevo account dashboard: [https://app.brevo.com/security/authorised_ips](https://app.brevo.com/security/authorised_ips).
2. Click **Add an IP address**.
3. Add your current public IP address (e.g. `152.58.37.157`).
4. Alternatively, if your ISP uses dynamic IP addresses during development, you may temporarily disable the "Authorized IPs" restriction on your Brevo API key under **API Keys & Authorized IPs**.

### 2. Production Recommendation (Fixed Egress IP / NAT Gateway)

In production cloud environments (AWS EC2/ECS, GCP Cloud Run, Azure App Service):
- Configure a **Static Egress NAT Gateway** or **Elastic IP** for outbound traffic.
- Whitelist the static egress IP in the Brevo Security Settings.
- Never use dynamic or wildcard IPs for production Brevo API keys.

---

## ⚙️ Required Environment Variables

Ensure `backend/.env` contains valid credentials:

```env
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BREVO_SENDER_EMAIL=support@caresetu.in
BREVO_SENDER_NAME=CareSetu Support
BREVO_BASE_URL=https://api.brevo.com
```

> **Security Rule:** Never log or commit `BREVO_API_KEY` to source control or client bundles.

---

## 🔒 Security & Sanitization Architecture

```
Client Browser (Register / OTP Page)
              |
              | POST /api/auth/request-otp
              v
Backend auth.controller.js -> otp.service.js
              |
              v
       brevo.provider.js (POST https://api.brevo.com/v3/smtp/email)
              |
        [HTTP 401 Unauthorized]
              |
              +---> 1. Internal Server Console: Logs IP 152.58.37.157 diagnostic
              |
              +---> 2. DB Cleanup: Deletes un-delivered OTP record from PostgreSQL
              |
              +---> 3. Client HTTP 502 Payload:
                       { "error": "Email verification is temporarily unavailable. Please try again later." }
                       (Zero IP / Secret / Link Exposure)
```

---

## 🧪 Diagnostic Tools & Automated Test Results

### 1. Development Diagnostic Command (No Email Sent)

Run the non-destructive server-side Brevo diagnostic script to verify API key and IP authorization status:

```bash
node backend/scripts/check-brevo-auth.js
```

### 2. Protected Admin Health Check Endpoint

System administrators can check Brevo API status via the authenticated endpoint:
- **Route:** `GET /api/admin/system/brevo-health`
- **Access:** Requires `ADMIN` JWT authorization.

### 3. Automated Security Test Results (`backend/tests/brevo.otp.security.test.js`)

- **Command:** `node backend/tests/brevo.otp.security.test.js`
- **Result:** **`23 / 23 PASSED (100% SUCCESS RATE)`**

| Test Case | Result | Summary |
| :--- | :-: | :--- |
| Missing Configuration Check | **PASS** | Safely detects missing `BREVO_API_KEY` without crashing |
| Email Masking in Logs | **PASS** | Masks recipient emails (`u***t@example.com`) |
| 401 Error Sanitization | **PASS** | Returns sanitized user message; no IP (`152.58.37.157`) leaked |
| No Retry for 401 Authorization Error | **PASS** | Fast-fails 401 on attempt 1 without redundant retries |
| HTTP 403 & 429 Error Mapping | **PASS** | Maps `FORBIDDEN` and `RATE_LIMIT` states correctly |
| HTTP 5xx Bounded Retries | **PASS** | Retries 5xx server errors up to 2 times with exponential backoff |
| Undelivered OTP DB Cleanup | **PASS** | Automatically deletes un-delivered OTP from DB |
| Invalid OTP Verification Protection | **PASS** | Prevents verification of undelivered OTP codes |
| Provider 201 Acceptance Handling | **PASS** | Captures `ACCEPTED_BY_PROVIDER` state and messageId |

---

## 📌 Limitations & Real Delivery Requirements

- **Provider Acceptance vs. Inbox Delivery:** Receiving `ACCEPTED_BY_PROVIDER` (HTTP 201) indicates Brevo accepted the transaction into its delivery queue. Actual inbox delivery depends on recipient server policies, DMARC/SPF verification on your custom domain, and recipient spam filters.
- **DMARC Domain Notice:** Using `@gmail.com` or public webmail addresses in `BREVO_SENDER_EMAIL` may trigger DMARC/SPF bounces by recipient mail servers (Gmail, Yahoo). A verified custom domain (e.g., `@caresetu.in`) is mandatory for production email deliverability.
