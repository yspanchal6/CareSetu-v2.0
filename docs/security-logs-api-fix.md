# CareSetu — Admin Security Event Logs API Fix Report

**Date:** 2026-09-29  
**Target Endpoint:** `GET /api/security/admin/violations`  
**Status:** GREEN (Fully Verified)

---

## 1. Executive Summary & Status Dashboard

| Component / Requirement | Status | Details |
| :--- | :---: | :--- |
| **Backend API Route (`GET /api/security/admin/violations`)** | GREEN | Resolves HTTP 200 OK with stable response contract |
| **Prisma Query & Enum Validation** | GREEN | Fixed invalid `AuditAction` enum strings in `findMany` query |
| **Pagination (`page`, `pageSize`)** | GREEN | Supported with boundary checks (`page >= 1`, `1 <= pageSize <= 100`) |
| **Real Database Analytics** | GREEN | Accurate real counts derived from database (`totalEvents: 72`, etc.) |
| **Filter Support** | GREEN | Multi-field search, event type, attempt number, date range, epoch |
| **Safe Nullable Handling** | GREEN | Missing optional relations (`hospital`, `user`, `case`) return safe fallbacks |
| **Read-Only Guarantee** | GREEN | Read-only execution with zero mutation to security state or counters |
| **Admin Authorization Enforcement** | GREEN | `ADMIN` role required (HTTP 403 for non-admin, 401 for unauthenticated) |
| **Frontend Integration (`AdminSecurityViolationsPage.tsx`)** | GREEN | Log analysis section & security reviews load real database events |
| **Production Build** | GREEN | Frontend Vite build completed cleanly in 11.77s |

---

## 2. Root Cause Analysis

### Exact 500 Internal Server Error Trace
```text
PrismaClientValidationError: Invalid `prisma.auditLog.findMany()` invocation in
D:\2_YASH\SIH\CareSetu\CareSetu-demo\backend\src\services\hospital-security.service.js:807:43

  807 const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: {
            in: [
              "SECURITY_EMAIL_DISPATCH",
              "CAPTURE_VIOLATION",
              "HOSPITAL_UNLOCKED",
              "HOSPITAL_APPEAL_SUBMITTED",
              "SECURITY_REVIEW_SUBMITTED"
            ]
          }
        },
        take: 500,
        orderBy: { createdAt: "desc" }
      })

Invalid value for argument `in`. Expected AuditAction.
```

### Technical Root Cause
1. **File:** `backend/src/services/hospital-security.service.js` (line 807)
2. **Incorrect Query/Logic:** The service method `getAdminViolationsAndAppeals` attempted to query `prisma.auditLog.findMany` using `in: ['SECURITY_EMAIL_DISPATCH', ... 'SECURITY_REVIEW_SUBMITTED']`.
3. **Prisma Schema Conflict:** `'SECURITY_EMAIL_DISPATCH'` and `'SECURITY_REVIEW_SUBMITTED'` were arbitrary string literals that do NOT exist in the PostgreSQL `enum AuditAction` in `schema.prisma`.
4. **Result:** Prisma threw a runtime validation error (`PrismaClientValidationError`), causing `GET /api/security/admin/violations` to fail with HTTP 500.

---

## 3. Resolution & Code Changes

### Backend Service Upgrade (`hospital-security.service.js`)
- **Enum Sanitization:** Updated `auditLog.findMany` to filter strictly by valid `AuditAction` enum members (`['CAPTURE_VIOLATION', 'CAPTURE_WARNING_ISSUED', 'HOSPITAL_TEMPORARILY_BLOCKED', 'HOSPITAL_APPEAL_SUBMITTED', 'HOSPITAL_BLOCK_REVIEWED', 'HOSPITAL_UNLOCKED', 'HOSPITAL_SESSION_REVOKED', 'SECURITY_EVENT', 'ADMIN_ACTION']`).
- **Pagination:** Implemented `skip` and `take` logic supporting `page` (default 1) and `pageSize` (default 25, capped at 100).
- **Filters & Search:** Added multi-field `OR` condition for `search` across hospital name, hospital ID, user name, user email, case ID, and capture event ID.
- **Date Range Handling:** Validated and parsed `dateFrom` and `dateTo` into ISO `Date` boundaries.
- **Real Analytics:** Aggregated true database counts using `count()` and `groupBy()`:
  - `totalEvents`: Total `CaptureViolation` count
  - `confirmedEvents`: Count with `status === 'RECORDED'`
  - `warnings`: Count with `attemptNumber` 1 or 2
  - `blockedEvents`: Count with `attemptNumber >= 3`
  - `uniqueHospitals`: Distinct hospital count
  - `uniqueUsers`: Distinct hospital user count
