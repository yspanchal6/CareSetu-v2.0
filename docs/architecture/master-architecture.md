# CareSetu Architecture Document (SIH 2026)

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


## Data Flow Summary

```
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


## 2. Backend Architecture
*   **Pattern:** Strict Controller-Service architecture separating HTTP routing from business logic.
*   **Microservice-Inspired Monolith:** Domain-driven routing (`/auth`, `/emergency`, `/hospital`, `/ai`).
*   **Middleware Stack:** Global Error Handler → JWT Verification → Role-Based Access Control (Patient/Hospital) → Controllers.

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
        │                      │               └──────┬───────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
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


## 3. Security Architecture
*   **Data at Rest/Transit:** AES-256 encryption applied via Node.js native `crypto` for the Emergency Health Pack. Decryption keys exchange strictly upon case `ACCEPTED` status.
*   **Authentication:** Bcrypt password hashing and short-lived JSON Web Tokens (JWTs).
*   **Auditability:** Immutable logging of all Health Pack access events.


```text
                          INCOMING REQUEST
                                 |
                                 v
        +----------------------------------------------+
        |          LAYER 1 — NETWORK SECURITY          |
        |----------------------------------------------|
        |  HTTPS / SSL Certificate (data encrypted)    |
        |  Firewall (only necessary ports open)        |
        |  Rate Limiting (max 100 req/min)             |
        |  DDoS Protection                             |
        +----------------------------------------------+
                                 |
                          (blocked: HTTP, DB port,
                           excess requests)
                                 v
        +----------------------------------------------+
        |     LAYER 2 — AUTHENTICATION (Who are you)   |
        |----------------------------------------------|
        |  Login (email + password)                    |
        |  Password Hashing (bcrypt)                   |
        |  JWT Token (24h valid, sent every request)   |
        |  Session Management                          |
        +----------------------------------------------+
                                 |
                        (invalid creds/token
                              rejected)
                                 v
        +----------------------------------------------+
        |   LAYER 3 — ACCESS AUTHORIZATION (RBAC)      |
        |----------------------------------------------|
        |  Patient Role   Hospital Role   Admin Role   |
        |  own data only  assigned cases  full access  |
        |  send SOS       accept/reject   manage users |
        |  chat with AI   download pack   verify hosp. |
        +----------------------------------------------+
                                 |
                          (role mismatch
                             → blocked)
                                 v
        +----------------------------------------------+
        |       LAYER 4 — INPUT VALIDATION             |
        |----------------------------------------------|
        |  Schema Validation (Zod)                     |
        |  XSS Prevention                              |
        |  CSRF Protection                             |
        |  SQL Injection Prevention                    |
        +----------------------------------------------+
                                 |
                                 v
        +----------------------------------------------+
        |      LAYER 5 — AUDIT & COMPLIANCE            |
        |----------------------------------------------|
        |  Audit Logging                               |
        |  Consent Management                          |
        |  Data Minimization                           |
        |  Privacy Compliance                          |
        +----------------------------------------------+
                                 |
                                 v
                        REQUEST REACHES
                        APPLICATION LOGIC
 
   ────────────────  CROSS-CUTTING: DATA SECURITY  ────────────────
        Encryption at Rest (AES-256) | Encryption in Transit (TLS 1.3)
        Secure File Storage | Database Security Hardening
