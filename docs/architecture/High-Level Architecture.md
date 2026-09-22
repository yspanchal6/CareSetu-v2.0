## 1. High-Level Architecture
*   **Client Layer:** React 18 Progressive Web App (PWA) built with Vite.
*   **Application Layer:** Node.js 20 / Express.js REST API.
*   **Data Layer:** PostgreSQL 16.
*   **Spatial & Vector Layer:** PostGIS for spatial matching (8km→64km radius); pgvector for First-Aid RAG knowledge retrieval.
*   **AI Layer:** External LLM API (Gemini/OpenAI) with a local deterministic Safety Rule Engine.

```text
                        CARESETU SYSTEM
                              |
                        HTTPS / REST API
                              |
                              v
        +--------------------------------------------+
        |            CLIENT LAYER (Frontend)         |
        |--------------------------------------------|
        |  Patient Web/PWA   Hospital Portal   Admin |
        |     [React]          [React]        [React]|
        |  (Offline via PWA/Service Worker)          |
        +--------------------------------------------+
                              |
                        REST API / HTTPS
                              |
                              v
        +--------------------------------------------+
        |     API GATEWAY / EXPRESS SERVER (Node.js) |
        +--------------------------------------------+
                              |
                              v
        +--------------------------------------------+
        |                MIDDLEWARE                  |
        |  - Authentication (JWT)                    |
        |  - RBAC / Authorization                    |
        |  - Input Validation                        |
        |  - Rate Limiting                           |
        |  - Error Handling / Logging                |
        +--------------------------------------------+
                              |
                        ROUTES / API
              /            |            \
             v             v             v
     +-----------+  +-------------+  +-----------+
     |   AUTH    |  |  PATIENT    |  | EMERGENCY |
     |  MODULE   |  |  MODULE     |  |  MODULE   |
     |-----------|  |-------------|  |-----------|
     | Login     |  | Profile     |  | SOS       |
     | Signup    |  | Medical Rec |  | Case ID   |
     | Password  |  | Upload Rep. |  | GPS Loc.  |
     | Check     |  |             |  | Status    |
     +-----------+  +-------------+  +-----------+
              \            |            /
               v           v           v
     +-----------+  +-------------+  +-----------+
     | HOSPITAL  |  |  AI GATEWAY |  |  ADMIN    |
     |  MODULE   |  |             |  |  MODULE   |
     |-----------|  |-------------|  |-----------|
     | Login     |  | Chat        |  | User Mgmt |
     | Dashboard |  | Symptom In. |  | Hosp.     |
     | Alerts    |  | Analysis    |  |  Verify   |
     | Accept/   |  | Forward to  |  | Audit Logs|
     |  Reject   |  |  AI Service |  |           |
     +-----------+  +-------------+  +-----------+
                              |
                              v
        +----------------------------------------------+
        |              AI SERVICE (Python+FastAPI)     |
        |----------------------------------------------|
        |  NLP Module: intent, entity, symptom extract |
        |  RAG (pgVector): healthcare KB, first-aid    |
        |  Emergency Detection Engine:                 |
        |     Risk check -> RED/ORANGE/YELLOW/GREEN    |
        +----------------------------------------------+
                              |
                              v
        +--------------------------------------------+
        |         DATA LAYER (PostgreSQL + PostGIS)  |
        |--------------------------------------------|
        |  Users | Patients | Hospitals |            |
        |  Emergency Cases | Health Packs (encrypted)|
        +--------------------------------------------+
                              |
                              v
        +----------------------------------------------+
        |              EXTERNAL SERVICES               |
        |----------------------------------------------|
        |  SMS (Twilio) -> 108 / Hospital              |
        |  Push Notification (Firebase)                |
        |  GPS/Location API (free Map API)             |
        |  Payment Gateway (optional)                  |
        |  Emergency Numbers 108/112 (future)          |
        +----------------------------------------------+

```

**Security layer** (applies across all modules):
- JWT Token based auth
- Password encryption (bcrypt)
- Role-based access check (Patient / Hospital / Admin)

---

## Layer 1 — Frontend

| Client | Tech | Notes |
|---|---|---|
| Patient Web / PWA | React | Works offline (PWA capability) |
| Hospital Portal | React | |
| Admin Panel | React | |

**Tech:** React + PWA — *helps the app work without internet*

Communication to backend: **HTTPS / REST API**

---

## Layer 2 — Application Layer (Backend)

**Core:** Node.js + Express — API Gateway

**Middleware:**
- JWT Authentication
- RBAC (Role-Based Access Control)
- Input Validation
- Rate Limiting

### Modules

**1. Auth Module**
- Login
- Signup
- Password check

**2. Patient Module**
- Profile
- Medical records
- Upload reports

**3. Emergency Module**
- SOS
- Case ID
- GPS location
- Hospital matching
- Meeting/status updates

**4. Hospital Module**
- Login
- Dashboard
- Alerts
- Accept / Reject case

**5. AI Gateway**
- Chat
- Symptom input
- Analysis
- Forward request to AI Service

**6. Admin Module**
- User management
- Hospital verification
- Audit logs

### Security
- JWT Token based auth
- Password encryption (bcrypt)
- Role check (Patient / Hospital / Admin)

---

## Layer 3 — Data & Services

### Data Layer (Database)

| Entity | Fields |
|---|---|
| **Users** | email, password, role (Patient/Hospital/Admin) |
| **Patients** | blood group, past reports, allergies, conditions |
| **Hospitals** | name, location, capability, emergency availability |
| **Emergency Cases** | case ID, symptoms, GPS location, status |
| **Health Packs** | encrypted patient info |

**Tech:** PostgreSQL / PostGIS

---

### AI Service (Python + FastAPI)

**1. NLP Module**
- Understanding
- Intent & entity extraction
- Symptom extraction

**2. RAG (Knowledge Layer)**
- pgVector store
- Healthcare knowledge base
- First-aid guidance
- Handling general health info, etc.

**3. Emergency Detection Engine**
- Checks risk / seriousness of case
- Flag detection: **RED / Orange / Yellow / Green**

**Technology:** Python + FastAPI, Hugging Face models

---

### External Services

**SMS Service (Twilio)**
- Send SMS
- 108 integration
- Hospital notification

**Push Notifications**
- Firebase

**GPS / Location API**
- Location, distance, directions
- Uses free Map API (OpenStreetMap)

**Payment Gateway** *(optional)*
- For premium services

**Emergency Numbers** *(future integration)*
- 108 / 112

---

## Data Flow Summary
```
            Patient/Hospital/Admin (React + PWA)
                      │
                      ▼  HTTPS / REST API
            Node.js + Express API Gateway
            (JWT Auth → RBAC → Validation → Rate Limiting)
                      │
    ┌─────────────────┼──────────────────────┐
    ▼                 ▼                      ▼
 Auth           Patient/Hospital/       AI Gateway ──► AI Service (Python+FastAPI)
 Module         Emergency/Admin           (NLP → RAG → Emergency Detection Engine)
    │            Modules
    ▼
PostgreSQL/PostGIS (Users, Patients, Hospitals, Emer_Cases, Health Packs)
    │
    ▼
External Services: Twilio SMS, Firebase Push, GPS/Map API, Payment Gateway, 108/112
```