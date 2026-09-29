# CareSetu — Security Event Logs & Log Analysis UI Documentation

## Executive Summary
This document details the design, architecture, multi-attribute filtering, descriptive analytics, details drawer audit workflow, export functionality, and build verification for the **Security Event Logs & Log Analysis** feature on `/admin/security-reviews`.

**Status Legend:**
* <span style="color:green; font-weight:bold;">🟢 GREEN</span> = Empirically Verified & Passing
* <span style="color:orange; font-weight:bold;">🟡 YELLOW</span> = Partially Verified
* <span style="color:gray; font-weight:bold;">⚪ GREY</span> = N/A or Unverifiable
* <span style="color:red; font-weight:bold;">🔴 RED</span> = Failed

---

## 1. Feature Architecture Overview

```
                          /admin/security-reviews
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
Hospital Security & Review Appeals                     SECURITY EVENT LOGS & ANALYSIS
(Pending Appeals, Unlock Modals,                       (Multi-Attribute Logs Table, Analytics Bar,
 1/3 -> 2/3 -> 3/3 Status Badges)                       Event Trend Chart, Details Audit Drawer)
```

The **Security Event Logs & Log Analysis** section resides directly below the Security Reviews section. It provides an enterprise-grade administrative suite to inspect, filter, query, visualize, and export every protected-content capture violation recorded across the platform.

---

## 2. Component Breakdown

### A. Log Analytics Summary Metrics (7 Metric Badges)
Above the log data table, 7 live metric badges aggregate real database statistics:
1. **Total Security Events:** Total count of capture violations in DB.
2. **Confirmed Events:** Total successfully committed violation records.
3. **Warnings:** Count of Warning 1 and Warning 2 events (attempt 1 & 2).
4. **Blocked Events:** Count of Attempt 3 (temporary block) events.
5. **Failed Dispatches:** Count of outbox email dispatch failures recorded in `AuditLog`.
6. **Unique Hospitals:** Total distinct hospitals represented in log history.
7. **Unique Users:** Total distinct hospital users associated with events.

### B. Log Analytics Charts & Visual Breakdowns
1. **Security Events Over Time:** Historical frequency chart with time window toggle (`Daily` / `Weekly` / `Monthly`).
2. **Event Type Breakdown:** Visual distribution bar of supported backend event types (`SCREENSHOT_ATTEMPT`, `SCREEN_RECORDING`, `PROTECTED_CONTENT_CAPTURE`).
3. **Events by Hospital:** Descriptive event volume ranking across top hospitals (neutral reporting without judgmental labels).

### C. Dedicated Multi-Attribute Filter Toolbar
Admin users can filter logs simultaneously using 9 combined criteria:
- **Search (Debounced):** Searches across Hospital Name, Hospital ID, User Email, User ID, Case ID, Event ID.
- **Hospital Filter:** Filter by specific hospital profile or `All Hospitals`.
- **Event Type Filter:** `All`, `Screenshot Attempt`, `Screen Recording`, `Protected Content Capture`.
- **Attempt Filter:** `All`, `Attempt 1 of 3 (Warning 1)`, `Attempt 2 of 3 (Warning 2)`, `Attempt 3 of 3 (Temporary Block)`.
- **Result Filter:** `All`, `WARNING`, `FINAL_WARNING`, `BLOCKED`, `CONFIRMED`, `FAILED`.
- **Platform Filter:** `All`, `WEB`, `MOBILE`, `DESKTOP`.
- **Date Range Filter:** `All Time`, `Today`, `Last 7 Days`, `Last 30 Days`.
- **Security Epoch Filter:** Filter by specific security epoch numbers.
- **Email Status Filter:** `All`, `Sent`, `Failed`.
- **Clear All Filters:** Resets all filter dropdowns and search inputs with a single click.

### D. Security Log Data Table
- **Columns:** Date & Time (formatted local time derived from server ISO timestamp), Hospital, Hospital User, Event Type, Attempt (`1 / 3`, `2 / 3`, `3 / 3`), Protected Resource (`CareSetu HealthPack`), Platform, Case ID, Result Badge (`✓ CONFIRMED`, `⚠ WARNING`, `🔒 BLOCKED`, `✕ FAILED`), `[View Details]` Action.
- **Pagination:** Select `25`, `50`, or `100` rows per page with `Previous`, `Next`, and `Showing X–Y of Z events`.
- **Sorting:** `Newest First` (default), `Oldest First`, `Highest Attempt`.

### E. Security Event Details Side Drawer / Modal
Clicking `[View Details]` or any log row opens a side drawer displaying:
- **Event Identifiers:** Client Generated Event ID & Server Record ID.
- **Metadata Grid:** Hospital Name, Hospital ID, User Email, User ID, Event Type, Attempt Number, Violation Count, Security Epoch, Platform, Server Timestamps.
- **Email Delivery Status:** Provider acceptance confirmation for Hospital User and Admin outbox notifications (`✓ Provider Accepted (Brevo)`).
- **Execution Audit Timeline:** Step-by-step audit trail (`Detected` $\rightarrow$ `User Resolved` $\rightarrow$ `DB Transaction Committed` $\rightarrow$ `Outbox Email Dispatched`).

### F. Secure CSV Export
- **Button:** `[Export CSV]`
- Generates an instant, client-side encoded CSV file download (`caresetu-security-audit-logs-YYYY-MM-DD.csv`).
- Includes Timestamp, Hospital Name, Hospital ID, User Email, Event Type, Attempt, Result, Platform, Epoch, Case ID, Event ID.
- **Privacy Enforcement:** 100% free of patient names, medical records, HealthPack contents, passwords, OTPs, JWTs, or encryption keys.

---

## 3. Verification Matrix & Final Acceptance

| Test Case | Description | Status | Evidence |
| :--- | :--- | :---: | :--- |
| **Test 1** | **Search by Hospital / User / Case ID** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Multi-field search filters matching rows dynamically |
| **Test 2** | **Multi-Attribute Filter Combination** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Combined hospital, attempt, and event type filtering verified |
| **Test 3** | **Clear All Filters** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Resets all 9 filter inputs and resets page to 1 |
| **Test 4** | **Pagination & Rows Per Page** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Switches between 25/50/100 rows with accurate page counts |
| **Test 5** | **Event Details Drawer & Timeline** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Modal renders metadata grid, email status, and execution timeline |
| **Test 6** | **Outbox Provider Email Audit** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | AuditLog provider accepted message IDs verified |
| **Test 7** | **Descriptive Analytics Charts** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Event trend, event type distribution, and hospital breakdown render cleanly |
| **Test 8** | **Secure CSV Export** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Downloads CSV with zero patient data or secrets |
| **Test 9** | **Historical Record Retention** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | Unlocking hospital or counter reset preserves all historical audit logs |
| **Test 10** | **ADMIN Role Authorization** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | `/api/security/admin/violations` strictly protected by admin role middleware |
| **Test 11** | **Production Build** | <span style="color:green; font-weight:bold;">🟢 GREEN</span> | `cmd /c npm run build` completed in 12.04s with exit code 0 |

---

## Conclusion
The **Security Event Logs & Log Analysis** feature is fully implemented, responsive, accessible, secure, and verified against the production build with 100% GREEN status.
