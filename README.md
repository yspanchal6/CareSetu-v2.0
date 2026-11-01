# CareSetu — AI-Integrated Healthcare & Emergency Response Platform

<p align="center" >
  <a href="https://caresetu.pages.dev/"><img src="https://img.shields.io/badge/Live_Deployment-caresetu.pages.dev-0284c7?style=for-the-badge&logo=cloudflarepages&logoColor=white" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-PostGIS-4169e1?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2d3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
   <img src="https://img.shields.io/badge/Frontend/Hostiing-Cloudflare_Pages-f38020?style=for-the-badge&logo=cloudflare" alt="Cloudflare Pages" />
  <img src="https://img.shields.io/badge/Backend-Render.com-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Railway" />
  <img src="https://img.shields.io/badge/DB-Supabase_PostGIS-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase PostGIS" />
  <img src="https://img.shields.io/badge/Security-Hardened-emerald?style=for-the-badge" alt="Security Hardened" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

---
<p align="center">
  🌐 <strong>Deployed Live Application:</strong> <a href="https://caresetu.pages.dev/"><strong>https://caresetu.pages.dev/</strong></a>
</p>

---

## 🌟 Overview

> 🌐 **Live Web Application:** [https://caresetu.pages.dev/](https://caresetu.pages.dev/)  
> *Access real-time emergency SOS routing, AI-assisted triage, encrypted HealthPacks, and multi-portal clinical coordination live in production.*

**CareSetu** is an end-to-end, AI-assisted healthcare coordination and emergency routing platform developed for high-acuity patient triage, location-aware progressive hospital matching, encrypted medical record coordination (HealthPacks), and real-time clinical workflows across Patient, Hospital, Doctor, Clinic, and Admin portals.

The platform is designed to run securely and reliably within approved low-cost and free-tier cloud architectures, maintaining strict boundary enforcement, tamper-evident security epochs, and verifiable disaster recovery procedures.

---

## 🏗️ System Architecture & Data Flow

### 1. High-Level Multi-Tier Architecture

```mermaid
graph TD
    subgraph Client ["Client Layer (Progressive Web App)"]
        PWA["CareSetu React PWA Client"]
        PatientUI["Patient Dashboard & SOS Trigger"]
        HospUI["Hospital Dashboard & Realtime Siren"]
        DocUI["Doctor Case Portal & HealthPack Viewer"]
        Resolver["Opaque Route Resolver (/app/:opaqueId)"]
    end

    subgraph API ["Backend API & Service Layer (Node.js + Express)"]
        Router["Express Router & Rate Limiters"]
        AuthMiddleware["JWT Auth & Role Authorization"]
        CryptoService["AES-256-GCM Payload Encryptor"]
        OpaqueService["Opaque Route Mapper"]
        EmergencyService["Emergency SOS Engine"]
        TimeoutService["Database Timeout Sweep Service"]
        NotificationService["Notification Dispatcher (SMS/Email/Push)"]
    end

    subgraph Data ["Data & Storage Layer"]
        Postgres[("PostgreSQL 16 + PostGIS")]
        PrismaORM["Prisma ORM Model Mapping"]
    end

    subgraph External ["External Integration Providers"]
        TextBee["TextBee SMS Gateway"]
        Brevo["Brevo Email Provider"]
        FCM["Firebase Cloud Messaging"]
        AIService["Python AI Triage Sidecar"]
    end

    Client --> Router
    Router --> AuthMiddleware
    AuthMiddleware --> EmergencyService
    AuthMiddleware --> OpaqueService
    EmergencyService --> TimeoutService
    EmergencyService --> CryptoService
    EmergencyService --> PrismaORM
    TimeoutService --> PrismaORM
    PrismaORM --> Postgres
    NotificationService --> TextBee
    NotificationService --> Brevo
    NotificationService --> FCM
    EmergencyService --> AIService
```

---

## 🔄 System Flowcharts & Lifecycles

### 🚨 2. Emergency SOS Timeout & Hospital Reassignment Flowchart

```mermaid
flowchart TD
    Start([Patient Triggers SOS / AI Triage]) --> Match[Progressive Radius Search<br/>8km ➔ 16km ➔ 32km ➔ 64km]
    Match --> TargetCandidate[Target Candidate 0<br/>Set requestedAt = NOW, status = PENDING]
    TargetCandidate --> QueueOthers[Queue Candidates 1..N-1<br/>Set requestedAt = NULL, status = PENDING]

    TargetCandidate --> ActiveTimer{Hospital Responds<br/>Within 20s Window?}

    ActiveTimer -- Yes: ACCEPT --> AcceptCase[Hospital Clicks ACCEPT<br/>Assign hospitalId & update status = TRANSFER]
    AcceptCase --> EscalateSeverity[Atomically Update Severity GREEN ➔ RED]
    EscalateSeverity --> SharePack[Auto-Share Patient HealthPack]
    SharePack --> NotifyAll[Emit Socket.IO & Push Alerts<br/>Patient + Hospital Dashboards]
    NotifyAll --> Closed([Emergency Transfer Active])

    ActiveTimer -- No: Timeout Expired --> SweepSweep[Timeout Sweep SweepExpiredRequests<br/>Mark Request = EXPIRED]
    SweepSweep --> NextCandidate{More Candidate<br/>Hospitals Available?}

    NextCandidate -- Yes --> ActivateNext[Activate Candidate N+1<br/>Set requestedAt = NOW]
    ActivateNext --> ActiveTimer

    NextCandidate -- No --> ExpireCase[Mark Case = EXPIRED<br/>Emit emergency:no-hospital]
    ExpireCase --> End([No Hospital Responded])

    ActiveTimer -- Yes: CANNOT HANDLE --> RejectCase[Hospital Clicks Reject<br/>Mark Request = REJECTED]
    RejectCase --> NextCandidate
```

---

### 🛡️ 3. Direct SOS Acceptance & Severity Escalation (GREEN ➔ RED) Flowchart

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant API as Express API
    participant DB as PostgreSQL (Prisma)
    actor Hospital
    participant Sockets as Socket.IO Server

    Patient->>API: POST /api/emergency/sos (Severity: GREEN / Direct SOS)
    API->>DB: Create EmergencyCase (status: PENDING, severity: GREEN)
    API->>DB: Create HospitalRequest (hospital 0, requestedAt: NOW)
    API->>Sockets: Emit emergency:request-sent to Hospital Dashboard
    Hospital->>Sockets: Receive SOS Card Alert (Timer Countdown: 20s)

    Hospital->>API: POST /api/emergency/accept/:caseId
    API->>DB: Validate Hospital Verification & Active PENDING Request

    rect rgb(245, 230, 230)
        note over API,DB: Atomic Severity & Status Transition
        API->>DB: Update EmergencyCase set hospitalId = hospital.id, status = 'TRANSFER', severity = 'RED'
        API->>DB: Update HospitalRequest set status = 'ACCEPTED'
        API->>DB: Update Other Pending Requests set status = 'REJECTED'
    end

    API->>DB: Auto-Share Patient HealthPack with Hospital
    API-->>Hospital: 200 OK (Status: TRANSFER, Severity: RED, HealthPack Shared)

    API->>Sockets: Emit case:accepted & transfer:started (Severity: RED) to Patient
    API->>Sockets: Emit case:assigned-to-us to Accepting Hospital
    API->>Sockets: Emit case:closed-elsewhere to Other Candidate Hospitals
```

---

### 🔑 4. ChatGPT-Style Opaque URL & AES-256-GCM Encryption Flowchart

```mermaid
flowchart LR
    subgraph Client ["Client Browser"]
        Nav["Patient / User Navigates to /app/a8F3kL9xQ2mR7vT1"]
        Resolver["OpaqueRouteResolver Component"]
        RenderUI["Render Permitted Internal View"]
    end

    subgraph Backend ["CareSetu Express Server"]
        ApiEndpoint["GET /api/opaque-routes/resolve/:opaqueId"]
        CryptoEngine["AES-256-GCM Decryptor / Token Validator"]
        DBCheck[("PostgreSQL lookup opaque_routes")]
    end

    Nav --> Resolver
    Resolver --> ApiEndpoint
    ApiEndpoint --> DBCheck
    DBCheck --> CryptoEngine
    CryptoEngine -- Valid & Authorized --> ReturnMapping["Return Internal Route Destination"]
    CryptoEngine -- Invalid / Expired / Unauthorized --> Reject403["Return 403 / 404 Error"]
    ReturnMapping --> RenderUI
```

---

### 📱 5. Dual OTP (SMS & Email 2FA) Registration Verification Flowchart

```mermaid
flowchart TD
    StartReg([User Fills Registration Form]) --> Step1[Input Phone Number +91 XXXXXXXXXX]
    Step1 --> ReqSMS[Click Verify Phone<br/>POST /api/auth/request-otp]
    ReqSMS --> TextBee[TextBee SMS Gateway Dispatches 6-Digit OTP]
    TextBee --> InputSMS[User Inputs SMS OTP]
    InputSMS --> VerifySMS[POST /api/auth/verify-otp]
    VerifySMS --> SMSBadge[Phone Verified Badge Activated]

    SMSBadge --> Step2[Input Email Address]
    Step2 --> ReqEmail[Click Verify Email<br/>POST /api/auth/request-otp]
    ReqEmail --> Brevo[Brevo SMTP Gateway Dispatches 6-Digit OTP]
    Brevo --> InputEmail[User Inputs Email OTP]
    InputEmail --> VerifyEmail[POST /api/auth/verify-otp]
    VerifyEmail --> EmailBadge[Email Verified Badge Activated]

    EmailBadge --> SubmitForm[Click Complete Registration<br/>POST /api/auth/register]
    SubmitForm --> DBValidate{Database Validates Both<br/>OTP Records Verified?}
    DBValidate -- Yes --> AccountCreated([User Account Created Successfully])
    DBValidate -- No --> RejectRegistration([HTTP 400 Registration Blocked])
```

---

## 🚀 Key Features & Architectural Capabilities

### 🆘 Emergency SOS & Intelligent Hospital Routing
* **Direct SOS & AI Triage**: One-click Emergency SOS activation with GPS coordinate transmission and AI-assisted symptom triage.
* **Progressive Radius Search**: Automatically expands hospital search radius progressively (8km → 16km → 32km → 64km) based on real-time availability and specialized clinical capability.
* **Persistent Hospital Timeout Sweeps**: Database-persisted sequential target dispatch (`HospitalRequest.requestedAt`). Hospitals have a 20-second target window to accept before auto-reassignment to the next candidate hospital.
* **Atomic Severity Escalation (GREEN ➔ RED)**: Accepting a qualifying Direct SOS case atomically updates case severity from `GREEN` to `RED` in PostgreSQL and routes the case into the high-priority Red Flag Service Provider workflow.
* **Filtered Siren & SMS Alerts**: Critical cases (`RED`, `ORANGE`) trigger SMS blasts and high-priority siren alarms; non-critical cases (`GREEN`, `YELLOW`) route through quiet in-app/socket notifications.

### 🔐 Privacy & URL Security Infrastructure
* **ChatGPT-Style Opaque URLs**: Obfuscates internal resource IDs into cryptographically secure random identifiers (e.g. `/app/a8F3kL9xQ2mR7vT1`), preventing IDOR vulnerabilities while supporting SPA navigation, browser refreshes, and deep links.
* **Reversible Payload Encryption**: Backend AES-256-GCM authenticated encryption for sensitive URL share payloads with 12-byte random IVs and 16-byte auth tags.
* **Time-Bound Share Tokens**: Cryptographic single-use public share links for medical records with explicit expiration and revocation support.

### 🩺 HealthPack & Medical Record Management
* **Encrypted Health Packs**: Patient medical history, blood group, allergies, and chronic conditions encrypted at rest and dynamically shared with accepting hospitals.
* **Dual OTP Verification**: Secure registration and password reset workflows enforcing separate 6-digit OTP verifications via SMS (TextBee) and Email (Brevo).

### 📊 Hospital & Doctor Dashboards
* **Real-time Case Processing**: Live Socket.IO updates for incoming emergency cases, active transfers, treatment progress, and capacity management.
* **Emergency Case Cards**: Color-coded clinical severity badges, separated SOS alert sources, patient medical history, dynamic target countdown timers, and action buttons (`✅ ACCEPT`, `❌ CANNOT HANDLE`).

---

## 🛠️ Technology Stack

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client, PWA Service Worker. Hosted on **Cloudflare Pages** (Global Edge CDN, zero egress).
* **Backend**: Node.js 20, Express.js, Prisma ORM 7 (`@prisma/adapter-pg`), Socket.IO, Crypto (AES-256-GCM / AES-256-CBC), Rate Limiters. Hosted on **Render.com** (Native Web Service, continuous deployment from GitHub, WebSocket/WSS support, automatic TLS).
* **Database**: Managed **Supabase PostgreSQL 15+** with PostGIS spatial extension (`ST_DWithin`, `ST_DistanceSphere`).
* **Offsite Storage & Backups**: **Cloudflare R2** (S3-compatible, zero-egress encrypted database snapshots).
* **Integrations**: TextBee (SMS Gateway & OTP), Brevo (Email SMTP & OTP), Firebase Cloud Messaging (FCM Push Alerts).
* **AI Microservices**: Private Python AI Triage / Document OCR Sidecar (isolated behind backend API).

---

## 📦 Installation & Local Setup

### Prerequisites
* **Node.js**: `v20.x` or higher
* **PostgreSQL**: `v16.x` with PostGIS extension enabled
* **Git**

### 1. Clone Repository & Setup Environment
```bash
git clone https://github.com/yspanchal6/CareSetu-v2.0.git
cd CareSetu-demo
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment template
cp .env.example .env

# Generate Prisma Client for PostgreSQL
npx prisma generate

# For development database sync
npx prisma db push

# Start Backend Dev Server
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Start Frontend Dev Server
npm run dev
```

The application will be accessible locally at:
* **Frontend**: `http://localhost:5173`
* **Backend API**: `http://localhost:3000`

---

## 🌐 Approved Production Hosting & Free-Tier Architecture

CareSetu is structured to deploy smoothly across modern, decoupled low-cost and free-tier infrastructure:

| Tier | Provider | Plan & Free-Tier Quota | Production Role & Architectural Safeguards |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Cloudflare Pages** | Free Plan (Unlimited requests, 100 custom domains) | Hosts the production SPA (`dist/`). Global edge CDN, automated TLS/HTTPS, zero egress bandwidth costs. |
| **Backend API** | **Render.com** | Free / Starter Web Service | Runs the Node.js Express & Socket.IO API server. Automated CI/CD deployments from GitHub, native WebSocket (`wss://`) upgrade routing, health checks, and SSL/TLS. |
| **Database** | **Supabase** | Free Plan (500 MB database, PostGIS enabled) | Managed PostgreSQL with PostGIS extension. Connection pooling managed via `@prisma/adapter-pg` (`DATABASE_POOL_MAX=10`). |
| **Offsite Backups** | **Cloudflare R2** | Free Plan (10 GB storage, $0 egress fees) | S3-compatible cold storage for daily encrypted database dumps (`pg_dump -Fc`). |

### Free-Tier Operating Boundaries & Limitations:
* **Render Web Service Operations:** Render free tier services automatically spin down after inactivity and spin back up upon incoming requests. For uninterrupted 24/7 emergency dispatch and database timeout sweeper operations, a persistent background instance or health ping keep-alive is recommended.
* **Supabase Inactivity Pausing:** Supabase free-tier projects auto-pause after 7 days of inactivity. CareSetu's background sweeper and automated health checks maintain active connection heartbeats, but offsite backups to Cloudflare R2 are mandatory.
* **Email Quota (Brevo):** Brevo free tier enforces a strict limit of 300 emails/day. High-volume emergency notifications prioritize SMS (TextBee) and FCM push alerts.
* **SMS Gateway (TextBee):** Requires an active connected Android gateway device for physical SMS dispatch.

---

## 🔑 Production Environment Configuration Dictionary

> [!CAUTION]
> **Zero Exposure Policy:** Never commit `.env` files or log private keys. Values below are configuration reference templates only.

### Backend (`backend/.env` / Render.com Environment)
| Variable | Required Type | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `"production"` | Activates security hardening, blocks arbitrary Cloudflare quick-tunnels, sanitizes error logs. |
| `PORT` | `3000` | Port for Express & Socket.IO HTTP server. |
| `FRONTEND_URL` | URL | Primary allowed origin for CORS and client redirection (`https://caresetu.pages.dev`). |
| `CORS_ORIGINS` | Comma-separated URLs | Trusted production domains (`https://caresetu.in,https://admin.caresetu.in`). |
| `DATABASE_URL` | PostgreSQL URI | Connection string with SSL enabled: `postgresql://user:pass@host:5432/postgres?sslmode=require`. |
| `DATABASE_POOL_MAX` | Integer (`10`) | Safe maximum concurrent database connections per node instance. |
| `DATABASE_POOL_IDLE_TIMEOUT` | Integer (`30000`) | Connection idle timeout in milliseconds (default 30s). |
| `DATABASE_POOL_CONN_TIMEOUT` | Integer (`5000`) | Pool connection wait timeout in milliseconds (default 5s). |
| `JWT_SECRET` | String (≥ 64 chars) | Cryptographically secure secret key for signing user authentication tokens. |
| `HEALTH_PACK_KEY` | 32-byte UTF-8 or 64-hex | AES-256 key for encrypting patient emergency summaries. **Must match existing production key.** |
| `DEV_OTP_MODE` | `false` | Disables static `123456` OTP bypass; enforces real SMS/Email OTP delivery. |
| `TEXTBEE_API_KEY` | String | API key for TextBee SMS Gateway (SMS Red Alerts & phone OTPs). |
| `TEXTBEE_DEVICE_ID` | String | Physical Android device gateway identifier. |
| `TEXTBEE_BASE_URL` | URL | Default: `https://api.textbee.dev`. |
| `BREVO_API_KEY` | String | API key for Brevo transactional email delivery. |
| `BREVO_SENDER_EMAIL` | Email address | Verified sender email (`alerts@caresetu.in`). |
| `BREVO_SENDER_NAME` | String | Default: `CareSetu Emergency Network`. |
| `FIREBASE_PROJECT_ID` | String | Firebase Admin project ID for FCM push alerts. |
| `FIREBASE_CLIENT_EMAIL` | String | Firebase service account email. |
| `FIREBASE_PRIVATE_KEY` | PEM string | RSA private key for Firebase Admin SDK. |

### Frontend (`frontend/.env.production` / Cloudflare Pages)
| Variable | Required Type | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | URL | Backend API endpoint base: `https://api.caresetu.in/api`. |
| `VITE_SOCKET_URL` | URL | Real-time Socket.IO base: `https://api.caresetu.in`. |
| `VITE_BASE_PATH` | String | Default: `/`. |
| `VITE_FIREBASE_API_KEY` | String | Firebase web client API key for in-browser push alerts. |
| `VITE_FIREBASE_PROJECT_ID` | String | Firebase web application project ID. |
| `VITE_FIREBASE_VAPID_KEY` | String | Web push public VAPID key. |

---

## 🗄️ Database Migrations & Safe Deployment Procedures

### 1. Pre-Migration Safety Rules
* **Never run `npx prisma db push` against production.** It can drop columns or relations without warning.
* **Always take a binary backup snapshot before applying migrations:**
  ```bash
  pg_dump "${DATABASE_URL}" -Fc -f "/backups/pre_migrate_$(date +%Y%m%d).dump"
  ```
* **Run Doctor-Staff Pre-Migration Audit:**
  ```bash
  cd backend
  node scripts/pre-migration-doctor-audit.js
  ```
  Must verify `0 duplicate / ambiguous matches found`.

### 2. Executing Migrations in Production
```bash
cd backend

# Applies all committed migrations in backend/prisma/migrations/ in sequence
npx prisma migrate deploy

# Run race-safe idempotent doctor staff linking
node scripts/backfill-doctor-staff.js
```

---

## 🛡️ Backup & Disaster Recovery Architecture

### Distinction of Availability Concepts:
* **Database Backup (Cold Storage):** A point-in-time snapshot file (`.dump`) saved in an independent cloud region (Cloudflare R2). If the primary database fails or data is corrupted, data is restored into a clean database. (RPO: 24h, RTO: 30-45m).
* **Database Replica (Warm Standby):** A continuously synchronized read-only PostgreSQL instance streaming WAL logs. Allows near-zero RPO read-failover. *(Requires Supabase Pro or dedicated managed DB cluster).*
* **Standby Backend:** A secondary dormant or minimal Node.js instance on an independent host (e.g. Fly.io or Railway) configured with identical environment variables, ready to receive traffic if Render experiences downtime.

### Recovery Targets:
* **Recovery Point Objective (RPO):** Maximum 24 hours (daily cold snapshots) on Free Tier; near-zero with WAL archiving.
* **Recovery Time Objective (RTO):** Maximum 30 minutes to restore a binary dump into a new database and update connection strings.

```mermaid
flowchart TD
    subgraph Primary ["Primary Live Infrastructure"]
        SupabaseLive[("Supabase Live DB (Primary)")]
        RenderLive["Render Backend (Active)"]
    end

    subgraph BackupPipeline ["Automated Daily Backup Pipeline"]
        CronTrigger["Scheduled GitHub Action / Worker (02:00 UTC)"]
        DumpJob["pg_dump -Fc (Custom Binary Format)"]
        VerifyChecksum["SHA-256 Checksum Verification"]
        R2Upload["Upload to Cloudflare R2 (Offsite / Multi-Region)"]
    end

    subgraph DisasterRecovery ["Disaster Recovery Scenarios"]
        SupaOutage{Supabase Primary Outage?}
        RenderOutage{Render Web Service Outage?}
        SupaOutage -- Yes --> SpinNewDB["Provision Standby PostgreSQL"]
        SpinNewDB --> FetchR2["Download Latest Dump from R2"]
        FetchR2 --> RestoreDB["pg_restore --clean --if-exists"]
        RestoreDB --> UpdateDBURL["Update DATABASE_URL in Render.com"]

        RenderOutage -- Yes --> SpinStandby["Spin Standby Node / Fly.io"]
        SpinStandby --> SwitchDNS["Switch API CNAME / DNS Routing"]
    end

    SupabaseLive --> DumpJob
    CronTrigger --> DumpJob
    DumpJob --> VerifyChecksum
    VerifyChecksum --> R2Upload
```

### Restore Rehearsal Procedure (Disposable DB):
```bash
# 1. Download backup snapshot from R2
aws s3 cp "s3://${R2_BUCKET_NAME}/daily/<BACKUP_NAME>.dump" ./latest.dump \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# 2. Restore into target database
pg_restore -d "${RESTORE_TARGET_DATABASE_URL}" --clean --if-exists --no-owner ./latest.dump

# 3. Verify connectivity & record decryption
cd backend
node tests/verify-db-pool.js
```

---

## 🧪 Testing & Verification

Run backend automated security and workflow test suites:

```bash
# Production Security Hardening Suite (Key enforcement & CORS tunnel restrictions)
node backend/tests/production-hardening.test.js

# Authentication & Password Security Regression Suite
node backend/tests/auth.security.test.js

# Emergency SOS Service Contract & Specialty Filter Suite
node backend/tests/emergency-sos-contract.test.js

# Case Status Transition & Closure Guard Matrix (38 checks)
node backend/tests/case-status-guards.regression.test.js

# Doctor IDOR & HealthPack Scoping Security Suite
node backend/tests/doctor.phase2.authorization.security.test.js

# URL Tokenization & Opaque Route Security Suite
node backend/tests/url-token.security.test.js
```

Run frontend production build & lint verification:
```bash
cd frontend

# Oxlint static code analysis
npm run lint

# TypeScript compilation & Vite production build
npm run build
```

---

## 🔍 Health Checks & Smoke Testing Runbook

### 1. Automated Health Checks
The backend provides a deep health check endpoint at `/health` and `/api/health`:
```bash
curl -s https://api.caresetu.in/health
```
**Expected HTTP 200 Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-10-18T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "uptimeSeconds": 1420
  },
  "memoryUsage": { ... }
}
```

### 2. Post-Deployment Verification Sequence
1. **Public Navigation:** Open `https://caresetu.pages.dev/` — confirm home page, animations, team portraits, and multilingual language switcher operate cleanly.
2. **CORS Rejection Test:**
   ```bash
   curl -H "Origin: https://arbitrary-tunnel.trycloudflare.com" -I https://api.caresetu.in/health
   # Must NOT return Access-Control-Allow-Origin header in production
   ```
