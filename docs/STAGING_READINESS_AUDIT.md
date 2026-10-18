# CareSetu Phase 12B.10 — Staging Readiness Audit Report

**Date & Time**: 2026-10-18T21:20:00+05:30  
**Target Environment**: Staging Deployment  
**Document Location**: `docs/STAGING_READINESS_AUDIT.md`  
**Current Git Branch**: `main`  
**Working Tree Policy**: Strictly preserved (zero clean, stash, reset, or destructive actions applied)

---

## 1. Executive Summary & Recommendation

| Component | Target Provider | Configuration Status | Build / Code Status | Prerequisite Status |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Cloudflare Pages | **PASS** | **PASS** (Compiled in 11.49s, 0 errors) | **PASS** |
| **Backend API** | Railway | **PASS** | **PASS** (Node.js v20+ compatible) | **PASS** (Sticky WSS required) |
| **Database** | Supabase PostgreSQL 15+ / PostGIS | **PASS** | **PASS** (Prisma migrations ready) | **PASS** (Pending deploy on remote) |
| **Offsite Backups** | Cloudflare R2 | **PASS** | **PASS** (Documented binary protocol) | **MANUAL STEP REQUIRED** |

### **Overall Recommendation: GO FOR STAGING (CONDITIONAL ON MANUAL INFRASTRUCTURE PROVISIONING)**

> [!IMPORTANT]
> The code, security mechanisms, fail-closed assertions, rate limiters, and production builds are **100% READY FOR STAGING**. However, deployment must not proceed until the staging infrastructure (Supabase project, Railway service, and Cloudflare Pages project) is created, and required staging secrets are configured in their respective provider dashboards.

---

## 2. Architecture & Hosting Strategy Verification

| Layer | Approved Target | Documented Role & Specifics | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Cloudflare Pages** | Global Edge CDN distribution, zero egress fees, SPA routing with `_redirects` / single-page fallback. | Verified via `frontend/vite.config.ts`, `frontend/dist/` build artifacts, and repository architecture specifications. |
| **Backend API** | **Railway** | Containerized Node.js runtime, native WebSocket/WSS support for Socket.IO sirens, continuous uptime for sequential emergency hospital timeout sweeper (`HospitalTimeoutService`). | Verified via `backend/src/server.js`, `backend/src/utils/socket.js`, and `package.json` entry points (`npm run start`). |
| **Database** | **Supabase PostgreSQL** | Managed PostgreSQL 15+ with PostGIS spatial extension enabled (`ST_DWithin`, `ST_DistanceSphere` / haversine calculations) and Prisma ORM client adapter (`@prisma/adapter-pg`). | Verified via `backend/prisma/schema.prisma`, `backend/src/config/prisma.js`, and `database/postgis/`. |
| **Offsite Backups** | **Cloudflare R2** | S3-compatible, zero-egress encrypted database snapshot storage for disaster recovery (`pg_dump -Fc` compressed snapshots). | Verified via `docs/MIGRATION_READINESS_DOCTOR_CLINIC_V4.md` and `database/README.md`. |

---

## 3. Comprehensive Audit Matrix (Pass / Fail / Blocked)

