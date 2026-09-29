# CARESETU V2.0 — HEALTHPACK MEDICAL DATA MISMATCH REPORT

## 1. Symptom & Problem Statement
- **Observed Bug**: The Emergency/SOS popup correctly displayed patient information (`Blood Group: B+`, `Known Conditions: heart patient`), whereas the Hospital HealthPack displayed default placeholders (`Blood Group: NOT_PROVIDED`, `Allergies: NOT_PROVIDED`, `Current Medications: NOT_PROVIDED`, `Confirmed Conditions: NOT_PROVIDED`, `Heart Status: UNKNOWN`).
- **Target Case**: `CASE-20260927-6B1AAB` (Patient: `yash`, Age 20).

---

## 2. Data Flow & Data Sources Analysis

### SOS Popup Data Source
- **Path**: `Patient` $\rightarrow$ `EmergencyCase` creation $\rightarrow$ `medicalSummary` payload.
- **Source**: When an emergency SOS case is created, the system snapshot (`emergencyCase.medicalSummary`) captured patient profile fields directly from the `Patient` table (`bloodGroup: "B+"`, `allergies: "hart patient "`, `currentMedications: "hart patient "`, `confirmedConditions: "hart patient "`).

### Original HealthPack Data Source
- **Path**: `HealthPack.encryptedData` (AES-256 encrypted hex payload).
- **Issue**: The `HealthPack` record `45c7d547-eec6-4873-a80e-49794368e29c` was created on Sept 23 at 11:41 AM—*before* the patient updated their `Patient` medical profile on Sept 23 at 15:51 PM.
- **Mismatch**: When `getDecryptedHealthPackForCase` decrypted `healthPack.encryptedData`, it directly returned the stale encrypted object (containing `"NOT_PROVIDED"`) without dynamically projecting the updated fields from the PostgreSQL `Patient` table or merging the emergency case `medicalSummary`.

---

## 3. Database Fields & Model Mapping

| Field | `Patient` Model Field | `EmergencyCase.medicalSummary` Field | `HealthPack.encryptedData` JSON Key |
| :--- | :--- | :--- | :--- |
| **Blood Group** | `Patient.bloodGroup` | `medicalSummary.bloodGroup` | `healthData.bloodGroup` |
| **Allergies** | `Patient.allergies` | `medicalSummary.allergies` | `healthData.allergies` |
| **Current Medications**| `Patient.medications` | `medicalSummary.currentMedications` | `healthData.medications` |
| **Confirmed Conditions**| `Patient.conditions` / `Patient.medicalConditions` | `medicalSummary.confirmedConditions` | `healthData.conditions` / `healthData.medicalConditions` |
| **Cardiac Status** | `Patient.heartCondition` | `medicalSummary.cardiacCondition` | `healthData.heartCondition` |
| **Diabetes Status** | `Patient.diabetesStatus` | `medicalSummary.diabetesStatus` | `healthData.diabetesStatus` |
| **Hypertension Status** | `Patient.hypertensionStatus` | `medicalSummary.hypertensionStatus` | `healthData.hypertensionStatus` |

---

## 4. Root Cause & Technical Fix

### Root Cause
1. `healthPackService.createHealthPack` referenced `patient?.currentMedications` instead of `patient?.medications` (matching `schema.prisma`), causing initial medication field resolution to evaluate to `undefined` and fall back to `"NOT_PROVIDED"`.
2. `getDecryptedHealthPackForCase` previously fetched `Patient` with `select: { id: true, name: true }`, omitting all medical fields. Consequently, if the patient updated their medical profile after the initial HealthPack encryption, `healthData` remained stale.

### Fix Implemented
1. **Service Projection (`backend/src/services/health-pack.service.js`)**:
   - Updated `getDecryptedHealthPackForCase` to fetch full patient profile fields (`bloodGroup`, `allergies`, `medications`, `conditions`, `medicalConditions`, `heartCondition`, `diabetesStatus`, `hypertensionStatus`).
   - Implemented a projection cascade (`project(patientRecord[field], medicalSummary[field], encryptedData[field], fallback)`).
   - If live `Patient` profile or emergency `medicalSummary` contains populated values (`"B+"`, `"hart patient"`), they take precedence over stale `"NOT_PROVIDED"` or `"UNKNOWN"` strings in `healthData`.
   - Triggered an asynchronous `refreshHealthPackFromPatient` update so the encrypted `HealthPack` in PostgreSQL is re-encrypted with updated values.
2. **Frontend Summary Formatting (`frontend/src/pages/hospital/HospitalEmergencyPages.tsx`)**:
   - Added `formatVal` in `healthPackSummary` to format any residual `"NOT_PROVIDED"` to `"Not provided"` and `"UNKNOWN"` to `"Unknown"`.

---

## 5. Canonical HealthPack API Contract

```json
{
  "success": true,
  "data": {
    "id": "45c7d547-eec6-4873-a80e-49794368e29c",
    "patientId": "6cddab91-ba54-4ba1-9801-ce82db5c5777",
    "patient": {
      "id": "6cddab91-ba54-4ba1-9801-ce82db5c5777",
      "name": "yash"
    },
    "createdAt": "2026-09-23T11:41:50.253Z",
    "expiresAt": "2026-09-28T15:22:05.226Z",
    "healthData": {
      "bloodGroup": "B+",
      "allergies": "hart patient",
      "medications": "hart patient",
      "conditions": "hart patient",
      "heartCondition": "UNKNOWN",
      "diabetesStatus": "UNKNOWN",
      "hypertensionStatus": "UNKNOWN",
      "medicalConditions": "hart patient"
    },
    "documents": [
      {
        "id": "eb94dcda-574f-41f7-b002-74afc17389dd",
        "fileName": "lab report.pdf",
        "fileUrl": "/uploads/documents/doc_6cddab91-ba54-4ba1-9801-ce82db5c5777_1790525507699_638.pdf",
        "fileType": "PDF",
        "documentType": "LAB_REPORT",
        "createdAt": "2026-09-27T16:11:47.714Z"
      },
      {
        "id": "5f98268c-d0a8-4ff3-88dc-05c32895f21d",
        "fileName": "report .pdf",
        "fileUrl": "/uploads/documents/doc_6cddab91-ba54-4ba1-9801-ce82db5c5777_1790525517321_694.pdf",
        "fileType": "PDF",
        "documentType": "PRESCRIPTION",
        "createdAt": "2026-09-27T16:11:57.324Z"
      }
    ]
  }
}
```

---

## 6. Verification & Test Results

- **HealthPack Data Flow Test Suite** (`node backend/tests/healthpack.data.flow.test.js`): `60 PASSED, 0 FAILED`.
- **IDOR & Security Test Suite** (`node backend/tests/healthpack-case-access-security.test.js`): `10 PASSED, 0 FAILED`.
- **Frontend Build** (`cmd /c npm run build` in `frontend`): `✓ built in 8.95s` (0 TypeScript / bundling errors).
- **Browser E2E**: `GREEN` — Verified in Hospital Portal (`/hospital/emergencies/active`). Opening Health Pack modal for case `CASE-20260927-6B1AAB` renders:
  - **Blood Group**: `B+`
  - **Allergies**: `hart patient`
  - **Current Medications**: `hart patient`
  - **Confirmed Conditions**: `hart patient`
  - **Medical Reports**: 2 attached reports (`lab report.pdf`, `report .pdf`)
