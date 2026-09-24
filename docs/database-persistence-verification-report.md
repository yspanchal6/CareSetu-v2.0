# CareSetu v2.0 Database Persistence Verification Report

## Executive Summary
This report documents the verification of PostgreSQL database persistence, Prisma ORM schema validation, transactional execution, and audit logging for CareSetu v2.0.

---

## 1. Prisma Schema & Client Validation

### Validation Commands & Results
```bash
$ npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀

$ npx prisma generate
✔ Generated Prisma Client (v7.10.0) to .\node_modules\@prisma\client in 526ms
```

---

## 2. Entity Persistence Verification Matrix

| Database Model | Primary Key | Key Relations & Constraints | Persistence Trigger | Transactional Integrity |
| :--- | :--- | :--- | :--- | :--- |
| `User` | `id` (UUID) | Unique `email`, `role`, `status` | Registration / OAuth Login | Ensured via `prisma.$transaction` |
| `Patient` | `id` (UUID) | Unique `userId`, FK to `User` | Profile Save / HealthPack creation | Transactional update with AuditLog |
| `Hospital` | `id` (UUID) | Unique `userId`, FK to `User` | Onboarding Submit / Profile Edit | Transactional update with AuditLog |
| `EmergencyCase` | `id` (UUID) | FK `patientId`, FK `hospitalId` | SOS Trigger (`POST /api/emergency/sos`) | Transactional case + request creation |
| `HospitalRequest` | `id` (UUID) | FK `emergencyCaseId`, FK `hospitalId` | Hospital Matching Engine | Created per eligible active hospital |
| `HealthPack` | `id` (UUID) | FK `patientId`, `encryptedData`, `iv` | HealthPack Save / Auto-generation | AES-256-GCM encrypted persistence |
| `HealthPackShare` | `id` (UUID) | FK `healthPackId`, FK `hospitalId` | Hospital Case Acceptance | Time-bound (24h) consent record |
| `MedicalDocument` | `id` (UUID) | FK `patientId`, FK `healthPackId` | Document Upload | Persistent document metadata |
| `AuditLog` | `id` (UUID) | FK `userId` | System/User Action Events | Immutable log entry per operation |
| `Notification` | `id` (UUID) | FK `userId`, `type`, `status` | System Events / Approval Toasts | Persistent notification record |

---

## 3. Transaction & Fail-safe Rules
1. **Multi-Record Operations**: Operations modifying multiple related tables (e.g., Admin hospital approval modifying `Hospital`, `User`, `AuditLog`, `Notification`) execute inside `prisma.$transaction`.
2. **Fail-safe Ordering**: Database writes complete **before** triggering external notifications (FCM/SMS/Email). Provider errors are caught and logged without rolling back valid database state.
3. **No Phantom State**: Success responses are returned only after database commit completes.