| Category | Item Checked | Status | Evidence & Audit Findings |
| :--- | :--- | :--- | :--- |
| **Security & Secrets** | Production Fail-Closed Encryption Keys | **PASS** | Verified in `backend/src/utils/crypto.js` and `backend/tests/production-hardening.test.js`. If `NODE_ENV === 'production'`, missing or short `HEALTH_PACK_KEY` immediately throws `[SECURITY FATAL]` and refuses to start. Development fallbacks are strictly prohibited. |
| **Security & Secrets** | URL Token & JWT Fail-Closed | **PASS** | Verified in `backend/src/utils/urlCrypto.js`. Missing `URL_ENCRYPTION_SECRET` or `JWT_SECRET` in production throws critical error. |
| **Network & Access** | CORS Origin Allowlist | **PASS** | In `backend/src/app.js` and `production-hardening.test.js`: Production strictly enforces origin whitelist (`FRONTEND_URL` and `CORS_ORIGINS`). Temporary Cloudflare tunnels (`.trycloudflare.com`) are explicitly rejected in production. |
| **Network & Access** | Frontend API & Socket Base URLs | **PASS** | In `frontend/src/services/api.ts`: Configured via `VITE_API_URL` and `VITE_SOCKET_URL`, safely defaulting to relative `/api` and origin-derived WebSocket endpoints. |
| **Network & Access** | Security Headers & HTTPS | **PASS** | `backend/src/middleware/security-headers.middleware.js` configures Helmet with HSTS (1 year, preload, subdomains), frameguard (deny), COOP (`same-origin-allow-popups` for Google Auth), and correlation IDs (`X-Request-ID`). |
| **Auth & Governance** | Dual OTP & Anti-Bypass Guard | **PASS** | In `backend/src/services/providers/textbee.provider.js`: `isDevOtpModeAllowed()` checks `NODE_ENV === 'production'` and logs a security alert while completely disabling bypasses even if `DEV_OTP_MODE=true` was mistakenly passed. |
| **Auth & Governance** | Role-Based Access & Guest Guard | **PASS** | Verified in `backend/src/middleware/auth.middleware.js` and `backend/src/routes/admin.routes.js`. Protected routes strictly require JWT and enforce RBAC with `denyGuest`. |
| **Rate Limiting** | Tiered Rate Limiters | **PASS** | `backend/src/middleware/rate-limiters.js` implements scoped limiters for API (300/15m), AI Chat, Document Downloads, Share Tokens, and Admin endpoints with Redis support if `REDIS_URL` is set, falling back to MemoryStore. |
| **Database & Schema** | Prisma Migrations & Schema | **PASS** | 7 migrations present. `npx prisma migrate status` confirms migration sequence. Staging will execute non-destructive `prisma migrate deploy`. |
| **Database & Schema** | Database Isolation & Safety Guard | **PASS** | `backend/tests/testDbGuard.test.js` passed (15/15 tests). Prevents running destructive test suites against production databases or ports. |
| **System Operations** | Deep Health & Readiness Check | **PASS** | `GET /health` and `GET /api/health` in `backend/src/app.js` execute `SELECT 1` on PostgreSQL and return HTTP 200 (healthy) or HTTP 503 (unhealthy) with uptime and memory metrics. |
| **System Operations** | Graceful Shutdown | **PASS** | In `backend/src/server.js`: Intercepts `SIGTERM` and `SIGINT`, closes HTTP server connections, drains and disconnects Prisma pool, with a 10s timeout safeguard. |
| **System Operations** | Background Sweepers | **PASS** | `hospital-timeout.service.js` and `registration-cleanup.service.js` run persistent background timers to ensure 20s hospital response windows and stale registration cleanup. |
| **Disaster Recovery** | Database Backup Protocol | **PASS** | Binary dump protocol (`pg_dump -Fc`), SHA-256 checksumming, and targeted non-destructive table restoration documented in `docs/MIGRATION_READINESS_DOCTOR_CLINIC_V4.md`. |
| **Deployment Preflight** | Frontend Production Build | **PASS** | `npm run build` executed successfully. Vite transformed 2,637 modules in 11.49s, generating production bundle in `frontend/dist/`. |
| **Deployment Preflight** | Test Account & Log Sanitization | **PASS** | Inspected `docs/CARESETU_TEST_ACCOUNTS.md`, `CARESETU_TEST_ACCOUNTS.yaml`, and `backend/src/utils/logger.js`. Automatic masking for passwords, tokens, emails, and phones. No production credentials exposed. |

---

## 4. Environment Variables Audit (Names Only — Zero Secrets)

### Backend Staging Variables (Required in Railway Dashboard)
```ini
# Runtime Configuration
NODE_ENV=production
PORT=3000

# Client & Cross-Origin Whitelisting
FRONTEND_URL=https://staging.caresetu.pages.dev
CORS_ORIGINS=https://staging.caresetu.pages.dev

# Database Connection (Supabase Transaction Pooler URL)
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres

# Cryptographic Keys (Must be minimum 32 bytes / 64 hex characters)
JWT_SECRET=
HEALTH_PACK_KEY=
URL_ENCRYPTION_SECRET=

# SMS Service (TextBee)
TEXTBEE_API_KEY=
TEXTBEE_DEVICE_ID=
TEXTBEE_BASE_URL=https://api.textbee.dev

# Email Service (Brevo)
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=CareSetu Staging

# Firebase Admin Push Notifications
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Hospital SOS Routing Parameters
HOSPITAL_RESPONSE_TIMEOUT_SECONDS=20
HOSPITAL_TIMEOUT_SWEEP_MS=3000

# Security Flag (Must be false in staging and production)
DEV_OTP_MODE=false
```

