# CareSetu — Master Offline Synchronization Strategy

## Overview

The CareSetu **Sync Engine** (`syncEngine.ts`) bridges local IndexedDB operations with PostgreSQL server endpoints when network connectivity changes from OFFLINE to ONLINE.

---

## State Transition Machine

```
   [ User Action Offline ]
              |
              v
       PENDING_SYNC ─── (Connectivity Restored) ───> SYNCING
            ^                                           |
            |                                           v
       RETRY_WAIT <─── (Transient 5xx / Network) ───────+
            |                                           |
            | (Max Retries Exceeded / 4xx Error)        | (200 OK / 409 Conflict)
            v                                           v
         FAILED                                      SYNCED
                                                        |
                                                        v
                                             (Delete Local Queue Item)
```

---

## Sync Guarantees & Safeguards

### 1. Concurrency Guard
- `isSyncingInProgress` flag prevents concurrent sync passes from multiple tabs, fast reloads, or background workers.

### 2. Idempotency & Replay Prevention
- Every offline operation is assigned a cryptographically strong UUID (`operationId`).
- Passed to the backend API via the `idempotencyKey` field.
- If the server has already processed the request, it returns a 409 Conflict or existing record, which the sync engine treats as `SYNCED`.

### 3. Backoff & Rate Limiting
- Bounded retries up to 5 attempts per record.
- Exponential backoff algorithm with randomized jitter: `delay = min(60000, 2000 * 2^attempt) + randomJitter()`.
- HTTP 429 Rate Limit triggers `RETRY_WAIT` state without incrementing terminal failure count.

### 4. Status Truthfulness
- The client UI displays "SOS saved locally. Waiting for server connection." while in `PENDING_SYNC` or `SYNCING`.
- Never displays "SOS delivered" or "Hospital accepted" until confirmed by a 200/201 response from PostgreSQL server.
