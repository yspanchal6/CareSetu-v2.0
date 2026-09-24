# CareSetu v2.0 Patient Profile API Debug & Verification Report

## Executive Summary
This report documents the verification, input validation, Zod schema enforcement, database persistence, and authorization controls for Patient Profile APIs in CareSetu v2.0.

---

## 1. Route & Controller Architecture

| HTTP Method | API Route | Authorization Required | Middleware Applied | Controller Function |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/patient/profile` | `PATIENT` | `auth`, `denyGuest`, `authorize('PATIENT')` | `patientController.getProfile` |
| `PUT` | `/api/patient/profile` | `PATIENT` | `auth`, `denyGuest`, `authorize('PATIENT')` | `patientController.updateProfile` |

---

## 2. Input Validation & Zod Schema

Patient profile payload updates are validated using Zod:
```javascript
const patientProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  gender: z.string().trim().min(1).max(50).optional(),
  phone: phoneSchema.optional(),
  bloodGroup: z.string().trim().max(20).optional(),
  allergies: z.string().max(5000).optional(),
  medicalConditions: z.string().max(5000).optional(),
  conditions: z.string().max(5000).optional(),
  heartCondition: z.string().max(100).optional(),
  diabetesStatus: z.string().max(100).optional(),
  hypertensionStatus: z.string().max(100).optional(),
  medications: z.string().max(5000).optional(),
  emergencyContacts: z.array(...).max(10).optional(),
});
```

---

## 3. Data Integrity & Overwrite Prevention
1. **Preserving Existing Fields**: Undefined fields in incoming JSON payloads are ignored during update execution, preventing existing medical data from being cleared.
2. **Transactional Security**: Updates are executed within `prisma.$transaction`, saving the updated `Patient` record and logging a `PROFILE_UPDATED` `AuditLog` entry.
3. **IDOR Protection**: The target patient profile is retrieved strictly using `req.user.userId` from the verified JWT session, ignoring client-supplied `patientId` parameters.
