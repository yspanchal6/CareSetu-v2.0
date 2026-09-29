# CARESETU V2.0 — STEP 3 HOSPITAL MATCHING ARCHITECTURE & MANUAL

> **Notice:** This system performs deterministic and explainable entity matching. It does **not** claim AI/ML-based identity resolution or destructive record merging.

---

## 1. Overview & Objectives

CareSetu V2.0 Step 3 establishes an explicit, deterministic, explainable, and auditable relationship between external **GovernmentHealthRecord** dataset entries and internal **CareSetu Hospital** registered accounts.

### Core Architecture Principles:
- **Entity Linker, NOT Destructive Merging:** Source records (`GovernmentHealthRecord` and `Hospital`) remain completely untouched and independently preserved. No records are deleted, overwritten, or auto-created.
- **Deterministic Multi-Signal Scoring:** Evaluates exact/normalized state agreement, district matching, pincode alignment, hospital name token similarity, public phone matching, and geographic Haversine distance.
- **Human-in-the-Loop Admin Approval:** Candidate matches are generated as `PENDING_REVIEW` with positive evidence (`✓`) and warning conflicts (`⚠`). Admins review side-by-side comparison cards and explicitly `APPROVE`, `REJECT`, or `UNMATCH`.
- **Database & Concurrency Protection:** Unique constraint `[careSetuHospitalId, governmentRecordId]` prevents duplicate candidate records. Active match approval uses Prisma transactions and returns `HTTP 409 Conflict` if a government record has already been matched to another hospital.

---

## 2. Database Model Architecture (`HospitalMatch`)

```prisma
enum MatchStatus {
  PENDING_REVIEW
  MATCHED
  REJECTED
  UNMATCHED
}

enum MatchConfidenceLevel {
  HIGH
  MEDIUM
  LOW
}

model HospitalMatch {
  id                   String               @id @default(uuid())
  careSetuHospitalId   String
  governmentRecordId   String
  status               MatchStatus          @default(PENDING_REVIEW)
  confidenceLevel      MatchConfidenceLevel @default(MEDIUM)
  confidenceScore      Float?
  matchingMethod       String               @default("DETERMINISTIC_MULTI_SIGNAL")
  matchReasons         Json
  conflictReasons      Json
  evidenceSnapshot     Json?
  distanceKm           Float?

  reviewedBy           String?
  reviewedAt           DateTime?
  rejectedBy           String?
  rejectedAt           DateTime?
  rejectionReason      String?
  unmatchedBy          String?
  unmatchedAt          DateTime?
  unmatchReason        String?

  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  careSetuHospital     Hospital             @relation(fields: [careSetuHospitalId], references: [id], onDelete: Cascade)
  governmentRecord     GovernmentHealthRecord @relation(fields: [governmentRecordId], references: [id], onDelete: Cascade)

  @@unique([careSetuHospitalId, governmentRecordId])
  @@index([careSetuHospitalId])
  @@index([governmentRecordId])
  @@index([status])
  @@index([confidenceLevel])
  @@index([createdAt])

  @@map("hospital_matches")
}
```

---

## 3. Matching Engine & Signals

### 3.1 Normalization Utilities (`backend/src/utils/hospital-matching-normalizer.js`)
- **Hospital Name:** Lowercased, trimmed, strips noise words (`hospital`, `pvt`, `ltd`, `dr`, `centre`, `center`, `medical`, `institute`, etc.), normalizes punctuation.
- **State & District:** Cleaned of non-alphanumeric formatting for exact string comparison.
- **Pincode:** Normalized to 6-digit Indian PIN format (extracted from pincode field or address string regex `/\b\d{6}\b/`).
- **Phone:** Normalized to last 10 digits (stripping `+91` / `0` prefix).
- **Spatial Distance:** Computed using the mathematical **Haversine Formula** over valid `(latitude, longitude)` pairs.

### 3.2 Scoring Weights & Signals

