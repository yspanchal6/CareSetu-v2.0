## Offline Architecture (Selective Offline — Emergency Continuity)
 
> MVP scope: **Selective Offline Architecture** — not the whole platform offline, only essential emergency functionality kept available without internet, syncing when connectivity returns.
 
### 1. High-Level Offline Architecture
 
```text
                         CARESETU PWA
                              │
                              ▼
                    Connectivity Manager
                              │
                    Internet Available?
                       /            \
                     YES             NO
                      │               │
                      ▼               ▼
               Online Backend    Offline Engine
                      │               │
                      │        ┌──────┴──────┐
                      │        ▼             ▼
                      │   Service Worker  IndexedDB
                      │        │             │
                      │        │       ┌─────┴─────┐
                      │        │       ▼           ▼
                      │        │   Local Data   Sync Queue
                      │        │       │           │
                      │        └───────┼───────────┘
                      │                ▼
                      │          Offline SOS
                      │                │
                      │          GPS + Case ID
                      │                │
                      │                ▼
                      │        Emergency Case
                      │          stored locally
                      │
                      └───────────────┐
                                      │
                           Internet Restored
                                      │
                                      ▼
                                Sync Engine
                                      │
                                      ▼
                              Backend Sync API
                                      │
                                      ▼
                           PostgreSQL + PostGIS
```
 
---
 
### 2. Offline Components
 
| Component | Role |
|---|---|
| **React/PWA** | Stays accessible after install; caches essential app shell |
| **Service Worker** | App caching, static assets, offline page load, network-independent requests, offline-first behavior |
| **IndexedDB** | Local storage of emergency contacts, minimal emergency profile, temp Case IDs, GPS, symptoms, pending cases, sync ops, cached approved guidance |
| **Connectivity Manager** | Decides online vs offline path |
| **Sync Engine** | Pushes queued offline data to backend once internet is restored |
 
```text
ONLINE
   ↓
Use Backend APIs
 
OFFLINE
   ↓
Use Local Offline Engine
```
 
```text
Offline Data
    ↓
Sync Queue
    ↓
Internet Restored
    ↓
Sync API
    ↓
Backend
    ↓
Database
```
 
---
 
### 3. Offline SOS Flow (most important offline feature)
 
```text
Patient
   ↓
CareSetu PWA
   ↓
Internet Unavailable
   ↓
Press SOS
   ↓
Capture GPS
   ↓
Generate Temporary Case ID
   ↓
Enter / Capture Problem
   ↓
Local Safety Rules
   ↓
Create Emergency Case
   ↓
Store in IndexedDB
   ↓
Add to Sync Queue
   ↓
Attempt Available Emergency Communication
   ↓
Internet Restored
   ↓
Sync Engine
   ↓
Backend
   ↓
PostgreSQL + PostGIS
   ↓
Hospital Matching
```
 
---
 
### 4. What Should Work Offline?
 
**✅ Must work offline**
- Open CareSetu PWA
- SOS
- GPS/location capture
- Temporary Case ID generation
- Symptom/problem input
- Emergency contact access
- Local emergency rules
- Emergency case creation locally
- Store case in IndexedDB
- Add case to sync queue
**⚠️ Limited / Cached**
- Basic approved healthcare guidance
- Previously cached patient emergency information
- Last-known hospital information *(must show last-updated time — availability may be stale)*
**❌ Online required**
- Live LLM/AI chatbot
- Real-time hospital availability
- Live hospital matching
- Hospital Accept/Reject
- Secure server-side Health Pack sharing
- Admin dashboard
- Server-side RAG
- Real-time notifications
---
 
### 5. Offline Emergency Data (minimum necessary only)
 
```text
IndexedDB
│
├── Emergency Contacts
├── Minimal Emergency Profile
│   ├── Blood Group
│   ├── Allergies
│   └── Critical Conditions
│
├── Temporary Case ID
├── GPS Location
├── Symptoms / Problem
├── Emergency Case
└── Sync Queue
```
 
