# CareSetu — Login Authentication 401 & Socket.IO Connection Debug Report

## Executive Summary

This report documents the root-cause investigation, fixes, and empirical verification for the **Login 401 Unauthorized** error and **Socket.IO Connection / Disconnect** instability in the CareSetu platform.

---

## 🔍 Part 1 — Login HTTP 401 Root Cause Analysis & Fix

### 1. Root Cause Analysis
- **Unseeded Local Database:** The local PostgreSQL database contained no seeded accounts (`patient@test.com`, `shreekrishna@caresetu.com`, `admin@caresetu.com`). Attempts to log in with test credentials caused `prisma.user.findUnique({ where: { email } })` to return `null`, correctly triggering an HTTP 401 Unauthorized (`Invalid email or password.`).
- **Default Frontend Input Value:** The login page input default state was initialized to `patient@caresetu.com`, which did not match the seeded patient account `patient@test.com`.

### 2. Resolution & Fixes Applied
- **Database Seeding:** Executed `node seed.js` to populate test accounts (`patient@test.com`, `shreekrishna@caresetu.com`, `admin@caresetu.com`).
- **Frontend Preset Value:** Updated `LoginPage.tsx` default state to `patient@test.com`.
- **BCrypt Compatibility:** Confirmed both native `bcrypt` (used in controllers) and `bcryptjs` (used in seed) successfully verify hashed passwords.

### 3. Login Verification Results
- `POST /api/auth/login` with `patient@test.com` / `password123` -> **HTTP 200 OK** (Returned signed JWT token & user payload).
- `POST /api/auth/login` with invalid password -> **HTTP 401 Unauthorized** (Returned generic `Invalid email or password.` message without account enumeration leak).
- `POST /api/auth/login` with `BLOCKED` account -> **HTTP 403 Forbidden**.

---

## 🔌 Part 2 — Socket.IO Connection Stability Analysis & Fix

### 1. Root Cause Analysis
- **Unbounded Reconnection Loops:** The Socket.IO client in `SocketContext.tsx` was configured with `reconnectionAttempts: 8` and `reconnectionDelay: 1000`. On unauthenticated pages or when auth tokens expired, Socket.IO repeatedly attempted reconnection, flooding the network tab with `xhr poll` errors and `ERR_CONNECTION_REFUSED`.
- **Component Lifecycle Re-initialization:** The `useEffect` hook depended on the mutable `user` object reference rather than stable primitive values (`user?.id`, `user?.role`), causing socket destruction and re-creation on every re-render.
- **Unauthenticated Socket Connections:** Guests without session tokens attempted connection without authorization headers, causing backend rejection (`new Error('No token')`).

### 2. Resolution & Fixes Applied
- **Managed Socket Lifecycle (`SocketContext.tsx`):**
  - Added a persistent `socketRef` to maintain a single socket instance per active user session.
  - Updated `useEffect` dependency array to `[user?.id, user?.role]` to prevent socket re-creation during parent component re-renders.
  - Added early check: If no token or user is active, any existing socket instance is cleanly disconnected (`socketRef.current.disconnect()`).
  - Added bounded backoff strategy (`reconnectionAttempts: 5`, `reconnectionDelay: 2000`, `reconnectionDelayMax: 10000`).
  - Added early disconnect handler on `"Invalid token"` or `"No token"` `connect_error` events to prevent endless polling.

- **Backend Room Authorization (`socket.js`):**
  - Confirmed Socket.IO server is attached to the same HTTP server on port 3000.
  - Confirmed path `/socket.io` matches frontend `SOCKET_URL`.
  - Enforced strict room joining rules: Guests join `guest:${userId}` rooms; unauthorized requests to join private user rooms (`user:${uId}`) are blocked and logged.

---

## 🧪 Empirical Verification Evidence

### 1. Automated Auth Security Tests (`backend/tests/auth.security.test.js`)
- `POST /api/auth/login` Valid Credentials: **PASS (HTTP 200 OK)**
- `POST /api/auth/login` Invalid Password: **PASS (HTTP 401 Unauthorized)**
- User Enumeration Protection: **PASS (Identical generic error message)**
- Password Hash Storage: **PASS (Bcrypt salt rounds 10/12)**

### 2. Automated Google OAuth Security Tests (`backend/tests/google.oauth.security.test.js`)
- Executed 21 assertions: **21 / 21 Passed (100%)**

### 3. Frontend TypeScript Compiler (`npx tsc --noEmit`)
- Executed type checking across all React components.
- **Result:** **0 errors (Exit code 0)**.

---

## 📁 Files Changed & Created

| File Path | Action | Description |
|---|---|---|
| [`frontend/src/context/SocketContext.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/context/SocketContext.tsx) | **MODIFIED** | Added single `socketRef` management, bounded reconnection, and unauthenticated guard |
| [`frontend/src/pages/auth/LoginPage.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/auth/LoginPage.tsx) | **MODIFIED** | Updated default email state to `patient@test.com` |
| [`backend/scratch/test_login_debug.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/scratch/test_login_debug.js) | **NEW** | Database user & bcrypt hash comparison diagnostic script |
| [`docs/login_and_socketio_debug_report.md`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/docs/login_and_socketio_debug_report.md) | **NEW** | Complete debug & verification report |

---

## 📌 Remaining Limitations & Production Notes

1. **HTTPS in Production:** Socket.IO secure WebSockets (`wss://`) must be used in production when frontend and backend are served over HTTPS.
2. **IP Whitelisting for SMS/Email Providers:** Brevo Email OTP requires IP authorization in production if restricted IP policy is enabled in the Brevo dashboard.
