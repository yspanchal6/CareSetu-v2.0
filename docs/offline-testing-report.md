# CareSetu — Master Offline Testing & Verification Report

## Verification Overview

- **Test Suite Date:** September 19, 2026
- **Test Target:** CareSetu Offline-First PWA Architecture (Phases 0 - 27)
- **Database Engine:** PostgreSQL 17 (Port 8080) + PostGIS as Authoritative Server Source of Truth
- **Client Storage:** Versioned IndexedDB (`CareSetuOfflineMasterDB` v2) + Service Worker Cache API
- **Verification Result:** ALL 10 SECURITY & OFFLINE SYSTEM ASSERTIONS PASSED (100% SUCCESS RATE)

---

## Executed Automated Test Cases (`backend/tests/offline.security.test.js`)

| # | Test Assertion | Target System | Result | Evidence |
| :-: | :--- | :--- | :-: | :--- |
| 1 | PostgreSQL Database Connection | Server (Port 8080) | **PASS (GREEN)** | Connected & queried `SELECT 1` |
| 2 | EmergencyCase Table Query | PostgreSQL Schema | **PASS (GREEN)** | Counted existing cases without schema error |
| 3 | Guest/Patient Account Isolation | PostgreSQL User Model | **PASS (GREEN)** | Role-based RBAC boundary verified |
| 4 | IndexedDB Sensitive Store Definitions | `offlineDB.ts` | **PASS (GREEN)** | 10 stores initialized without security breaches |
| 5 | SW `SENSITIVE_NETWORK_ONLY` Policy | `public/sw.js` | **PASS (GREEN)** | Policy explicitly enforced for sensitive endpoints |
| 6 | Exclude `/api/healthpack` from SW Cache | Service Worker Router | **PASS (GREEN)** | HealthPack network-only rule verified |
| 7 | Exclude `/api/documents` from SW Cache | Service Worker Router | **PASS (GREEN)** | Private document network-only rule verified |
| 8 | IdempotencyKey Transmission | `syncEngine.ts` | **PASS (GREEN)** | `operationId` passed as `idempotencyKey` |
| 9 | 409 Duplicate Response Handling | `syncEngine.ts` | **PASS (GREEN)** | 409 Conflict resolved safely to `SYNCED` |
| 10 | Concurrent Sync Pass Guard | `syncEngine.ts` | **PASS (GREEN)** | `isSyncingInProgress` lock prevents race conditions |

---

## E2E Browser Test Verification Matrix

| Flow | Offline Behavior | Reconnection Behavior | Status |
| :--- | :--- | :--- | :-: |
| **Offline SOS Reporting** | Captures GPS location & symptoms, assigns UUID `operationId`, saves to `sos_queue` store with `PENDING_SYNC`. Displays: *"SOS saved locally. It has not yet been delivered to the server."* | Auto-flushes queue with `idempotencyKey`. Upon 200/201 response, transitions to `SYNCED` and redirects to live case. | **GREEN** |
| **Offline Doctor AI Chat** | Guest/Patient receives explicit message: *"Offline mode: Live AI services and personalized medical data are currently unavailable."* Red-flag detection continues operating locally. | Live LLM & RAG pipeline restored automatically upon reconnection. | **GREEN** |
| **Offline Hospital Directory** | Displays cached public hospital cards with notice: *"Showing previously cached hospital information. (Last updated: ...)"* | Live bed capacity and active matching revalidate automatically. | **GREEN** |
| **Offline Contact Support** | Captures support request draft into `contact_queue` store with notice: *"Your support request is saved and will be submitted when you're online."* | Sync Engine flushes draft to `/api/contact`. Updates UI to *"Support request submitted."* | **GREEN** |
| **Offline Help & FAQ Center** | Queries `help_content` IndexedDB store and displays offline help content. | Refreshes FAQ versions seamlessly. | **GREEN** |
| **HealthPack Privacy** | Blocked from offline cache and SW storage. Displays *"Connect to network to access HealthPack"*. | Fully available when authenticated online. | **GREEN** |
| **Document Privacy** | Medical uploads and OCR explicitly rejected offline and blocked in Service Worker cache. | Re-enables document upload when online. | **GREEN** |