- **Safe Nullable Handling:** Formatted violation objects with fallback strings (`'Hospital Portal'`, `'N/A'`, `'Hospital User'`) so missing relations do not crash the endpoint.

### Controller Safeguards (`hospital-security.controller.js`)
- Validates `dateFrom` and `dateTo` parameters (returns HTTP 400 Bad Request if invalid or `dateFrom > dateTo`).
- Catches unhandled errors and logs `[SECURITY_LOGS_API_ERROR]` with request metadata while withholding sensitive tokens from response bodies.

### Frontend Integration (`secure-content.service.ts`)
- Updated `SecureContentService.getAdminViolations(params)` to serialize query objects into clean `URLSearchParams`.

---

## 4. Empirical Verification & Evidence

### A. Database Execution Test Result
Running automated test suite against the local development PostgreSQL database:
```json
{
  "success": true,
  "dataCount": 25,
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 72,
    "totalPages": 3
  },
  "analytics": {
    "totalEvents": 72,
    "confirmedEvents": 72,
    "warnings": 58,
    "blockedEvents": 14,
    "failedEvents": 0,
    "uniqueHospitals": 8,
    "uniqueUsers": 8
  }
}
```

### B. Filter & Pagination Verification
- **Default Query:** `page=1`, `pageSize=25` $\rightarrow$ Returns 25 records out of 72 total.
- **Pagination Test (`page=2`, `pageSize=5`):** Returns 5 records starting from offset 5.
- **EventType Filter (`SCREENSHOT_ATTEMPT`):** Successfully filters 25 events.
- **Attempt Filter (`attemptNumber=3`):** Successfully isolates all 14 level-3 blocking attempts.
- **Sorting Test (`sortBy=oldest`):** Returns records ordered chronologically ascending (`firstDate: 2026-09-27T18:59:03.603Z`).
- **Date Range Filter:** Correctly filters events within specified timestamps.

### C. Authorization Tests
- **ADMIN User:** HTTP 200 OK with full analytics and violation list.
- **Non-Admin User (PATIENT / HOSPITAL):** HTTP 403 Forbidden.
- **Unauthenticated User:** HTTP 401 Unauthorized.

### D. Production Build Verification
- Command: `npm run build` (Frontend)
- Result: **0 TypeScript / Rollup errors**
- Build duration: **11.77s**
- Assets generated cleanly in `dist/`.

---

## 5. Final Acceptance Checklist

- [x] `GET /api/security/admin/violations` returns 200 OK
- [x] No 500 Internal Server Errors in DevTools console
- [x] Existing Security Reviews page & appeals workflow remain intact
- [x] Real security events (72 persisted events) are displayed
- [x] Real analytics (72 total, 58 warnings, 14 blocked) are displayed
- [x] Multi-field search works
- [x] Hospital filter works
- [x] User filter works
- [x] Event filter works
- [x] Attempt filter works
- [x] Date filter works
- [x] Security epoch filter works
- [x] Pagination works
- [x] Sorting works
- [x] Detail drawer opens
- [x] Admin-only authorization works (403 for non-admin)
- [x] Empty database returns 200 with empty data array
- [x] Missing optional relations do not crash API
- [x] Endpoint is 100% read-only with no security state side effects
- [x] Production build passes cleanly
