# CareSetu — Secure HealthPack Capture Violation & Temporary Hospital Blocking Architecture

## 1. Feature Overview
CareSetu implements a multi-layered security architecture to protect sensitive patient medical documents and HealthPacks. When an authorized hospital user attempts to capture protected medical content (detected via native Android `FLAG_SECURE`, iOS system capture state, or browser focus/visibility events), the system:
1. **Immediately redacts** sensitive content using a secure client overlay.
2. **Registers a normalized security event** (`POST /api/security/capture-violation`) with 5-second debouncing.
3. **Applies an atomic 3-attempt violation policy**:
   - **Attempt 1**: Issues a security warning, logs audit event, and sends a warning email to the hospital.
   - **Attempt 2**: Issues a final warning with strict notice of imminent portal restriction, logs audit event, and sends a final warning email.
   - **Attempt 3**: Atomically revokes active HealthPack viewing sessions, sets hospital security status to `TEMPORARILY_BLOCKED`, updates user status to `BLOCKED`, creates an admin security review case, and sends temporary restriction emails to both hospital and administration.
4. **Enforces server-authoritative portal restriction**: A blocked hospital cannot bypass restriction via page refreshes, direct API calls, or multi-device sessions.
5. **Provides an appeal workflow**: Restricted hospitals can submit an explanation/appeal (`POST /api/security/appeal`).
6. **Administrative unlock workflow**: CareSetu administrators can review violation history, evaluate appeals, and execute administrative unlocks (`POST /api/security/admin/unlock-hospital`), restoring `ACTIVE` status while preserving historical audit logs.

---

## 2. Multi-Platform Security Model & Limitations
CareSetu uses platform-specific protected-content mechanisms where supported:
- **Android Native (Capacitor/Cordova)**: Native `WindowManager.LayoutParams.FLAG_SECURE` blocks OS-level screenshots, screen recording, and recents switcher previews on protected Activity windows.
- **iOS / iPadOS Native**: System capture APIs (`UIScreen.main.isCaptured` / `sceneCaptureState`) detect active screen recording or mirroring and redact healthcare UI.
- **Web / PWA Version**: Uses layered browser privacy protections (in-memory Blob streams, dynamic session watermarks, focus/visibility overlays, and print suppression), but **cannot guarantee OS-level screenshot prevention** due to browser sandbox limits.

> **Honest Security Statement:**
> CareSetu does not claim universal screenshot prevention on browsers or every mobile device. Native OS security mechanisms are used where the platform provides them.

---

## 3. Database Schema

```prisma
enum HospitalSecurityStatusType {
  ACTIVE
  WARNING
  TEMPORARILY_BLOCKED
  UNDER_REVIEW
}

enum CaptureViolationType {
  SCREENSHOT_ATTEMPT
  SCREEN_CAPTURE_DETECTED
  SCREEN_RECORDING_DETECTED
  SCREEN_MIRRORING_DETECTED
  PROTECTED_CONTENT_CAPTURE
}

enum AppealStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  REJECTED
  CLOSED
}

model HospitalSecurityStatus {
  id             String                     @id @default(uuid())
  hospitalId     String                     @unique
  hospital       Hospital                   @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  status         HospitalSecurityStatusType @default(ACTIVE)
  violationCount Int                        @default(0)
  blockedAt      DateTime?
  blockedUntil   DateTime?
  unblockedAt    DateTime?
  unblockedBy    String?
  blockReason    String?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt
}

model CaptureViolation {
  id             String               @id @default(uuid())
  hospitalId     String
  hospital       Hospital             @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  hospitalUserId String
  caseId         String?
  documentId     String?
  healthPackId   String?
  eventType      CaptureViolationType @default(SCREENSHOT_ATTEMPT)
  platform       String               @default("WEB")
  attemptNumber  Int
  detectedAt     DateTime             @default(now())
  severity       String               @default("HIGH")
  status         String               @default("RECORDED")
  metadata       Json?
  createdAt      DateTime             @default(now())
}

model HospitalSecurityAppeal {
  id           String       @id @default(uuid())
  hospitalId   String
  hospital     Hospital     @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  submittedBy  String
  reason       String
  description  String
  status       AppealStatus @default(PENDING)
  adminNotes   String?
  submittedAt  DateTime     @default(now())
  reviewedAt   DateTime?
  reviewedBy   String?
  decision     String?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}
```

---

## 4. API Specification

| Endpoint | Method | Role | Purpose |
|---|---|---|---|
| `/api/security/capture-violation` | `POST` | `HOSPITAL` | Record a capture event & increment atomic counter |
| `/api/security/hospital-status` | `GET` | Authenticated | Fetch current hospital security block status & appeals |
| `/api/security/appeal` | `POST` | Authenticated | Submit an explanation/appeal for a blocked hospital |
| `/api/security/admin/violations` | `GET` | `ADMIN` | List all capture violations, statuses, and pending appeals |
| `/api/security/admin/unlock-hospital` | `POST` | `ADMIN` | Restore hospital access and approve/reject appeal |

---

## 5. Audit Logging Events
- `CAPTURE_VIOLATION`
- `CAPTURE_WARNING_ISSUED`
- `HOSPITAL_TEMPORARILY_BLOCKED`
- `HOSPITAL_SESSION_REVOKED`
- `HOSPITAL_APPEAL_SUBMITTED`
- `HOSPITAL_UNLOCKED`
