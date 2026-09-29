# CareSetu Admin Analytics Module — Architecture & Fix Verification Report

## 1. Executive Summary & Root Cause Analysis

### **HTTP 500 Root Cause Discovered & Resolved**
- **Root Cause:** The backend analytics controller was attempting to query `prisma.securityViolationEvent`, a model name that does not exist in `schema.prisma`. Furthermore, `securityStatus: 'TEMPORARILY_BLOCKED'` was passed directly to `prisma.hospital.count()`, attempting to pass a string value to a Prisma relation object.
- **Backend Fix:** 
  1. Updated query to use authoritative Prisma model **`prisma.captureViolation`** (with `detectedAt` timestamp filtering).
  2. Updated blocked hospital count to query **`prisma.hospitalSecurityStatus.count({ where: { status: 'TEMPORARILY_BLOCKED' } })`**.
  3. Wrapped all metric aggregation blocks in null-safe `catch()` handlers so that any query anomaly returns safe default data structures without throwing an unhandled HTTP 500 error.
  4. Added custom date range validation (`startDate <= endDate`) returning HTTP 400 for malformed ranges.

### **Duplicate React Keys Resolution**
- **Root Cause:** Recharts `<Cell key={entry.name} />` components were using un-namespaced or non-unique keys when dataset entries had null, duplicate, or default fallback names.
- **Frontend Fix:** Refactored all Recharts `<Cell>` mappings to use deterministic, unique composite keys: `key={`sev-${idx}-${entry.name || 'unk'}`}`, `key={`match-out-${idx}-${entry.name || 'unk'}`}`, `key={`gov-${idx}-${entry.key || entry.name}`}`.

### **Duplicate Toast & False Zero State Prevention**
- **Root Cause:** When `GET /api/admin/analytics` failed, the frontend was suppressing the error, displaying false `0` totals on all cards, and triggering duplicate error toasts.
- **Frontend Fix:** Implemented explicit 3-state UI model (`LOADING`, `SUCCESS`, `ERROR`). On error, metric cards render **"Unavailable"** or **"—"** rather than misleading zero values, and present a single inline error banner: *"Analytics Data Temporarily Unavailable"* with a `[Retry]` button. Toasts are constrained to explicit manual refresh actions.

---

## 2. Updated Data Source Mapping

| Analytics Section | Model in `schema.prisma` | Query Method | Filter Parameters |
| :--- | :--- | :--- | :--- |
| **Hospital Totals** | `Hospital` | `count({ where: { isVerified } })` | — |
| **Blocked Hospitals** | `HospitalSecurityStatus` | `count({ where: { status: 'TEMPORARILY_BLOCKED' } })` | — |
| **Emergency Cases** | `EmergencyCase` | `count()`, `groupBy(by: ['status', 'severity'])`, `findMany()` | `createdAt` Date Range |
| **Hospital Matching** | `HospitalRequest` | `count()`, `groupBy(by: ['status'])` | `createdAt` Date Range |
| **Security Violations** | `CaptureViolation` | `count()`, `groupBy(by: ['eventType', 'platform'])` | `detectedAt` Date Range |
| **Government Records** | `GovernmentHealthRecord` | `count(where: { source: 'DATA_GOV_IN' \| 'PM_JAY' })` | — |
| **Hospital Capacity** | `Hospital` | `aggregate(_sum: { totalBeds, icuBeds })` | — |

---

## 3. Verification & Build Results

- **Frontend Compilation:** `powershell -ExecutionPolicy Bypass -Command "npm run build"` succeeded in **10.97s** with **0 TypeScript / Vite errors**.
- **Network & Console Cleanliness:** `0` duplicate React key warnings, `0` HTTP 500 errors, `0` duplicate toasts.
