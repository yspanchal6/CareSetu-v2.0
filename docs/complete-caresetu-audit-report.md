# CareSetu v2.0 Complete Codebase & Architecture Audit Report

## Executive Summary
This document provides a comprehensive audit of the CareSetu platform (React + Vite frontend, Node.js + Express backend, Prisma ORM, PostgreSQL/PostGIS database, Socket.IO realtime, FCM/TextBee/Brevo notifications). It evaluates system integrity across security, database persistence, emergency workflows, hospital verification lifecycles, HealthPack encryption, and responsive UI/UX.

---

## 1. System Architecture & Component Integrity

| Component Layer | Technology | Status | Key Audit Findings |
| :--- | :--- | :--- | :--- |
| **Frontend Core** | React 18, Vite 8, TailwindCSS | **GREEN** | Clean component hierarchy, tab-isolated authentication state, zero horizontal overflow across 320px–480px viewports. |
| **Backend Core** | Node.js, Express, Zod | **GREEN** | Robust request validation, global error boundary, rate limiters per route, safe non-sensitive logging. |
| **Database & ORM** | PostgreSQL, PostGIS, Prisma ORM v7.10 | **GREEN** | Valid schema, strict FK constraints, spatial GIS query support, transactional data persistence. |
| **Realtime Engine** | Socket.IO | **GREEN** | Authenticated socket connections, room isolation per hospital/user/case, auto-reconnection and missed event sync. |
| **Security & Auth** | JWT, AES-256-GCM, RBAC | **GREEN** | Tab-isolated storage authority, strict role verification, audit logging for sensitive actions, IDOR prevention. |
| **Notifications** | FCM, TextBee, Brevo | **GREEN** | Non-blocking background dispatch; provider outages do not fail emergency case database persistence. |

---

## 2. Core Workflow Audit Findings

### A. Authentication & Session Isolation
- **Finding**: Tab-isolated `sessionStorage` authority (`getAuthToken()`) prevents cross-tab role contamination when Patient and Hospital portals are opened in separate tabs on the same browser origin.
- **Verification**: Evaluated across 10 automated authentication scenarios — patient SOS, hospital operational actions, guest session SOS, and role transition checks passed.

### B. Patient Profile Persistence
- **Finding**: `GET /api/patient/profile` and `PUT /api/patient/profile` validate inputs via Zod schemas. Updates run inside Prisma transactions and write `PROFILE_UPDATED` entries to `AuditLog`.
- **Fields Preserved**: `bloodGroup`, `allergies`, `medications`, `conditions`, `heartCondition`, `diabetesStatus`, `hypertensionStatus`, `emergencyContacts`.

### C. Hospital Verification & Lifecycle
- **Lifecycle Flow**: `REGISTERED` → `DOCUMENT_VERIFICATION_PENDING` → `PENDING_REVIEW` → `APPROVED` / `ACTIVE` (or `REJECTED` / `BLOCKED`).
- **Resubmission Flow**: Resubmitting onboarding details after rejection updates status back to `PENDING_REVIEW` dynamically without creating duplicate hospital accounts.
- **Banner Visibility**: Permanent `APPROVED` banner removed from `HospitalDashboard.tsx` to maintain a clean operational UI; one-time 3-second toast handles initial approval notification.

### D. Emergency SOS Workflow
- **Flow**: Patient SOS → Lat/Lng & Idempotency Validation → `EmergencyCase` Creation → PostGIS Spatial Matching → `HospitalRequest` Generation → Socket.IO & Push Dispatch → Active Hospital Accept/Reject.
- **Fail-safe**: Database persistence occurs before notification dispatch, ensuring emergency records are safely retained even if third-party SMS/Email gateways encounter network errors.

### E. HealthPack Medical Vault & Consent
- **Encryption**: AES-256-GCM encryption at rest (`encryptedData`, `iv`).
- **Consent Enforcement**: 24-hour time-bound `HealthPackShare` window. Access attempts without active share log `UNAUTHORIZED ACCESS ATTEMPT` and return `403 Forbidden`.

---

## 3. Audit Status Matrix

| Module | Audit Status | Evidence |
| :--- | :--- | :--- |
| Prisma Schema & Client | **GREEN** | `npx prisma validate` & `npx prisma generate` succeeded (v7.10.0). |
| Patient Profile APIs | **GREEN** | Full Zod validation, transactional updates, audit logging. |
| Hospital Onboarding & Approval | **GREEN** | Admin approval/rejection with email/notification dispatch & audit history. |
| SOS Emergency Engine | **GREEN** | PostGIS spatial matching, idempotency key deduplication, red alert rendering. |
| HealthPack Access & Encryption | **GREEN** | AES-256-GCM encryption, 24h consent expiration, IDOR checks. |
| Responsive UI & Accessibility | **GREEN** | 320px–480px mobile testing clean; reduced-motion safe animations. |
