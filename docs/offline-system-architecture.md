# CareSetu — Master Offline-First System Architecture

## Overview

CareSetu is built on a resilient **Offline-First PWA Architecture** designed for high availability during medical emergencies, network dropouts, and degraded connectivity.

The architecture strictly maintains **Server Authority** (PostgreSQL + PostGIS database) while leveraging structured browser persistence (**IndexedDB** + **Service Worker Cache API**) for client resilience.

```
                     CARESETU PWA
                          |
                Connectivity Manager
             (useConnectivity hook & health pings)
                          |
            +-------------+-------------+
            |                           |
         ONLINE                       OFFLINE
            |                           |
            v                           v
      API / Backend             Offline Data Layer
            |                    |
            |              +-----+------+
            |              |            |
            |          IndexedDB     Cache API
            |        (offlineDB.ts)   (sw.js)
            |              |            |
            |          Offline Queue    |
            |              |            |
            +-------- Sync Manager <----+
                    (syncEngine.ts)
                          |
                   Reconnection
                          |
                 Node.js / Express
                          |
                +---------+---------+
                |                   |
              Redis             PostgreSQL
          Cache / Limits       + PostGIS (Source of Truth)
```

---

## Component Specifications

### 1. Persistence Layer (IndexedDB - `offlineDB.ts`)
- **Database Name:** `CareSetuOfflineMasterDB` (Schema Version 2)
- **Engine:** Versioned browser IndexedDB (SQLite WASM intentionally excluded per architectural decision)
- **Stores & Scope:**
  1. `sos_queue` — Queued Emergency SOS operations (keyPath: `operationId`, Index: `syncStatus`)
  2. `emergency_profile` — Session-bound minimal profile (keyPath: `id`, Index: `sessionUserId`)
  3. `hospital_directory` — Cached public hospital directory (keyPath: `id`, Index: `cachedAt`)
  4. `contact_queue` — Queued support request drafts (keyPath: `operationId`, Index: `syncStatus`)
  5. `help_content` — Cached Help & FAQ items (keyPath: `id`, Index: `version`)
  6. `sync_metadata` — Synchronization timestamps & metadata (keyPath: `key`)
  7. `operations_log` — Local operational log (keyPath: `id`)
  8. `offline_drafts` — Form drafts (keyPath: `id`)
  9. `ai_offline_state` — Doctor AI offline safety rule state (keyPath: `key`)
 10. `cache_metadata` — Cache TTLs and invalidation tags (keyPath: `key`)

### 2. Service Worker Layer (`public/sw.js`)
- **Cache Name:** `caresetu-shell-v3`, `caresetu-data-v1`
- **Application Shell:** Precaches `/`, `/index.html`, `/offline.html`, `/manifest.json`, main bundles.
- **Routing Policies:**
  - `STATIC_ASSETS`: Cache-First
  - `PUBLIC_CACHEABLE`: Stale-While-Revalidate (`/api/hospitals/nearby`, `/api/help`)
  - `SENSITIVE_NETWORK_ONLY`: Network-Only (`/api/healthpack`, `/api/documents`, `/api/auth`, `/api/doctor-ai/upload`)

### 3. Sync Engine (`syncEngine.ts`)
- Single-pass background and reactive sync worker with lock guard (`isSyncingInProgress`).
- Bounded retries with exponential backoff and randomized jitter.
- Enforces server idempotency via `operationId` pass-through.
- Terminal failure handling (400, 404, 422 mark `FAILED`).
- 409 Conflict handling (safely resolved as `SYNCED`, server wins).

### 4. Server Source of Truth
- PostgreSQL / PostGIS remains authoritative for:
  - User roles & RBAC permissions
  - Document verification & HealthPack authorization
  - Hospital case acceptance & emergency final status
  - Password resets & OTP verifications
