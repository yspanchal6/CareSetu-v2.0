# CareSetu — Admin Hospital Registry & Verification Documentation

## Overview
The **Admin Hospital Registry & Verification Module** allows CareSetu Administrators to register, monitor, verify, and manage hospital facilities across the platform. It provides end-to-end verification workflows, security status monitoring, multi-attribute searching and filtering, and full auditability while maintaining seamless integration with the Hospital Directory, Security Reviews, and Hospital Matching modules.

---

## 1. Key Capabilities & Features

1. **Page Header & Metric Summaries:**
   - **Header:** Title, real-time relative update timestamp, and explicit **Refresh** action.
   - **4 Compact Stat Cards:** Total Hospitals, Pending Verification (amber), Approved Facilities (green), and Blocked Facilities (rose).

2. **Add Hospital Registration Module:**
   - Multi-column registration form supporting:
     - Facility Name, Official Email, Contact Number
     - Hospital Type (`Government`, `Private`, `Trust / NGO`, `Other`)
     - Ownership (`Government`, `Private`)
     - Registration / License ID
     - Location: State, District, City, Address, Latitude & Longitude
     - Bed Capacity: Total Beds, ICU Beds (enforces `ICU <= Total Beds` validation)
     - Emergency Availability (`Available`, `Limited`, `Unavailable`)
   - Strict frontend & backend validation prevents invalid bed counts, malformed emails, missing required fields, or duplicate Registration IDs.

3. **Search & Multi-Attribute Filtering:**
   - **Search:** Instant text search across facility name, registration ID, official email, state, and city.
   - **Filters:**
     - **Verification Status:** `ALL`, `Pending`, `Approved`, `Rejected`, `Blocked`
     - **Hospital Type:** `ALL`, `Government`, `Private`, `Trust / NGO`, `Other`
     - **Ownership:** `ALL`, `Government`, `Private`
     - **Security Status:** `ALL`, `Active`, `Under Review`, `Temporarily Blocked`

4. **Hospital Registry Data Table:**
   - Displays facility name, registration ID/email, location (City, State), type, ownership, total & ICU bed counts, verification badge, security status badge, registration date, and contextual action buttons.
   - Server-aligned client-side pagination (8 records per page) with previous/next controls.

5. **Verification Workflow (Approve / Reject):**
   - **Approve Action:** Instantly updates hospital status to verified (`isVerified: true`), sets portal access to active, and logs an auditable event `HOSPITAL_APPROVED`.
   - **Reject Action:** Opens a dedicated rejection modal requiring an explicit feedback reason. Disallows silent rejections and logs `HOSPITAL_REJECTED` with feedback.

6. **Security System Integration:**
   - Reads the authoritative `HospitalSecurityStatus` (`ACTIVE`, `UNDER_REVIEW`, `TEMPORARILY_BLOCKED`, `REJECTED`).
   - If a hospital is `TEMPORARILY_BLOCKED` (due to protected HealthPack content violations), a **"Security Review"** action button and modal alert appear, linking directly to `/admin/security-reviews`.
   - Preserves Security Reviews as the single source of truth for capture-violation appeals and unlock decisions.

7. **Verification Documents:**
   - Displays encrypted uploaded verification documents (Document Title, Type, Upload Status) within the hospital details modal without exposing raw tokens or public URLs.

---

## 2. API Endpoints Reference

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/hospitals/verification-requests` | `ADMIN` | Fetches all hospital facilities with metadata, document statuses, and security status. |
| `POST` | `/api/admin/hospitals/register` | `ADMIN` | Registers a new hospital facility and submits it for verification. |
| `POST` | `/api/admin/hospitals/:id/approve` | `ADMIN` | Approves a hospital application and activates portal access. |
| `POST` | `/api/admin/hospitals/:id/reject` | `ADMIN` | Rejects a hospital application with required feedback reason. |
| `GET` | `/api/admin/audit-logs` | `ADMIN` | Retrieves administrative audit logs for registry operations. |

---

## 3. Audit Logging Matrix

All registry events generate structured audit records in the database (`AuditLog` table):

| Event Action | Trigger | Logged Details |
| :--- | :--- | :--- |
| `HOSPITAL_REGISTERED` / `HOSPITAL_SUBMITTED` | Admin registers facility | `adminUserId`, `hospitalId`, `facilityName`, `email`, `registrationId`, timestamp |
| `HOSPITAL_APPROVED` | Admin approves hospital | `adminUserId`, `hospitalId`, `targetUserId`, `verificationStatus: APPROVED`, timestamp |
| `HOSPITAL_REJECTED` | Admin rejects hospital | `adminUserId`, `hospitalId`, `targetUserId`, `reason`, `verificationStatus: REJECTED`, timestamp |

---

## 4. Testing & Verification Summary

| Test Category | Expected Result | Result |
| :--- | :--- | :---: |
| **Page Header & Summary Cards** | Render correct counts for Total, Pending, Approved, and Blocked hospitals. | **GREEN** |
| **Hospital Registration Form** | Enforces valid email, required fields, `ICU <= Total Beds`, duplicate reg ID checks. | **GREEN** |
| **Search & Filters** | Instant filtering across status, type, ownership, security state, and search text. | **GREEN** |
| **Approve Workflow** | Approves hospital, updates status badge to "Approved", logs audit record. | **GREEN** |
| **Reject Workflow** | Requires non-empty reason, updates status to "Rejected", logs audit record with feedback. | **GREEN** |
| **Security Review Integration** | Displays "Temporarily Blocked" badge and direct link to `/admin/security-reviews` for blocked facilities. | **GREEN** |
| **Frontend Build & Typecheck** | `npm run build` (`tsc -b && vite build`) completed with **0 errors**. | **GREEN** |
