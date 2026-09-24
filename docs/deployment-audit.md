# CareSetu — Discovered Deployment & Architecture Audit

## 1. System Architecture Overview

CareSetu is an AI-integrated healthcare and emergency response platform built with a decoupled React PWA frontend and a Node.js Express backend, backed by PostgreSQL with PostGIS extensions and Socket.IO for real-time orchestration.

```
┌───────────────────────────────────────────────────────────┐
│                     React PWA Frontend                    │
│    (Vite, React Router 7, Leaflet, IndexedDB, ServiceWorker)│
└─────────────────────────────┬─────────────────────────────┘
                              │ REST APIs & WebSockets
                              ▼
┌───────────────────────────────────────────────────────────┐
│                     Node.js Express API                   │
│   (Express 5, JWT/RBAC, Socket.IO, Helmet, Zod, RateLimiter)│
└──────────────┬──────────────────────────────┬─────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌──────────────────────────┐
│ PostgreSQL + PostGIS (Prisma)│ │ External Providers       │
│  - Spatial queries           │ │  - TextBee (SMS OTP)     │
│  - Encrypted HealthPacks     │ │  - Brevo (Email OTP)     │
│  - Audit logs & Emergency    │ │  - FCM (Push Messages)   │
└──────────────────────────────┘ └──────────────────────────┘
```

---

## 2. Component Discovery

### 2.1 Frontend Architecture
- **Framework & Build**: React 19, TypeScript 6, Vite 8, Tailwind CSS v3.
- **PWA & Offline Capability**: Custom `sw.js` service worker, `manifest.json`, IndexedDB (`offlineDB.ts`), sync engine (`syncEngine.ts`) with retry queues for offline SOS.
- **Routing & State**: React Router v7, `AuthContext` for user session management, `SocketContext` for real-time emergency updates.
- **Authentication**:
  - Email/Password + OTP registration and login.
  - Google OAuth / Firebase Authentication (`GoogleAuthButton.tsx`, `firebase.ts`).
  - Guest Mode for emergency reporting and basic Doctor AI queries.
- **Key Modules**:
  - Doctor AI Chat (`DoctorAIPage.tsx`).
  - Emergency SOS & Timeline (`EmergencySOSPage.tsx`, `EmergencyStatusPage.tsx`).
  - Hospital Discovery & Matching (`PatientHospitalsPage.tsx`, `HospitalCard.tsx`).
  - Encrypted HealthPack Vault (`HealthPackPage.tsx`).

### 2.2 Backend Architecture
- **Framework**: Node.js CommonJS, Express 5.2.1.
- **Authentication & Security**:
  - JWT session tokens (Auth header, x-auth-token, HTTP-only cookie support).
  - Role-Based Access Control (`requireRole`: `PATIENT`, `DOCTOR`, `HOSPITAL`, `ADMIN`, `GUEST`).
  - Guest Access Guard (`denyGuest`, `authGuest`).
  - Helmet security headers, CORS origin filtering, Winston structured logging with PII/Secret redaction.
- **Realtime Layer**: Socket.IO server (`utils/socket.js`) with JWT handshake verification and strict room authorization (`emergency:<id>`, `hospital:<id>`, `user:<id>`).
- **Database Layer**: Prisma 7 ORM connecting to PostgreSQL with PostGIS extension for geo-radius hospital queries (`ST_DWithin`, `ST_Distance`).
- **Integrations & Notification Providers**:
  - **TextBee**: SMS OTP delivery with rate-limiting and quota failure detection (`textbee.provider.js`).
  - **Brevo**: Transactional email OTP delivery with API key validation (`brevo.provider.js`).
  - **Firebase Admin**: FCM push notification delivery to user registered devices.
  - **Doctor AI Engine**: Medical safety rule engine, red-flag symptom detection, keyword NLP, and lexical TF-IDF RAG (`ai-service`).

### 2.3 Database Schema & Persistence
- **ORM**: Prisma Schema (`backend/prisma/schema.prisma`).
- **Primary Enums**: `Role`, `UserStatus`, `CaseStatus`, `EmergencySeverity`, `EmergencyType`, `HealthPackStatus`, `HealthPackShareStatus`, `RestrictionStatus`, `PendingChangeStatus`.
- **Core Entities**:
  - `User`: Base user identity with role and status.
  - `Patient`: Patient profile, health attributes, location history (`PatientLocation`).
  - `Hospital`: Hospital profile, emergency capabilities, verification status, PostGIS location.
  - `EmergencyCase`: SOS record, severity level, idempotency key, status tracking.
  - `HospitalRequest`: Dispatch request sent to candidate hospitals with match score and response status.
  - `HealthPack` & `HealthPackShare`: AES-256-GCM encrypted health records with share control and expiry.
  - `MedicalDocument`: Uploaded medical records with status tracking.
  - `Conversation`, `AIMessage`, `AIAnalysis`: Doctor AI interaction logs and safety assessments.
  - `Otp`, `PendingCredentialChange`: Two-factor OTP hashes, attempt counters, and credential changes.
  - `AccountRestriction`: Admin blocklist and access restrictions.
  - `AuditLog`: System-wide audit logging for sensitive actions.

### 2.4 Deployment & Infrastructure
- **Docker**: `docker-compose.yml` configured for `postgis/postgis:15-3.3` container and Node application.
- **Environment**: `.env.example` templates for local, test, and production environments.
- **Remotes**: Configured for GitHub repositories (`yspanchal6/CareSetu`).

---

## 3. Discovered Technical Constraints & Verification Status
- Production secrets must strictly reside in environment variables and never be hardcoded or fallback-exposed.
- HealthPack encryption relies on AES-256-GCM with distinct IV and Auth Tags per record.
- Doctor AI utilizes lexical TF-IDF context retrieval with strict safety rule guardrails for emergency detection.