3. **WebSocket Engine Handshake:**
   ```bash
   curl -I "https://api.caresetu.in/socket.io/?EIO=4&transport=polling"
   # Must return HTTP 200 with session sid cookie
   ```
4. **Portal Session Verifications:**
   - Log in with Patient test credentials -> verify emergency profile.
   - Log in with Hospital test credentials -> verify active cases dashboard and staff list.
   - Log in with Doctor test credentials -> verify assigned cases.
   - Log in with Admin credentials -> verify security audit logs.
5. **Synthetic Non-Emergency SOS Dispatch:**
   - Create a synthetic test case (`IS_TEST=true`).
   - Confirm hospital dashboard receives real-time card alert.
   - Hospital accepts -> Doctor assigned -> Diagnosis submitted -> Hospital approves -> Case closed.
   - Confirm zero external SMS/emails sent to real phone numbers.

---

## 🔒 Security Requirements & Guidelines

* **Environment Secrets**: Never commit `.env` files or private keys. Set `HEALTH_PACK_KEY` and `JWT_SECRET` in server environment settings.
* **Production Key Protection**: Never rotate or substitute `HEALTH_PACK_KEY` without a safe re-encryption migration, as existing medical records would become unreadable.
* **Git Workflow**: Refer to [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) for branch management, commit standards, and pull request procedures.

