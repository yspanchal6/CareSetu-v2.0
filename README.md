# CareSetu — AI-Integrated Healthcare & Emergency Response Platform

<p align="center">
  <img src="https://img.shields.io/badge/Platform-CareSetu-0284c7?style=for-the-badge&logo=react" alt="CareSetu Platform" />
  <img src="https://img.shields.io/badge/React-18.3-61dafb?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-PostGIS-4169e1?style=for-the-badge&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2d3748?style=for-the-badge&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

---

## 🌟 Overview

**CareSetu** is an end-to-end, AI-integrated healthcare coordination and emergency response platform designed to save lives by connecting patients to the right healthcare facilities at the right time.

CareSetu bridges the gap between emergency triage, location-aware progressive hospital matching, encrypted medical records (HealthPacks), real-time response dashboards, and offline emergency continuity.

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

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client, PWA Service Worker.
* **Backend**: Node.js 20, Express.js, Prisma ORM 7, Socket.IO, Crypto (AES-256-GCM), Rate Limiters.
* **Database**: PostgreSQL 16 with PostGIS spatial extension.
* **Integrations**: TextBee (SMS Gateway), Brevo (Email SMTP), Firebase Cloud Messaging (FCM Push Alerts).

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

# Run Database Migrations & Generate Prisma Client
npx prisma db push
npx prisma generate

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

The application will be accessible at:
* **Frontend**: `http://localhost:5173`
* **Backend API**: `http://localhost:5000`

---

## 🧪 Testing & Verification

Run backend automated security and workflow test suites:

```bash
# Emergency Timeout & Flag Filtering Suite
node backend/tests/emergency-timeout-and-flags.test.js

# Hospital SOS Card & Acceptance Workflow Suite
node backend/tests/hospital-sos-card-accept-workflow.test.js

# URL Tokenization & Opaque Route Security Suite
node backend/tests/url-token.security.test.js
```

Run frontend production build verification:
```bash
cd frontend
npm run build
```

---

## 🔒 Security Requirements & Guidelines

* **Environment Secrets**: Never commit `.env` files or private keys. Set `URL_ENCRYPTION_SECRET` and `JWT_SECRET` in server environment settings.
* **Git Workflow**: Refer to [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) for branch management, commit standards, and pull request procedures.

---

## 👥 Team & Contributors — Smart India Hackathon 2026

| Member | Role | Responsibility | GitHub Profile |
|:---:|:---|:---|:---|
| 👑 | **Yash Panchal** | Team Lead & Full-Stack Architect | [@yspanchal6](https://github.com/yspanchal6) |
| 💻 | **Frontend Lead** | UI/UX & React PWA Architecture | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |
| ⚙️ | **Backend Lead** | API Services & Database Infrastructure | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |
| 🤖 | **AI/ML Specialist** | Medical NLP & Symptom Extraction Sidecar | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |
| 🩺 | **Healthcare Operations** | Clinical Triage & Safety Rule Compliance | [@CareSetu-Team](https://github.com/yspanchal6/CareSetu-v2.0) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Built with ❤️ by Team CareSetu for Smart India Hackathon 2026</strong>
</p>
