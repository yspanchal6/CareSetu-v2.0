# CareSetu — Dummy Database & Regional Hospital Seed Report

This report documents the non-destructive, idempotent database seeding and verification for CareSetu's regional hospital network, test patient account, and test hospital account.

---

## 1. Seeding Strategy & Safety Rules

- **Environment**: Development & Test environment ONLY.
- **Non-Destructive**: Preserves all existing emergency cases, patient locations, audit logs, and hospital requests.
- **Idempotence**: Uses `upsert` logic on unique email addresses (`email`). Repeated execution updates existing records cleanly without duplicating users or creating primary-key conflicts.
- **Password Hashing**: Uses production-grade `bcrypt` hashing (10 rounds). Plain-text passwords are never stored.
- **DEMO Designation**: All regional hospitals are explicitly designated with `[DEMO]` in their hospital name to prevent confusing test records with operational medical facilities.

---

## 2. Provisioned Accounts & Hospital Directory

### A. Test Accounts

| Account Type | Email Identifier | Role | Mobile | Location / City | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Test Patient** | `test.patient@caresetu.local` | `PATIENT` | `9898676838` | Karamsad (`22.5360, 72.8950`) | `ACTIVE` / Verified |
| **Test Hospital** | `test.hospital@caresetu.local` | `HOSPITAL` | `9173558970` | 60 Hilanshan Residency, Karamsar | `ACTIVE` / Verified |

### B. Regional DEMO Hospital Directory (12 Hospitals across 5 Regions)

| Region / City | Hospital Name | Email Identifier | Phone (Test) | Coordinates | Key Facilities / Capabilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Karamsad** | `CareSetu Test Hospital [DEMO]` | `test.hospital@caresetu.local` | `+919173558970` | `22.5360, 72.8950` | Emergency, Cardiac, Trauma, ICU, Neuro |
| **Karamsad** | `[DEMO] Karamsad Community Emergency Hospital` | `demo.karamsad.hospital@caresetu.local` | `+919173558001` | `22.5385, 72.8920` | Emergency, General, ICU |
| **Anand** | `[DEMO] Anand Emergency & Trauma Care` | `demo.anand.trauma@caresetu.local` | `+919173558002` | `22.5600, 72.9300` | Emergency, Trauma, Orthopedics |
| **Anand** | `[DEMO] Anand City Heart & Critical Care` | `demo.anand.cardiac@caresetu.local` | `+919173558003` | `22.5550, 72.9250` | Emergency, Cardiac, ICU |
| **Anand** | `[DEMO] Anand Apex Multi-Specialty Hospital` | `demo.anand.apex@caresetu.local` | `+919173558004` | `22.5680, 72.9400` | Emergency, Cardiac, Trauma, Neuro, ICU |
| **Vidyanagar** | `[DEMO] Vallabh Vidyanagar Health & Medicare` | `demo.vvn.medicare@caresetu.local` | `+919173558005` | `22.5320, 72.9220` | Emergency, General |
| **Vidyanagar** | `[DEMO] VVN Emergency Care Center` | `demo.vvn.student@caresetu.local` | `+919173558006` | `22.5280, 72.9150` | Emergency, Trauma |
| **Nadiad** | `[DEMO] Nadiad LifeCare Trauma & Kidney Center` | `demo.nadiad.lifecare@caresetu.local` | `+919173558007` | `22.6900, 72.8600` | Emergency, Trauma, Nephrology, ICU |
| **Nadiad** | `[DEMO] Nadiad Civil Emergency Hospital` | `demo.nadiad.civil@caresetu.local` | `+919173558008` | `22.6950, 72.8650` | Emergency, Cardiac, General |
| **Vadodara** | `[DEMO] Vadodara Super Specialty Emergency Hospital` | `demo.vadodara.superspecialty@caresetu.local` | `+919173558009` | `22.3072, 73.1812` | Emergency, Cardiac, Trauma, Neuro, ICU |
| **Vadodara** | `[DEMO] Vadodara Central Neuro & Cardiac Institute` | `demo.vadodara.neuro@caresetu.local` | `+919173558010` | `22.3150, 73.1900` | Emergency, Cardiac, Neuro, ICU |

---

## 3. Database Execution Output

```text
==================================================
CARESETU IDEMPOTENT DEVELOPMENT SEEDER
==================================================
Seeding Test Patient (test.patient@caresetu.local)...
Seeding Test Hospital (test.hospital@caresetu.local)...
Seeding Regional DEMO Hospitals...
Seeding Admin account (admin@caresetu.com)...
==================================================
SEED SUMMARY: 0 Created, 13 Updated
==================================================
```

---

## 4. Automated Verification Test Suite Results

Test File: `backend/tests/regional.database.seed.test.js`

```text
==================================================
CARESETU REGIONAL DATABASE & SEED TEST SUITE
==================================================
[PASS] Test Patient login returns HTTP 200 OK
[PASS] Test Patient login returns success = true
[PASS] Test Patient role is loaded as PATIENT
[PASS] Test Patient receives valid JWT token
[PASS] Test Hospital login returns HTTP 200 OK
[PASS] Test Hospital login returns success = true
[PASS] Test Hospital role is loaded as HOSPITAL
[PASS] Test Hospital receives valid JWT token
[PASS] Finds active hospitals in 50km radius around Karamsad
[PASS] Hospitals are correctly sorted by distance in ascending order
[PASS] Progressive radius search expands candidate scope cleanly
[PASS] Finds capable hospitals for CARDIAC emergency
[PASS] All matched CARDIAC candidate hospitals have cardiology facility (hasCardiology: true)
[PASS] Finds capable hospitals for TRAUMA emergency
[PASS] All matched TRAUMA candidate hospitals have trauma unit (hasTraumaUnit: true)
[PASS] Calculates accurate distance in km
[PASS] Assigns valid matchScore to hospital candidates
[PASS] Gracefully handles invalid/NaN latitude/longitude coordinates (returns safe empty candidate set)
[PASS] Patient token cannot impersonate hospital or admin
[PASS] Hospital token is scoped to HOSPITAL role
[PASS] All 10+ regional demo hospital records are present in database
[PASS] Every regional test hospital is explicitly designated with [DEMO] in its name
--------------------------------------------------
SUMMARY: 22 Passed, 0 Failed
==================================================
```

---

## 5. Limitations & Production Guidelines

1. **Development Boundary**: All created accounts are restricted to local development/testing environments and must never be deployed or seeded into production databases.
2. **Fictional Data**: All hospital contact numbers and names are synthetic DEMO entries designed strictly for testing routing algorithms, distance calculations, and progressive radius expansion.
