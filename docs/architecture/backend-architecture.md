## Backend Architecture (Modular Layered — Feature & Team-Split Aligned)
 

 
```text
                         CARESETU BACKEND
                                │
                         REST API / HTTPS
                                │
                    ┌───────────┴───────────┐
                    │    API GATEWAY /      │
                    │    EXPRESS SERVER     │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │      MIDDLEWARE       │
                    │───────────────────────│
                    │ Authentication (JWT)  │
                    │ RBAC / Authorization  │
                    │ Input Validation      │
                    │ Rate Limiting         │
                    │ Error Handling        │
                    │ Logging               │
                    └───────────┬───────────┘
                                │
                         ROUTES / API
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
        ▼                       ▼                        ▼
 ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
 │ USER MODULE  │       │  EMERGENCY   │       │   HOSPITAL   │
 │   Feature 1  │       │   Feature 2  │       │   Feature 3  │
 ├──────────────┤       ├──────────────┤       ├──────────────┤
 │ Auth         │       │ SOS          │       │ Hospital     │
 │ Profile      │       │ Case         │       │ Capability   │
 │ Roles        │       │ GPS          │       │ Availability │
 │ RBAC         │       │ Case Status  │       │ Matching     │
 └──────┬───────┘       └──────┬───────┘       │ Requests     │
        │                       │              └─────┬────────┘
        │                       │                    │
        └───────────────────────┼────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
        ▼                       ▼                        ▼
 ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
 │ HEALTH PACK  │       │ AI MODULE    │       │ ADMIN MODULE │
 │   Feature 4  │       │              │       │   Feature 5  │
 ├──────────────┤       ├──────────────┤       ├──────────────┤
 │ Consent      │       │ Chatbot      │       │ Users        │
 │ Data Filter  │       │ LLM API      │       │ Hospitals    │
 │ Health Pack  │       │ Triage       │       │ Cases        │
 │ Secure Share │       │ Safety       │       │ Verification │
 │ Audit        │       │ RAG/OCR      │       │ Audit Logs   │
 └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                    ┌────────────────────────┐
                    │      SERVICE LAYER     │
                    ├────────────────────────┤
                    │ Auth Service           │
                    │ Emergency Service      │
                    │ Matching Service       │
                    │ Health Pack Service    │
                    │ AI Service             │
                    │ Notification Service   │
                    │ Consent Service        │
                    │ Audit Service          │
                    └────────────┬───────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    REPOSITORY / DATA    │
                    │         ACCESS          │
                    ├─────────────────────────┤
                    │ User Repository         │
                    │ Patient Repository      │
                    │ Hospital Repository     │
                    │ Emergency Repository    │
                    │ Health Pack Repository  │
                    │ Audit Repository        │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼───────────────────┐
              ▼                  ▼                   ▼
       PostgreSQL            PostGIS             pgvector
       Main Database       GPS/Distance          RAG Data
              │
              ▼
       Secure File Storage
       Medical Reports
```
 
---
 
### Recommended Backend Folder Structure
 
```text
backend/
│
├── src/
│   ├── app.js
│   ├── server.js
│   │
│   ├── config/
│   │   ├── database.js
│   │   ├── env.js
│   │   └── security.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js
│   │   ├── validation.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── error.middleware.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── emergency.routes.js
│   │   ├── hospitals.routes.js
│   │   ├── matching.routes.js
│   │   ├── healthPack.routes.js
│   │   ├── ai.routes.js
│   │   └── admin.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── emergency.controller.js
│   │   ├── hospital.controller.js
│   │   ├── matching.controller.js
│   │   ├── healthPack.controller.js
│   │   ├── ai.controller.js
│   │   └── admin.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── emergency.service.js
│   │   ├── matching.service.js
│   │   ├── healthPack.service.js
│   │   ├── ai.service.js
│   │   ├── notification.service.js
│   │   ├── consent.service.js
│   │   └── audit.service.js
│   │
│   ├── repositories/
│   │   ├── user.repository.js
│   │   ├── patient.repository.js
│   │   ├── hospital.repository.js
│   │   ├── emergency.repository.js
│   │   ├── healthPack.repository.js
│   │   └── audit.repository.js
│   │
│   ├── validators/
│   ├── utils/
│   └── constants/
│
├── tests/
├── package.json
├── .env.example
└── Dockerfile
```
 
---
 
### Standard Request Flow
 
Every request should follow:
 
```text
React/PWA
    ↓
HTTPS REST API
    ↓
Express
    ↓
Middleware
 ├── JWT
 ├── RBAC
 ├── Validation
 └── Rate Limit
    ↓
Route
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL / PostGIS
```
 
**Example — SOS flow:**
 
```text
SOS Button
    ↓
POST /api/emergency/sos
    ↓
JWT + RBAC
    ↓
Emergency Controller
    ↓
Emergency Service
    ↓
Create Case
    ↓
Generate Case ID
    ↓
Save GPS → PostGIS
    ↓
Hospital Matching Service
    ↓
Hospital Request
```
 
---
 
### AI Integration (kept as a separate service, not embedded in Express)
 
```text
React
  ↓
Express
  ↓
AI Controller
  ↓
AI Service
  ↓
Python FastAPI
  ↓
LLM / Hugging Face
  ↓
AI Result
  ↓
Safety Rule Engine
  ↓
Express
  ↓
Normal Response / Emergency Flow
```
 
**Emergency detection path:**
 
```text
User Message
     ↓
AI Service
     ↓
Symptoms / Red Flags
     ↓
JavaScript Safety Rule Engine
     ↓
Critical?
 ┌───┴────┐
No       Yes
↓         ↓
Answer    SOS Flow
```
 
> This separation is important because **the LLM should not directly control the SOS action**.
 
---
 
### Database Layer
 
```text
                 DATA LAYER
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
 PostgreSQL       PostGIS       pgvector
 Core Data       Location       RAG
       │
       ↓
 Secure File Storage
 Medical Reports
```
 
> Overall DB architecture/schema is owned centrally, while feature owners (M1/M2/M4) implement the database operations required by their own features.
 
---