| Signal | Evaluation Condition | Score Impact | Reason Generated |
| :--- | :--- | :---: | :--- |
| **State Match** | `normalizeState(gov.state) === normalizeState(care.state)` | **+20** | `Same State (StateName)` |
| **Cross-State Conflict** | `normalizeState(gov.state) !== normalizeState(care.state)` | **-50** | `Cross-State Mismatch: Government record in A, CareSetu hospital in B` |
| **District Match** | `normalizeDistrict(gov.district) === normalizeDistrict(care.city)` | **+25** | `Same District (DistrictName)` |
| **District Conflict** | `gov.district !== care.city` | **-15** | `District Mismatch` |
| **Pincode Match** | `normalizePincode(gov.pincode) === normalizePincode(care.pincode)` | **+25** | `Exact Pincode Match (380009)` |
| **Pincode Conflict** | `pincodes present and unequal` | **-20** | `Pincode Mismatch` |
| **Name Token Similarity** | Jaccard Token Similarity $\ge 0.70$ | **+40** | `Strong Hospital Name Agreement (X%)` |
| | Jaccard Token Similarity $\ge 0.40$ | **+20** | `Moderate Hospital Name Similarity (X%)` |
| | Jaccard Token Similarity $< 0.20$ | **-10** | `Weak Hospital Name Similarity` |
| **Spatial Distance** | $\le 5.0$ km Haversine distance | **+25** | `Geographic Proximity (X km apart)` |
| | $\le 15.0$ km Haversine distance | **+10** | `Moderate Geographic Proximity (X km apart)` |
| | $> 50.0$ km Haversine distance | **-30** | `Geographic Distance Conflict (X km apart)` |
| **Phone Match** | `normalizePhone(gov.phone) === normalizePhone(care.phone)` | **+30** | `Exact Public Phone Match` |

### 3.3 Confidence Levels
- **HIGH CONFIDENCE:** Score $\ge 65$, no cross-state conflict, strong name/location agreement.
- **MEDIUM CONFIDENCE:** Score $\ge 35$, requires manual admin review.
- **LOW CONFIDENCE:** Score $< 35$ or cross-state mismatch.

---

## 4. Workflows & API Specification

All mutation and candidate review APIs require authentication and `ADMIN` authorization.

### Endpoints:
- `GET /api/admin/hospital-matching/stats` - Returns dashboard statistics.
- `GET /api/admin/hospital-matching/candidates` - Returns paginated candidate matches with multi-filtering (`status`, `confidenceLevel`, `source`, `state`, `search`).
- `GET /api/admin/hospital-matching/candidates/:id` - Returns single match candidate with side-by-side evidence snapshot.
- `POST /api/admin/hospital-matching/candidates/generate` - Triggers background candidate generation scan.
- `POST /api/admin/hospital-matching/candidates/:id/approve` - Approves match (`status = 'MATCHED'`), logs audit entry. Rejects with `HTTP 409 Conflict` if government record is already linked.
- `POST /api/admin/hospital-matching/candidates/:id/reject` - Rejects candidate (`status = 'REJECTED'`) with optional reason.
- `POST /api/admin/hospital-matching/candidates/:id/unmatch` - Unlinks active match (`status = 'UNMATCHED'`) with reason.

---

## 5. Capacity Safety & PM-JAY Data Protection

1. **Historical Admissions Isolation:** AB PM-JAY dataset records represent historical state-level admissions (`2019-20` to `2024-25`). Entity matching a PM-JAY record to a CareSetu hospital **does NOT** turn admissions stats into current beds (`bedCount = null`).
2. **Emergency Slots:** Government dataset records explicitly retain `emergencyAvailable = false` and `isVerified = false`.
3. **No Synthetic Capacity:** No fake emergency slots or bed numbers are synthesized.

---

## 6. Directory & Details Page Integration

- **Public Directory (`/api/hospitals/directory`):** Matched government records expose `isMatched: true`, `matchStatus: 'MATCHED'`, and `linkedCareSetuHospital: { id, name, isVerified }`.
- **Hospital Details (`/api/hospitals/directory/:id`):** CareSetu registered hospital details show linked government health records (`hasGovernmentLink: true`, `linkedGovernmentRecords`).
