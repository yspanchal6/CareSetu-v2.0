# CareSetu Verified Local Test Accounts Registry

> **Security & Isolation Notice**:
> This registry documents dedicated local, demo, and test accounts configured in the CareSetu development and isolated test environments.
> - **Zero Production Secrets**: No real production passwords, credentials, tokens, or API keys are stored here.
> - **Environment References**: Passwords reference standard demo environment variables or default local testing presets.
> - **Verification Rule**: Accounts are marked `VERIFIED` only if active login and protected-route session resolution have been verified against the live authentication engine. Any unverified or missing accounts are explicitly marked `NOT_VERIFIED` or `MISSING`.

---

## 1. Local Application Endpoints

| Service | Environment | Base URL | Login Page URL | Default Port |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web App** | Local Dev / Demo | `http://localhost:5173` | `http://localhost:5173/login` | `5173` |
| **Backend API Gateway** | Local Dev / Demo | `http://localhost:5000` | `http://localhost:5000/api/auth/login` | `5000` |
| **Isolated Test DB** | Test Environment | `postgresql://localhost:5433/caresetu_doctor_test` | N/A | `5433` |
| **Development DB** | Local Dev DB | `postgresql://localhost:5432/caresetu` | N/A | `5432` |

---

## 2. Verified Accounts Summary Table

| Role | Login Identifier | Password Reference | Portal Route | Verification Status | Verification Date | Provisioning Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Patient** (Primary) | `test.patient@caresetu.local` | `process.env.TEST_PATIENT_PASSWORD` \|\| `Test@12345` | `/patient/dashboard` | **VERIFIED** | 2026-10-18 | `backend/scripts/seed-test-patient.js` or `regional.database.seed.test.js` |
| **Patient** (Alternate) | `patient@test.com` | `process.env.TEST_PASSWORD` \|\| `password123` | `/patient/dashboard` | **VERIFIED** | 2026-10-18 | `backend/seed.js` |
| **Hospital Admin** (Primary) | `test.hospital@caresetu.local` | `process.env.TEST_HOSPITAL_PASSWORD` \|\| `Test@12345` | `/hospital/dashboard` | **VERIFIED** | 2026-10-18 | Regional demo hospital seed (`CareSetu Test Hospital [DEMO]`) |
| **Hospital Admin** (Alternate) | `shreekrishna@caresetu.com` | `process.env.DEMO_HOSPITAL_PASSWORD` \|\| `hospital123` | `/hospital/dashboard` | **VERIFIED** | 2026-10-18 | `backend/seed.js` (`Shree Krishna Hospital`) |
| **Hospital-linked Doctor** | `demo.doctor.apex@caresetu.local` | `process.env.TEST_DOCTOR_PASSWORD` \|\| `Test@12345` | `/doctor/hospital/dashboard` | **VERIFIED** | 2026-10-18 | Onboarded & linked to `[DEMO] Anand Apex Multi-Specialty Hospital` |
| **Hospital Staff** (Clinical Lead) | `emergency.lead@caresetu.org` | N/A (Staff Roster record) | N/A | **NOT_VERIFIED** | 2026-10-18 | Default clinical staff record without standalone password credentials |
| **Independent Doctor** | `dr.independent@caresetu.local` | `process.env.TEST_DOCTOR_PASSWORD` \|\| `Test@12345` | `/doctor/independent/dashboard` | **VERIFIED** | 2026-10-18 | Independent Doctor Profile with GMC license & `APPROVED` status |
| **System Admin** | `admin@caresetu.com` | Unknown DB Hash | `/admin/dashboard` | **NOT_VERIFIED** | 2026-10-18 | Exists in DB with legacy/custom password hash; resetting password requires safe seeder |

---

## 3. Account Details & Role Profiles

### 3.1 Patient Account
- **Login Identifier**: `test.patient@caresetu.local`
- **Password**: `Test@12345` (or `process.env.TEST_PATIENT_PASSWORD`)
- **Resolved Role**: `PATIENT`
- **Resolved Portal Route**: `/patient/dashboard`
- **Associated Profile**: Name: `"CareSetu Test Patient"`, Age: 30, Gender: `"MALE"`, Blood Group: `"O+"`
- **Capabilities**: Create emergency SOS requests, upload medical documents, view encrypted HealthPack, grant hospital access consent.
- **Verification Status**: **VERIFIED** via `POST /api/auth/login` (HTTP 200) and `GET /api/auth/me` session check.

### 3.2 Hospital Admin Account
- **Login Identifier**: `test.hospital@caresetu.local`
- **Password**: `Test@12345` (or `process.env.TEST_HOSPITAL_PASSWORD`)
- **Resolved Role**: `HOSPITAL`
- **Resolved Portal Route**: `/hospital/dashboard`
- **Hospital Affiliation**: `CareSetu Test Hospital [DEMO]` (Verified: `true`, Emergency Available: `true`)
- **Capabilities**: Receive emergency SOS dispatch, accept/reject cases, view shared patient HealthPack, manage hospital staff roster, assign/reassign doctors, review and approve clinical diagnosis reports, close cases.
- **Verification Status**: **VERIFIED** via `POST /api/auth/login` (HTTP 200) and `GET /api/auth/me` session check.

