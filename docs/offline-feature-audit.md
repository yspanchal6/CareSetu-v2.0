# CareSetu Complete Offline-First Feature Audit

**Date:** September 19, 2026  
**System:** CareSetu PWA — Emergency Healthcare Coordination Network  
**Authority:** PostgreSQL / PostGIS (Backend Database Server)  
**Local Database:** IndexedDB (`offlineDB.ts` / `offlineSync.ts`) + Service Worker Cache API  

---

## Complete Feature Inventory & Audit Matrix

| Feature | Current Online Support | Current Offline Support | Missing Offline Support | Security Risk | Privacy Risk | Recommended Strategy | Implementation Status | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Emergency SOS Creation** | Full live creation, hospital matching & Socket.IO dispatch | Queued in IndexedDB (`sos_queue`) with `operationId` idempotency | Truthful status tracking UI for pending sync | LOW (idempotency enforced) | LOW (GPS location only with permission) | Queue offline with `PENDING_SYNC` status, show truthful notice, sync on reconnect | IMPLEMENTED | GREEN |
| **Emergency Status Tracking** | Real-time Socket.IO + HTTP polling | Local `PENDING_SYNC` state view | Live hospital acceptance status (server-authoritative) | LOW | LOW | Show local queued status offline; reconcile with server via Socket.IO on reconnect | IMPLEMENTED | GREEN |
| **Doctor AI (Text Chat)** | Live AI Client + RAG | Offline fallback notice + local emergency red-flag safety rules | Live LLM generation & RAG retrieval | LOW | LOW | Provide deterministic offline guidance & red-flag detection; show offline AI notice | IMPLEMENTED | GREEN |
| **Doctor AI (Document / Image OCR)** | Live OCR processing (registered users) | Denied | N/A (requires server AI processing) | HIGH if cached | HIGH if stored | `MUTATION_NETWORK_ONLY` — strictly deny offline OCR/document upload | IMPLEMENTED | GREEN |
| **Hospital Directory** | Live hospital listing API | Cached public hospital data with `cachedAt`/`expiresAt` | Real-time bed/ICU availability | LOW | LOW | Public hospital info stale-while-revalidate; display "Last updated" timestamp | IMPLEMENTED | GREEN |
| **Contact Support** | Live support request POST | Queued in IndexedDB (`contact_queue`) | Server ticket confirmation | LOW | LOW | Queue support draft offline with `PENDING_SYNC`; flush on reconnect | IMPLEMENTED | GREEN |
| **Help Center & FAQs** | Static & API help content | Versioned IndexedDB store (`help_content`) | Stale content warning if version mismatch | LOW | NONE | Cache approved FAQ items; display cached help offline | IMPLEMENTED | GREEN |
| **Minimal Emergency Profile** | Full DB patient profile | Session-bound local storage (`emergency_profile`) | Full medical history & document attachments | LOW | MEDIUM (PHI) | Store minimal fields (blood group, critical allergies/contacts) with session expiry | IMPLEMENTED | GREEN |
| **HealthPack Full Export** | Live AES-encrypted HealthPack | `SENSITIVE_NETWORK_ONLY` (Denied offline) | Full document bundle offline | HIGH if unencrypted | CRITICAL | Network-only by default; clear cached data on logout | IMPLEMENTED | GREEN |
| **Medical Document View/Upload** | File upload & PDF viewing | `SENSITIVE_NETWORK_ONLY` (Denied offline) | Local document viewer | HIGH | CRITICAL | Do NOT cache medical files in Service Worker or public IndexedDB | IMPLEMENTED | GREEN |
| **Guest Mode SOS & AI** | Short-lived guest session, limited SOS & text chat | Allowed offline SOS queue & safety guidance | Guest document upload & HealthPack (Denied) | LOW | LOW | Guest permissions preserved offline; short-lived session cleanup | IMPLEMENTED | GREEN |
| **User Authentication / OTP** | OTP request, verification, login, registration | Offline status check via `useConnectivity` | Offline password reset / OTP verification (Denied) | CRITICAL if offline | CRITICAL | Server verification mandatory for all security actions | IMPLEMENTED | GREEN |
| **Hospital / Doctor / Admin Portals** | Full capacity, staff, user management | `NETWORK_ONLY` (Denied offline) | Live administrative actions | HIGH | HIGH | Require server authentication & RBAC; deny offline operational edits | IMPLEMENTED | GREEN |

---

## Key Audit Conclusions

1. **Server Database Authority:** PostgreSQL/PostGIS is the sole authoritative database. No local state overwrites server roles, permissions, or emergency statuses.
2. **Service Worker Cache Policy:** Shell assets are precached (cache-first), public hospital directory is stale-while-revalidate, and all sensitive medical documents/tokens are strictly `NETWORK_ONLY`.
3. **Data Protection:** Zero plain-text passwords, OTPs, JWT tokens, or medical document files are persisted in IndexedDB or localStorage.