---

## 👥 Team & Contributors — Smart India Hackathon 2026

| Member | Role | Responsibility | GitHub Profile |
|:---:|:---|:---|:---|
| 👑 | **Yash Panchal** | Team Lead & Full-Stack Architect | [@yspanchal6](https://github.com/yspanchal6) |
| 💻 | **Frontend Lead** | UI/UX & React PWA Architecture | [@kritika1265](https://github.com/kritika1265) |
| ⚙️ | **Backend Lead** | API Services & Database Infrastructure | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |
| 🤖 | **AI/ML Specialist** | Medical NLP & Symptom Extraction Sidecar | [@princy-prajapati](https://github.com/princy-prajapati) |
| 🩺 | **Healthcare Operations** | Clinical Triage & Safety Rule Compliance | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |

| Member | Role & Track | Core Responsibilities & Contributions | Focus Area | GitHub Profile |
| :---: | :--- | :--- | :--- | :---: |
| 👑 | **Panchal Yash** | **Team Lead & Head Backend / System Architect**<br>Overall project architecture, end-to-end technical execution, Node.js/Express API services, role-based auth, cryptographic HealthPack pipelines, PostGIS emergency routing engine, testing suites, and production deployment. | Full-Stack & Backend Systems | [@yspanchal6](https://github.com/yspanchal6) |
| 🤖 | **Princy Prajapati** | **AI/ML Developer**<br>Clinical dataset preprocessing, AI/ML model development, evaluation, medical symptom triage integration, prompt engineering, and ML-assisted backend diagnostic pipelines. | AI / ML & Medical Triage | [@princy-prajapati](https://github.com/yspanchal6/CareSetu-v2.0) |
| 🎨 | **Kritika Singh** | **UI/UX & Frontend Developer**<br>Figma design systems, interactive prototyping, and responsive PWA frontend development in React & TypeScript with accessibility standards, dark/light theme systems, and real-time state synchronization. | UI/UX & PWA Frontend | @kritika1265](https://github.com/kritika1265) |
| 🗄️ | **Nensi Parmar** | **Database & Data Integration**<br>PostgreSQL & PostGIS spatial schema design, Prisma ORM modeling, geospatial hospital queries, data integrity constraints, relational mappings, and database security rules. | Spatial DB & Data Pipelines | [@NENSI PARMAR](https://github.com/Nensiparmar74) |
| 📋 | **Himanshu** | **Domain Research & QA**<br>Healthcare-domain research, problem-statement requirements analysis, clinical compliance workflows, multi-scenario QA testing matrices, and technical documentation. | Clinical QA & Documentation | [@Himanshu](https://github.com/rajpurohithimanshu55-byte) |
| 🎯 | **Siddiqui Affan** | **Strategy & Presentation**<br>Competition pitch strategy, presentation narrative design, interactive demo storytelling, user journey mapping, and healthcare market analysis. | Pitch Strategy & Demo Experience | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |
---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Built with ❤️ by Team CareSetu for Smart India Hackathon 2026</strong>
</p>
