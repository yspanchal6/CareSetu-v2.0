# CareSetu — Offline Security & Privacy Governance

## Security Architecture & Data Classification

CareSetu enforces a strict **Zero Local Sensitive Storage** policy to protect patient records, credentials, and authorization integrity across offline states.

---

## Data Storage Policies

| Data Type | Allowed Storage | Offline Policy | Security Protection |
| :--- | :--- | :--- | :--- |
| **Passwords / Hashes** | None | Network-Only | Never stored in SW, Cache API, or IndexedDB |
| **OTPs & Verification Codes** | Memory Only | Network-Only | Single-use transient memory |
| **JWT Access / Refresh Tokens**| Secure Cookies / Memory | Memory-Only | Auto-purged on expiry or logout |
| **Encryption Keys** | Backend / Vault | Server-Side Only | Never sent to or stored on client device |
| **Uploaded Medical Documents**| None | Network-Only | Explicitly blocked in Service Worker (`SENSITIVE_NETWORK_ONLY`) |
| **HealthPack Full History** | None | Network-Only | Blocked in Service Worker and IndexedDB |
| **Minimal Emergency Profile** | IndexedDB (`emergency_profile`)| Local Cache (User Opt-in)| Session-bound, expires in 7 days, cleared on logout |
| **Emergency SOS Queue** | IndexedDB (`sos_queue`) | Local Queue | Idempotency Key bound, auto-purged on server sync |
| **Public Hospital Directory**| IndexedDB / SW Cache | Local Cache | Public data only; no private patient/hospital data |
| **Help & FAQ Content** | IndexedDB / SW Cache | Local Cache | Static public content |

---

## Guest Mode Restrictions

Guest users operating in offline mode are subjected to strict access controls:

1. **ALLOWED:**
   - One-tap emergency SOS capture (`PENDING_SYNC` state with offline GPS)
   - Doctor AI symptom text chat with local emergency red-flag warnings
   - Public Hospital directory browsing (cached public contacts)
   - Offline Help & FAQ viewing

2. **STRICTLY DENIED:**
   - Document upload / OCR / PDF inspection
   - Access to HealthPack or patient medical histories
   - Doctor, Hospital, or Admin portal access
   - Account privilege escalation or settings modification

---

## Logout Security Protocol

When a user triggers `logout()`, `clearSensitiveLocalData()` in `offlineDB.ts` executes cleanly:
1. Clears `emergency_profile` store.
2. Clears `offline_drafts` store.
3. Clears `sos_queue` store.
4. Clears `contact_queue` store.
5. Invalidates Service Worker sensitive memory caches.
