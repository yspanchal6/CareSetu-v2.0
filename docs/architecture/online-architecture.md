## Online Architecture (End-to-End System View)
 
> MVP flow: **React/PWA → Express Backend → Feature Services → PostgreSQL/PostGIS → AI Service → External Services**
 
### 1. High-Level Online Architecture
 
```text
                         CARESETU
                            │
                            ▼
                    React / PWA Frontend
                            │
                         HTTPS
                            │
                            ▼
                 Node.js + Express Backend
                            │
                 ┌──────────┴──────────┐
                 │     Middleware      │
                 │─────────────────────│
                 │ JWT Authentication  │
                 │ RBAC Authorization  │
                 │ Validation          │
                 │ Rate Limiting       │
                 │ Error Handling      │
                 └──────────┬──────────┘
                            │
                            ▼
                     API / Route Layer
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
  USER MODULE        EMERGENCY MODULE       HOSPITAL MODULE
  Feature 1          Feature 2              Feature 3
       │                    │                    │
       │                    │                    ▼
       │                    │             Hospital Matching
       │                    │                    │
       │                    ▼                    │
       │                SOS / Case               │
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
        HEALTH PACK       AI MODULE     ADMIN MODULE
        Feature 4                        Feature 5
             │              │              │
             │              ▼              │
             │        Python FastAPI       │
             │              │              │
             │       ┌──────┴──────┐       │
             │       ▼             ▼       │
             │      LLM           RAG      │
             │                     │       │
             │                  pgvector   │
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                 PostgreSQL Database
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
                PostGIS          File Storage
             GPS / Distance       Medical Reports
```
 
---
 
### 2. Frontend Layer
 
```text
React / PWA
│
├── Patient Portal
├── Hospital Portal
├── Admin Dashboard
├── AI Chatbot
├── Emergency SOS
├── Hospital Search
├── Health Pack
└── Case Tracking
```
 
All requests go through secure **HTTPS REST APIs**.
 
---
 
### 3. Backend Layer
 
```text
React
  ↓
HTTPS
  ↓
Express Server
  ↓
Middleware
  ↓
Routes
  ↓
Controllers
  ↓
Services
  ↓
Repositories
  ↓
Database
```
 
**Middleware — every protected request passes through:**
 
```text
Request
   ↓
JWT Authentication
   ↓
RBAC Authorization
   ↓
Input Validation
   ↓
Rate Limiting
   ↓
Controller
```
 
---
 
### 4. Feature Modules
 
**Feature 1 — User Management**
```text
User
 ↓
Register/Login
 ↓
JWT
 ↓
Role
 ├── Patient
 └── Hospital
 ↓
Profile
```
Uses: **React → Express → PostgreSQL**
 
**Feature 2 — Emergency SOS**
```text
Patient
   ↓
Symptom Input
   ↓
AI Safety Engine
   ↓
Emergency Signal
   ↓
SOS API
   ↓
Emergency Case
   ↓
Case ID + GPS
   ↓
Hospital Matching
```
Uses: **React + Express + PostgreSQL + PostGIS + AI**
 
**Feature 3 — Hospital Matching**
```text
Emergency Case
      ↓
Patient GPS
      ↓
Required Capability
      ↓
PostGIS
      ↓
8 km
 ↓ no match
16 km
 ↓ no match
32 km
 ↓ no match
64 km
      ↓
Suitable Hospitals
      ↓
Hospital Request
```
Matching criteria: **Capability + Availability + Distance**
 
**Feature 4 — Health Pack**
```text
Hospital Accepts Case
          ↓
Authorization / Consent
          ↓
Health Pack Service
          ↓
Minimum Required Data
          ↓
Secure Medical Data
          ↓
Assigned Hospital
```
> The hospital should only receive the **minimum necessary information**.
 
**Feature 5 — Admin**
```text
Admin
 ↓
Admin Dashboard
 ↓
Users
Hospitals
Emergency Cases
Audit Logs
Verification
System Monitoring
```
 
---
 
### 5. AI Architecture Inside Online System
 
```text
                Express Backend
                      │
                 AI Controller
                      │
                  AI Service
                      │
                      ▼
               Python FastAPI
                      │
               AI Orchestrator
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Symptom      Intent       RAG
      Extraction   Detection      │
          │           │           ▼
          │           │        pgvector
          │           │           │
          └───────────┼───────────┘
                      ▼
                 LLM / Model
                      │
                      ▼
              AI Response/Signal
                      │
                      ▼
             Safety Rule Engine
                 │         │
              Normal     Critical
                 │         │
                 ▼         ▼
             AI Answer    SOS
```
 
> The **Safety Rule Engine** remains the deterministic safety layer between AI output and emergency routing.
 
---
 
### 6. Database Architecture
 
```text
                  PostgreSQL
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
     Core          PostGIS        pgvector
     Data          Location         RAG
       │              │              │
       ▼              ▼              ▼
 Users           GPS Data       Knowledge
 Patients        Distance       Embeddings
 Hospitals       Matching
 Cases
 Health Packs
 Consent
 Audit Logs
```
 
> Medical reports themselves are stored in **secure file/object storage**; PostgreSQL stores their metadata and access information.
 
---
 
### 7. Complete Online Emergency Flow
 
```text
Patient
   │
   ▼
React / PWA
   │
   ▼
AI Chatbot
   │
   ▼
Express Backend
   │
   ▼
Python AI Service
   │
   ▼
LLM / NLP
   │
   ▼
Safety Rule Engine
   │
   ├──────── Normal ────────► Healthcare Guidance
   │
   └──────── Critical
              │
              ▼
             SOS
              │
              ▼
       Emergency Case
              │
              ├── Case ID
              └── GPS
                    │
                    ▼
                 PostGIS
                    │
                    ▼
             Hospital Matching
                    │
                    ▼
           2 → 4 →.. n*2 .. → 64 km
                    │
                    ▼
             Hospital Request
                    │
             ┌──────┴──────┐
             ▼             ▼
          Accept         Reject
             │             │
             ▼             ▼
       Assign Hospital   Next Hospital
             │
             ▼
       Emergency Health Pack
             │
             ▼
          Treatment
             │
             ▼
         Case Closure
```
 
---
 
### 8. External Services
 
```text
CareSetu Backend
      │
 ┌────┼─────────┬──────────┬─────────┐
 ▼    ▼         ▼          ▼         ▼
LLM  Maps      SMS       Push      Storage
API   /GPS   Provider   Service     Service
```
 
> For the MVP, external integrations should stay replaceable through service modules rather than hard-coded throughout the application.
 
---
 
### Final Architecture Principle
 
```text
                    CARESETU ONLINE
                          │
                     React / PWA
                          ↓
                  Node.js + Express
                          ↓
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
       Feature         AI Service       Admin
       Modules         FastAPI          Module
          │               │
          └───────┬───────┘
                  ↓
             PostgreSQL
                  │
          ┌───────┼────────┐
          ↓       ↓        ↓
       PostGIS pgvector File Storage
```