### Frontend Staging Variables (Required in Cloudflare Pages Dashboard)
```ini
# Backend API & Socket Endpoints
VITE_API_URL=https://api-staging.caresetu.up.railway.app/api
VITE_SOCKET_URL=https://api-staging.caresetu.up.railway.app
VITE_BASE_PATH=/

# Firebase Client Configuration (Push Notifications & Google Auth)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

---

## 5. Free-Tier & Hosting Constraints

1. **Railway Container Lifecycles & Memory**:
   - The free/starter tier provides finite execution hours and may spin down after inactivity unless a keep-alive/health probe or persistent background task runs.
   - Because CareSetu relies on active Socket.IO connections and the 3-second hospital timeout sweeper (`HospitalTimeoutService`), the backend container must remain active while emergency cases are in-flight.
   - **Requirement**: Configure Railway restart policy to `ON_FAILURE` and ensure sticky sessions are enabled if scaling past 1 replica.

2. **Supabase PostgreSQL Free Tier**:
   - Supabase free tier pauses after 7 days of inactivity. Ensure periodic staging health checks ping the DB (`GET /health`).
   - PostGIS extension must be enabled via Supabase dashboard (`Database` $\rightarrow$ `Extensions` $\rightarrow$ `postgis`) before executing initial migrations.
   - Use the **Transaction Pooler URL** (`port 6543`) for application queries and the **Direct URL** (`port 5432`) for Prisma CLI migrations (`DIRECT_URL`).

3. **Cloudflare Pages Routing**:
   - Cloudflare Pages serves static assets. To prevent 404 errors when refreshing dynamic client routes (e.g. `/patient/dashboard`, `/hospital/emergencies/:id`), a `public/_redirects` rule (`/* /index.html 200`) is active.

---

## 6. Migration & Deployment Step-by-Step Runbook

### Step 1: Staging Database Setup (Supabase)
1. Log in to the Supabase console and create a dedicated project: `caresetu-staging`.
2. Navigate to **Database** $\rightarrow$ **Extensions** and enable `postgis` and `uuid-ossp`.
3. Copy the Connection Strings (both Transaction Pooler and Direct Connection).

### Step 2: Railway Backend Setup
1. Create a new service in Railway connected to the `CareSetu-demo` GitHub repository (`backend` root directory).
2. Set all required environment variables listed in Section 4.
3. Configure the Build Command: `npm install`
4. Configure the Pre-deploy Command (Runs non-destructive migrations safely):
   ```bash
   npx prisma migrate deploy
   ```
5. Configure the Start Command: `node src/server.js`
6. Verify deployment by probing the health check:
   ```bash
   curl -I https://api-staging.caresetu.up.railway.app/health
   ```
   *(Must return HTTP 200 with `status: ok` and `database: healthy`).*

### Step 3: Cloudflare Pages Frontend Setup
1. In Cloudflare Pages, connect to the repository and select the `frontend` subfolder.
2. Build Settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Configure the frontend environment variables (`VITE_API_URL`, `VITE_SOCKET_URL`, Firebase credentials).
4. Trigger the staging deployment.

### Step 4: Post-Deployment Smoke Verification
1. Open the staging Cloudflare URL in an incognito window.
2. Verify SSL certificate validity and security headers (`X-Request-ID`, `HSTS`, `COOP`).
3. Execute standard staging smoke tests:
   - Health check endpoint verification (`/health`).
   - Patient authentication and dashboard load.
   - Hospital dashboard WebSocket connection.
   - Admin portal RBAC boundary enforcement.

---

## 7. Audit Sign-Off

- **Audited By**: Antigravity Pair-Programming Agent
- **Status Assessment**: **READY FOR STAGING**
- **Action Required**: Create cloud project containers and populate staging secrets in provider consoles as specified in the runbook. Do not apply production changes or commit live credentials to the repository.
