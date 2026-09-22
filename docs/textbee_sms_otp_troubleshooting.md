# CareSetu — TextBee SMS OTP Integration & Troubleshooting Guide

## Executive Summary

- **Issue:** TextBee Gateway returned HTTP 429 (`"Your account has used its 300 messages for the last 30 days."`) when requesting phone verification OTPs.
- **Security Resolution:** Upgraded `textbee.provider.js` and `otp.service.js`:
  1. Internal quota message details (`"300 messages for 30 days"`) are **never leaked** to frontend users.
  2. HTTP 429 quota/rate limit errors are **fast-failed without retries** to prevent quota hammering.
  3. Development mock fallback is strictly guarded by `DEV_OTP_MODE=true` and is **forbidden in production** (`NODE_ENV=production`).
  4. Undelivered SMS OTP records are **automatically deleted from PostgreSQL** upon delivery failure, preventing phantom OTP verification.
  5. Phone numbers are masked in all server logs (`+91 98*** **210`).

---

## 🔍 Root Cause Analysis of TextBee HTTP 429

TextBee free/starter tier imposes a hard limit of 300 SMS messages per 30-day rolling window.

When the CareSetu backend dispatches an SMS via `POST https://api.textbee.dev/api/v1/gateway/send-sms`:
- If the TextBee account has sent 300 SMS messages within 30 days, TextBee returns HTTP 429 (`QUOTA_EXCEEDED`).
- Previously, the provider automatically fell back to returning `{ success: true, mock: true }` when errors occurred in non-production environments.
- The new architecture separates quota failures from dev mode: HTTP 429 returns `success: false` and a user-safe error unless `DEV_OTP_MODE=true` is explicitly configured in local `.env`.

---

## ⚙️ Development Fallback Rules vs Production Rules

### 1. Development Fallback Rules (`DEV_OTP_MODE`)

In local development environments (`NODE_ENV=development`):
- To enable local mock OTP fallback when TextBee gateway is offline or out of quota, set in `backend/.env`:
  ```env
  DEV_OTP_MODE=true
  ```
- When `DEV_OTP_MODE=true` and TextBee credentials are missing, the provider returns `{ success: true, mock: true, deliveryState: 'DEV_MOCK_SENT' }`.
- Plaintext OTPs are **never exposed** in API JSON responses, browser storage, or client URLs.

### 2. Production Security Rules (`NODE_ENV=production`)

In production environments (`NODE_ENV=production`):
- `DEV_OTP_MODE` is **strictly FORBIDDEN and IGNORED**.
- If `DEV_OTP_MODE=true` is set in production `.env`, the server logs a `SECURITY_ALERT` and disables mock fallback automatically.
- Every SMS request requires clean provider acceptance (`ACCEPTED_BY_PROVIDER`).
- Any provider failure (HTTP 429, 401, 503) causes `requestOtp` to reject delivery and delete the pending OTP record from PostgreSQL.

---

## 💳 TextBee Quota & Production Plan Requirements

To restore real SMS delivery to recipient mobile devices:
1. Log into your TextBee account dashboard: [https://textbee.dev](https://textbee.dev).
2. Upgrade your account plan or reset your device gateway quota limit.
3. Ensure `backend/.env` contains valid credentials:
   ```env
   TEXTBEE_API_KEY=your_textbee_api_key_here
   TEXTBEE_DEVICE_ID=your_textbee_device_id_here
   TEXTBEE_BASE_URL=https://api.textbee.dev
   ```

---

## 🧪 Automated Test Results (`backend/tests/textbee.otp.security.test.js`)

- **Command:** `node backend/tests/textbee.otp.security.test.js`
- **Result:** **`22 / 22 PASSED (100% SUCCESS RATE)`**

| Test Case | Result | Summary |
| :--- | :-: | :--- |
| Phone Masking in Logs | **PASS** | Masks phone numbers (`+91 98*** **210`) |
| Dev OTP Mode in Development | **PASS** | Enables dev mock only when `NODE_ENV=development` & `DEV_OTP_MODE=true` |
| Dev OTP Mode Blocked in Production | **PASS** | `isDevOtpModeAllowed` strictly FORBIDDEN in production |
| 429 Quota Error Sanitization | **PASS** | Returns safe user error; **zero internal quota leak** |
| Fast-Fail 429 Quota Policy | **PASS** | Stops retrying immediately on HTTP 429 |
| HTTP 401 & 403 Error Mapping | **PASS** | Maps `AUTH_FAILURE` state correctly |
| HTTP 5xx Bounded Retries | **PASS** | Retries 5xx server errors up to 2 times with backoff |
| Undelivered OTP DB Cleanup | **PASS** | Automatically deletes un-delivered OTP from PostgreSQL |
| Invalid OTP Verification Protection | **PASS** | Prevents verification of undelivered OTP codes |
| Provider 200 Acceptance Handling | **PASS** | Captures `ACCEPTED_BY_PROVIDER` state and messageId |
