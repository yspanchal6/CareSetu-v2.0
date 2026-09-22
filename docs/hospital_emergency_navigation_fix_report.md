# CARESETU — HOSPITAL NAVIGATION FIX & AUDIT REPORT

**Date:** September 18, 2026  
**Project:** CareSetu — Hospital Emergency Portal  
**Target:** Hospital Navigation, Active State Highlighting, and Route Rendering  

---

## 1. Executive Summary & Root Cause Analysis

### Problem Description
On the hospital portal, clicking "Emergency Cases" or "Active Cases" caused inconsistent active highlighting in the sidebar and mismatched header title rendering. When navigating to `/hospital/emergencies/active`, both "Emergency Cases" and "Active Cases" were simultaneously highlighted in the sidebar, while the top title bar displayed "Emergency Cases".

### Root Cause Analysis
1. **Flawed `NavLink` Heuristic ([`frontend/src/components/layout/Sidebar.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/components/layout/Sidebar.tsx)):**
   The sidebar component calculated `end={item.to.split("/").length <= 2}` for `<NavLink>`. Because all app routes have at least 3 path segments (e.g. `""`, `"hospital"`, `"emergencies"`), `end` evaluated to `false` for every route. As a result, React Router used prefix matching for `/hospital/emergencies`, marking both `/hospital/emergencies` and `/hospital/emergencies/active` as active when visiting `/hospital/emergencies/active`.

2. **Unsorted Title Matching ([`frontend/src/layouts/DashboardLayout.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/layouts/DashboardLayout.tsx)):**
   `titleFromPath` iterated through navigation items in declaration order. Since `/hospital/emergencies` was defined before `/hospital/emergencies/active`, `pathname.startsWith("/hospital/emergencies/")` matched `/hospital/emergencies` first, rendering `"Emergency Cases"` as the topbar title even when on the Active Cases page.

3. **Active Cases Status Inclusion ([`frontend/src/pages/hospital/HospitalEmergencyPages.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/hospital/HospitalEmergencyPages.tsx)):**
   `ACTIVE_STATUSES` originally contained only `["TRANSFER", "TREATMENT"]`, excluding newly accepted cases (`"ACCEPTED"` and `"IN_PROGRESS"`).

---

## 2. Technical Modifications

### A. Sidebar Active Matching Logic ([`Sidebar.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/components/layout/Sidebar.tsx))
- Introduced `isItemActive(pathname, itemTo, allItems)` function:
  - Exact match (`pathname === itemTo`) returns `true`.
  - If another item in `allItems` has an exact match for `pathname`, returns `false` (preventing parent prefix multi-highlighting).
  - Prefix matching (`pathname.startsWith(itemTo + "/")`) is preserved for sub-routes (e.g., detail view `/hospital/emergencies/case-123`), provided no more specific item matches.

### B. Header Title Determination ([`DashboardLayout.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/layouts/DashboardLayout.tsx))
- Updated `titleFromPath` to sort navigation items by path length descending before evaluation:
  - `/hospital/emergencies/active` (length 27) evaluates before `/hospital/emergencies` (length 21).
  - Guarantees the topbar displays `"Active Cases"` when on the Active Cases route.

### C. Active Cases Status List ([`HospitalEmergencyPages.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/hospital/HospitalEmergencyPages.tsx))
- Expanded `ACTIVE_STATUSES` to `["ACCEPTED", "TRANSFER", "TREATMENT", "IN_PROGRESS"]` and updated `statusTone` mappings.

---

## 3. Verification & Test Results

| Test Scenario | Navigation Route | Expected Sidebar Highlighting | Expected Topbar Title | Rendered Component | Result |
|---------------|------------------|-------------------------------|-----------------------|--------------------|--------|
| Click "Emergency Cases" | `/hospital/emergencies` | Emergency Cases ONLY | Emergency Cases | `HospitalEmergenciesPage` | ✅ PASS |
| Click "Active Cases" | `/hospital/emergencies/active` | Active Cases ONLY | Active Cases | `HospitalActiveCasesPage` | ✅ PASS |
| Direct URL Open | `/hospital/emergencies/active` | Active Cases ONLY | Active Cases | `HospitalActiveCasesPage` | ✅ PASS |
| Page Refresh | `/hospital/emergencies/active` | Active Cases ONLY | Active Cases | `HospitalActiveCasesPage` | ✅ PASS |
| Emergency Case Detail View | `/hospital/emergencies/:id` | Emergency Cases ONLY | Emergency Cases | `HospitalEmergencyDetailPage` | ✅ PASS |
| Back/Forward Browser History | Updates dynamically | Matches route | Matches route | Correct Page | ✅ PASS |

---

## 4. Build Validation
- **TypeScript Compilation (`tsc -b`):** Executed with 0 errors.
- **Vite Production Bundle (`npm run build`):** Built successfully in 15.92s with exit code `0`.