```

----

## 4. AI Architecture
*   **Safety Rule Engine:** Hardcoded JavaScript RegEx interceptor. Detects critical symptoms (e.g., "chest pain", "bleeding") to instantly bypass the LLM and trigger the SOS routing flow.
*   **Prompt Wrapper:** Injects strict system prompts preventing the LLM from diagnosing.
*   **RAG (pgvector):** Performs cosine similarity search against a verified first-aid database to ground LLM responses in medical facts.

Complete CareSetu AI Architecture
 
```text
                              CARESETU
                                 │
                            React / PWA
                                 │
                                 ▼
                         Node.js / Express
                                 │
                       ┌─────────┴─────────┐
                       │                   │
                       ▼                   ▼
                  AI Service          Core Backend
                       │                   │
                       ▼                   │
                Python / FastAPI           │
                       │                   │
                AI Orchestrator            │
                       │                   │
          ┌────────────┼────────────┐      │
          ▼            ▼            ▼      │
       NLP/Symptom    RAG          LLM     │
       Extraction      │            │      │
          │            ▼            │      │
          │        pgvector         │      │
          │                         │      │
          └────────────┬────────────┘      │
                       ▼                   │
                Emergency Signal           │
                       │                   │
                       ▼                   │
              Safety Rule Engine           │
                       │                   │
                ┌──────┴──────┐            │
                ▼             ▼            │
              Normal       Critical        │
                │             │            │
                ▼             ▼            │
           RAG Response      SOS ──────────┘
                              │
                              ▼
                         GPS + Case ID
                              │
                              ▼
                       Hospital Matching
                              │
                              ▼
                       Emergency Health
                            Pack
```
 

## 5. Online/Offline Architecture
*   **Caching:** IndexedDB stores the user's base medical profile and static UI shell.
*   **SOS Queue:** Service Workers use the Background Sync API. If an SOS is triggered offline, the payload (GPS + Symptoms) is queued locally and transmitted the millisecond network connectivity returns.

## 1. High-Level Architecture

```text
                         CARESETU PWA
                              │
                     Connectivity Manager
                              │
                 ┌────────────┴────────────┐
                 │                         │
              ONLINE                    OFFLINE
                 │                         │
                 ▼                         ▼
          Backend APIs              Local Storage
                 │                  IndexedDB + Cache
                 │                         │
                 ▼                         ▼
        ┌─────────────────┐        ┌─────────────────┐
        │ Node.js/Express  │        │ Offline Engine  │
        └────────┬────────┘        └────────┬────────┘
                 │                          │
       ┌─────────┼─────────┐                │
       ▼         ▼         ▼                ▼
   PostgreSQL  AI Service  PostGIS      Local Emergency
       │         │         │            Rules + SOS Queue
       │         │         │                │
       └─────────┼─────────┘                │
                 │                          │
                 ▼                          │
             CareSetu                      │
              Services                     │
                                            │
                       Internet Restored    │
                              │             │
                              └──────┬──────┘
                                     ▼
                              Sync Engine
                                     │
                                     ▼
                              Backend APIs
                                     │
                                     ▼
                              PostgreSQL
```
## 2. Combined Architecture
> This is the diagram I would use in your *main architecture documentation:*

```text

                           CARESETU PWA
                               │
                       Connectivity Manager
                               │
                  ┌────────────┴────────────┐
                  │                         │
               ONLINE                    OFFLINE
                  │                         │
                  ▼                         ▼
           Node.js / Express         Service Worker
                  │                         │
        ┌─────────┼─────────┐          IndexedDB
        ▼         ▼         ▼              │
      User      AI       Emergency         │
        │         │         │               │
        │      FastAPI      │               │
        │         │         │               │
        │      LLM/RAG      │               │
        │         │         │               │
        │    Safety Engine  │               │
        │         │         │               │
        └─────────┼─────────┘               │
                  │                         │
                  ▼                         ▼
             PostgreSQL                Offline SOS
                  │                  GPS + Case ID
                  ├── PostGIS              │
                  ├── pgvector             │
                  └── File Storage         │
                                            │
                                            ▼
                                       Sync Queue
                                            │
                                  Internet Restored
                                            │
                                            ▼
                                       Sync Engine
                                            │
                                            ▼
                                    Backend / APIs
                                            │
                                            ▼
                                       PostgreSQL
```
## 6. Conceptual ERD
*   **Users (1)** ↔ **(1) Patient Profile** OR **(1) Hospital Profile**
*   **Hospital Profile (1)** ↔ **(1) Hospital Capabilities**
*   **Patient (1)** ↔ **(N) Emergency Cases**
*   **Emergency Case (N)** ↔ **(1) Matched Hospital**
*   **Emergency Case (1)** ↔ **(1) Health Pack**