> Do **not** store the complete patient medical record locally. Medical reports and large sensitive documents stay in secure server/file storage, not cached offline.
 
---
 
### 6. Offline Safety Engine
 
```text
User Symptom
     ↓
Local Safety Rule Engine
     ↓
Red Flag?
   /     \
 NO       YES
 │         │
 ▼         ▼
Normal   Critical
Guidance   │
           ▼
          SOS
```
 
**Example red-flag phrases:** "severe chest pain", "difficulty breathing", "unconscious", "severe bleeding"
 
> This is a **fallback safety mechanism**, not a medical diagnosis system.
 
---
 
### 7. Synchronization Architecture
 
```text
                 Internet Restored
                        │
                        ▼
                Connectivity Manager
                        │
                        ▼
                   Sync Engine
                        │
                        ▼
                 Read IndexedDB
                        │
                        ▼
                  Sync Queue
                        │
                        ▼
                Sync API / Backend
                        │
                        ▼
               Authentication Check
                        │
                        ▼
              Duplicate / Conflict Check
                        │
                        ▼
              PostgreSQL + PostGIS
                        │
                        ▼
                Sync Successful
                        │
                        ▼
             Update Local Record
```
 
> Use a unique **operation ID / idempotency key** for queued operations so a retry doesn't create the same emergency case twice.
 
---
 
### 8. Online → Offline → Online
 
```text
             ONLINE
                │
                ▼
        Backend + Database
                │
                │ Network Lost
                ▼
             OFFLINE
                │
                ▼
       Service Worker + IndexedDB
                │
                ▼
          Offline SOS
                │
                ▼
         Sync Queue
                │
                │ Network Restored
                ▼
             ONLINE
                │
                ▼
           Sync Engine
                │
                ▼
          Backend API
                │
                ▼
       PostgreSQL + PostGIS
                │
                ▼
       Hospital Matching
```
 
---
 
### 9. Security for Offline Data
 
- Store **minimum necessary data** offline
- Never store passwords or JWTs insecurely
- Protect sensitive local data using browser/platform security mechanisms
- Clear sensitive temporary data per retention rules
- Validate queued operations again on the server
- Never trust offline data just because it came from the local app
- Re-apply authentication and authorization after synchronization
---
 
### 10. Technology
 
| Component | Technology |
|---|---|
| Frontend | React |
| Offline App | PWA |
| Offline Cache | Service Worker |
| Local Database | IndexedDB |
| Network Detection | Browser Connectivity APIs |
| Offline Rules | JavaScript Safety Rule Engine |
| GPS | Browser Geolocation API |
| Sync | Custom Sync Engine + REST API |
| Backend | Node.js + Express |
| Main DB | PostgreSQL |
| Location | PostGIS |
| AI | Online only / cached fallback guidance |
 
---
 
### 11. Team Responsibility
 
| Component | Owner |
|---|---|
| Offline Architecture | You |
| PWA Architecture | You |
| Service Worker | You |
| IndexedDB Design | You |
| Sync Architecture | You |
| Offline SOS Implementation | M1 |
| GPS + Case ID | M1 |
| Local Safety Rules | M1 |
| Sync API Implementation | M1 + You |
| Database Sync Integration | You + M1 |
| Security Review | You |
 
---
 
### Final MVP Architecture (Offline)
 
```text
                         CARESETU
                            │
                         React PWA
                            │
                  Connectivity Manager
                     /              \
                  ONLINE           OFFLINE
                    │                 │
                    ▼                 ▼
              Express API       Service Worker
                    │                 │
                    │              IndexedDB
                    │                 │
                    │           Offline SOS
                    │                 │
                    │          GPS + Case ID
                    │                 │
                    │           Sync Queue
                    │                 │
                    └────────┬────────┘
                             │
                       Sync Engine
                             │
                             ▼
                    Node.js / Express
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
             PostgreSQL              PostGIS
                  │
                  ▼
            Hospital Matching
```
 
**Core principle:**
**Online = complete CareSetu functionality.**
**Offline = essential emergency continuity + local storage + SOS + synchronization.**