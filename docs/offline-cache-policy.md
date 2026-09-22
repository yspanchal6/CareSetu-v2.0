# CareSetu — Master Service Worker Cache Policy

## Overview

CareSetu Service Worker (`public/sw.js`) enforces explicit cache classification to ensure fast offline PWA app shell rendering while protecting sensitive medical endpoints.

---

## Route Classification Matrix

```
                     HTTP REQUEST
                          |
             +------------+------------+
             |                         |
      GET / API Route             Static Asset
             |                         |
    Classification Check          Cache-First
             |                   (caresetu-shell-v3)
  +----------+----------+
  |                     |
Public / FAQ       Sensitive / Auth
  |                     |
Stale-While-Revalidate Network-Only
(caresetu-data-v1)   (Bypass Cache)
```

---

## Detailed Rules

### 1. Application Shell (`STATIC_CACHE`)
- **Cache Name:** `caresetu-shell-v3`
- **Strategy:** Cache-First, fallback to network.
- **Assets:** `/`, `/index.html`, `/offline.html`, `/manifest.json`, `/favicon.svg`, bundled JS/CSS.

### 2. Public Data (`PUBLIC_DATA_CACHE`)
- **Cache Name:** `caresetu-data-v1`
- **Strategy:** Stale-While-Revalidate.
- **Routes:** `/api/hospitals/nearby`, `/api/help`.
- **Offline Behavior:** Serves last cached JSON with staleness headers.

### 3. Sensitive & Auth Data (`NETWORK_ONLY`)
- **Strategy:** Network-Only (Bypass Cache entirely).
- **Forbidden from SW Cache:**
  - `/api/auth/*` (Login, Register, OTP, Password Reset)
  - `/api/healthpack/*` (Medical History, Prescriptions)
  - `/api/documents/*` (PDF / Image Medical Records)
  - `/api/doctor-ai/upload` (Document OCR)
  - `/api/admin/*`, `/api/hospital/profile`, `/api/doctor/profile`

---

## Invalidation Triggers

1. **Service Worker Version Change:** Automatically deletes stale `caresetu-shell-v2` or earlier caches during SW `activate` phase.
2. **User Logout:** Client calls `clearSensitiveLocalData()` to purge user-specific IndexedDB tables.
3. **Session Expiry:** HTTP 401/403 responses clear transient memory state.
