# CareSetu Database Architecture & Schemas

## Folder Overview
Contains documentation regarding PostgreSQL relational schema designs, Prisma ORM entity models, PostGIS spatial indexing strategies, and database migration histories.

## Key Models Documented
- `User` & `AccountCredentialUpdate` — User profiles and OTP verification states.
- `EmergencyCase` — Emergency SOS case lifecycle records.
- `Hospital` & `BedCapacity` — Hospital profiles, PostGIS geolocation points, and real-time bed availability counts.
- `MedicalDocument` & `HealthPackConsent` — Encrypted record storage metadata and hospital consent tracking.
- `AIChatMessage` & `AIAnalysis` — Doctor AI conversation logs and extracted clinical NER entities.