### 3.3 Hospital-Linked Doctor Account
- **Login Identifier**: `demo.doctor.apex@caresetu.local`
- **Password**: `Test@12345` (or `process.env.TEST_DOCTOR_PASSWORD`)
- **Resolved Role**: `DOCTOR`
- **Resolved Portal Route**: `/doctor/hospital/dashboard`
- **Hospital Affiliation**: Linked active staff member (`apex-staff-doc-1`, `Dr. Yashwanth Patel`, Role: `Doctor`, Clinical Role: `Emergency Physician`) at `[DEMO] Anand Apex Multi-Specialty Hospital`.
- **Capabilities**: Access hospital-scoped assigned emergency cases (`/doctor/hospital/cases`), view authorized HealthPacks, update emergency lifecycle stages (`ACCEPTED` -> `TRANSFER` -> `IN_PROGRESS` -> `TREATMENT`), draft and submit clinical diagnosis reports for hospital review.
- **Verification Status**: **VERIFIED** via `POST /api/auth/login` (HTTP 200) and `GET /api/auth/me` session check.

### 3.4 Hospital Staff (Unlinked Roster Members)
- **Identifiers**: `emergency.lead@caresetu.org` (Staff ID: `STAFF-001`), `specialist@caresetu.org` (Staff ID: `STAFF-002`)
- **Role**: `Emergency Physician` / `General Physician` (Clinical Staff Roster)
- **Verification Status**: **NOT_VERIFIED** (Roster-only staff records created by hospital default setup; they do not have standalone user login credentials until provisioned via `POST /api/hospitals/staff`).
- **Provisioning Method**: Hospital Admins can invite staff via the **Staff Management** page (`/hospital/staff`) or via `POST /api/hospitals/staff`.

### 3.5 Independent Doctor Account
- **Login Identifier**: `dr.independent@caresetu.local`
- **Password**: `Test@12345` (or `process.env.TEST_DOCTOR_PASSWORD`)
- **Resolved Role**: `DOCTOR`
- **Resolved Portal Route**: `/doctor/independent/dashboard`
- **Practice Profile**: Name: `"Dr. Anita Desai"`, GMC License: `"GMC-IND-9948"`, Status: `APPROVED`, Practice: Independent OPD & Consultations.
- **Access Boundary**: Strictly forbidden from accessing hospital emergency cases (`403 FORBIDDEN_CASE_ACCESS`). Dedicated outpatient dashboard (`/doctor/independent/dashboard`).
- **Verification Status**: **VERIFIED** via `POST /api/auth/login` (HTTP 200) and `GET /api/auth/me` session check.

### 3.6 System Admin Account
- **Login Identifier**: `admin@caresetu.com`
- **Password**: Requires password synchronization (current database bcrypt hash does not match standard test presets `admin123` or `AdminPassword123!`).
- **Expected Portal Route**: `/admin/dashboard`
- **Verification Status**: **NOT_VERIFIED** (Failed authentication with 401).
- **Safe Reset / Provisioning Method**:
  To reset the administrator password in local development:
  ```bash
  node -e "const prisma = require('./backend/src/config/prisma'); const bcrypt = require('bcryptjs'); bcrypt.hash('AdminPassword123!', 10).then(h => prisma.user.upsert({ where: { email: 'admin@caresetu.local' }, update: { password: h, role: 'ADMIN', status: 'ACTIVE' }, create: { name: 'CareSetu Super Admin', email: 'admin@caresetu.local', password: h, role: 'ADMIN', status: 'ACTIVE' } })).then(() => console.log('Admin ready')).finally(() => prisma.\$disconnect());"
  ```

---

## 4. Provisioning & Reset Procedures

### Provisioning Test Patient
To provision or reset the primary verified patient account:
```bash
node backend/scripts/seed-test-patient.js
```
*Note*: This script is strictly protected against execution in production environments (`NODE_ENV === 'production'`).

### Provisioning Regional Demo Hospitals & Seed Doctors
To run the standard regional test suite and verify hospital matching with demo hospitals:
```bash
node backend/tests/regional.database.seed.test.js
```

### Resetting Doctor Password on First Login
If an onboarded hospital doctor has `mustChangePassword: true`:
1. Authenticate with initial credentials to obtain temporary session token.
2. Submit `POST /api/auth/change-password-mandatory` with `{ currentPassword, newPassword }`.
3. The user account flag `mustChangePassword` is cleared to `false` and subsequent logins redirect directly to `/doctor/hospital/dashboard`.
