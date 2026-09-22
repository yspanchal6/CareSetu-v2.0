# Implement Emergency SOS Architecture

This plan outlines the steps to refactor the Emergency SOS flow to match the provided architecture diagram.

## User Review Required

> [!IMPORTANT]
> - We will create a new **Repository** layer for database interactions as shown in the diagram.
> - We will extract the **Safety Rule Engine** and **Hospital Matching Service** into separate service files to ensure clean core logic.
> - We will implement the missing database creations for `HospitalRequest`, `AuditLog`, and `Notification`.

## Open Questions

> [!NOTE]
> Are there any specific capabilities strings or emergency types mapping you want the Safety Rule Engine and Hospital Matching Service to strictly follow, or should I implement sensible defaults for the MVP (e.g., CARDIAC maps to hasCardiology=true)?

## Proposed Changes

### Repositories

#### [MODIFY] [emergency.repository.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu/backend/src/repositories/emergency.repository.js)
Implement the `EmergencyRepository` to handle all interactions with PostgreSQL (via Prisma) for the SOS flow:
- `getPatientByUserId`
- `createEmergencyCase`
- `findHospitals`
- `createHospitalRequests`
- `createAuditLog`
- `createNotification`

### Services

#### [NEW] [safety-rule-engine.service.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu/backend/src/services/safety-rule-engine.service.js)
Implement the Safety Rule Engine:
- Analyze `symptoms`, `emergencyType`, and `severity`.
- Apply deterministic rules to calculate the final severity level (e.g. RED, ORANGE, YELLOW, GREEN).

#### [NEW] [hospital-matching.service.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu/backend/src/services/hospital-matching.service.js)
Implement the Hospital Matching Service:
- Filter hospitals based on `emergencyAvailable` and required capabilities matching the emergency type.
- Calculate distance and rank the best suitable hospitals.

#### [MODIFY] [emergency.service.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu/backend/src/services/emergency.service.js)
Refactor `createEmergencyCase` to act as the core orchestrator:
1. Verify patient (via Repository).
2. Validate GPS.
3. Generate Case ID.
4. Run Safety Rule Engine to determine final severity.
5. Create Emergency Case (via Repository).
6. Call Hospital Matching Service.
7. Create Hospital Requests (via Repository).
8. Create Audit Log (via Repository).
9. Publish Notification Events (via Repository).

### Controllers

#### [MODIFY] [emergency.controller.js](file:///d:/2_YASH/SIH/CareSetu/CareSetu/backend/src/controllers/emergency.controller.js)
- Update `createSOS` to pass the necessary data and handle the response correctly based on the refactored service.

## Verification Plan

### Manual Verification
- We will trigger a `POST /api/emergency/sos` request and verify that:
    - The Emergency Case is created with correctly evaluated severity.
    - `HospitalRequest` records are generated for the matched hospitals.
    - An `AuditLog` is created.
    - `Notification` records are created for the matched hospitals.
