# CareSetu Phase 12B.11 — Staging Deployment and Live Verification Audit Report

**Date & Time**: 2026-10-18T21:45:00+05:30  
**Phase**: Phase 12B.11 — Staging Deployment & Live Verification  
**Repository Working Tree**: `D:\2_YASH\SIH\CareSetu\CareSetu-demo\` (All files strictly preserved, 0 clean/stash/reset)  
**Deployment Decision Status**: **NOT DEPLOYED (BLOCKED ON MANUAL CLOUD INFRASTRUCTURE PROVISIONING)**

---

## 1. Executive Summary

In accordance with Phase 12B.11 deployment safety constraints:
1. **Full Verification of Prerequisites Passed**: All legal pages (`/terms`, `/privacy`, `/data-declaration`), browser refreshes, responsive footer links (desktop and mobile), explicit registration consent enforcement, database audit trail recording, and production builds (`tsc -b && vite build`) were independently verified through automated Playwright and integration suites.
2. **Infrastructure Assessment**: The target remote staging providers (Railway for backend, Cloudflare Pages for frontend, Supabase for managed PostgreSQL/PostGIS, and Cloudflare R2 for backups) are not yet provisioned with active service endpoints or CI/CD deployments.
3. **Safety Constraint Compliance**: No remote migrations were executed against unconfirmed databases, no production secrets were committed or exposed, and no speculative deployments were claimed.

---

## 2. Independent Verification of Legal & Consent Behavior

| Test Item | Verification Tool / Script | Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Terms of Use Direct & Refresh** | Playwright Chromium (`legal-pages-browser-smoke.spec.ts`) | Navigated to `/terms`, verified header, badge, and version `2026.1`. Browser reloaded and verified page state preserved. | **PASSED** |
| **Privacy Policy Direct & Refresh** | Playwright Chromium (`legal-pages-browser-smoke.spec.ts`) | Navigated to `/privacy`, verified SPHI disclosures, DPDP notice. Browser reloaded and verified state preserved. | **PASSED** |
| **Data Declaration Direct & Refresh** | Playwright Chromium (`legal-pages-browser-smoke.spec.ts`) | Navigated to `/data-declaration`, verified taxonomy matrix, encryption architecture, retention schedules. Browser reloaded. | **PASSED** |
| **Public Footer Responsive Links** | Playwright Chromium (`legal-pages-browser-smoke.spec.ts`) | Verified footer links visible and accessible across Desktop (1280x800) and Mobile (375x667). | **PASSED** |
| **Registration Consent Enforcement** | Integration Script (`test-consent-verification.js`) | `termsAccepted: false` or omitted rejected with HTTP 400 (`"You must accept the Terms of Use, Privacy Policy, and Data Declaration to register."`). | **PASSED** |
| **Registration Acceptance & Audit Trail** | Integration Script (`test-consent-verification.js`) | `termsAccepted: true` succeeded (HTTP 201). Query on `AuditLog` confirmed record with `action: 'CONSENT_GRANTED'` and `details: { type: 'TERMS_AND_PRIVACY', documents: ['TERMS_OF_USE', 'PRIVACY_POLICY', 'DATA_DECLARATION'], policyVersion: '2026.1', scope: 'ACCOUNT_REGISTRATION_AND_BASIC_SERVICE' }`. | **PASSED** |
| **Existing Accounts & Sessions** | Integration Script (`test-consent-verification.js`) | Verified existing test account (`test.hospital@caresetu.local`) logged in with HTTP 200 without being blocked. | **PASSED** |
| **Frontend Production Build** | `cmd.exe /c "npm run build"` | Transformed 2,640 modules in 21.10s, generating production bundle in `dist/`. Zero TypeScript errors. | **PASSED** |

---

## 3. Legal and Data-Declaration Claims Audit

- **Consent Recording Reality**: The backend records a consolidated `CONSENT_GRANTED` audit event capturing the user's acceptance of the document bundle: Terms of Use, Privacy Policy, and Data Declaration (version `2026.1`). It is documented as a combined service registration consent and is **not** misrepresented as separate per-document micro-consents. Purpose-specific consents (HealthPack access and Emergency SOS location capture) remain independently controlled via runtime permissions.
- **Provider Accuracy**: Disclosed third-party relay providers (TextBee for SMS, Brevo for Email, FCM for Push Notifications, Cloudflare R2 for encrypted storage) exactly match the active service implementations in `backend/src/services/providers/`.
- **Unresolved Legal Items Flagged**:
  1. *Entity Corporate Identity*: Legal entity name and Corporate Identification Number (CIN) remain in draft form pending corporate incorporation.
  2. *Statutory Grievance Officer*: Designated email (`grievance@caresetu.local` / `privacy@caresetu.in`) requires formal appointment of the named individual officer under DPDP Act rules.
  3. *Arbitration Jurisdiction*: Governing venue requires confirmation by designated legal counsel.

---

## 4. Staging Provisioning Audit & Blockers

| Provider | Target Role | Provisioning Status | Blocker / Next Action Required |
| :--- | :--- | :--- | :--- |
| **Cloudflare Pages** | Frontend Web App (`staging.caresetu.pages.dev`) | **NOT PROVISIONED** | Cloudflare Pages project must be created via Cloudflare Dashboard or Wrangler CLI; connect repository or deploy `frontend/dist/`. |
| **Railway** | Backend API Gateway (`api-staging.caresetu.up.railway.app`) | **NOT PROVISIONED** | Railway service needs to be linked to the Git repository or initialized via Railway CLI; staging environment variables must be configured. |
| **Supabase** | Managed PostgreSQL 15+ & PostGIS | **NOT PROVISIONED** | Dedicated staging project must be created in Supabase; PostGIS extension enabled; run `npx prisma migrate deploy` using staging `DIRECT_URL`. |
| **Cloudflare R2** | Encrypted Snapshot Backups | **NOT PROVISIONED** | R2 bucket `caresetu-staging-backups` needs to be created with restricted API credentials. |

---

## 5. Deployment Readiness Checklist for Operator Approval

To transition from **NOT DEPLOYED** to **DEPLOYED AND VERIFIED**, the following manual operator actions are required:

1. **Supabase Project Creation**:
   - Create staging project in AWS Mumbai (`ap-south-1`) or India region.
   - Run `CREATE EXTENSION IF NOT EXISTS postgis;` in the Supabase SQL Editor.
   - Provide `DATABASE_URL` (pooler port 6543) and `DIRECT_URL` (direct port 5432).
2. **Execute Database Migrations**:
   - Run `npx prisma migrate deploy` against the staging `DIRECT_URL`.
   - Run synthetic seeders (`seed.js` or regional test fixture seeder) for staging verification accounts.
3. **Configure Railway Service**:
   - Set environment variables: `NODE_ENV=production`, `PORT=3000`, `FRONTEND_URL=https://staging.caresetu.pages.dev`, `DATABASE_URL`, `JWT_SECRET`, `HEALTH_PACK_KEY` (32 bytes), `URL_ENCRYPTION_SECRET`.
   - Enable WebSocket sticky sessions.
4. **Deploy Cloudflare Pages**:
   - Set build command: `npm run build`, build output directory: `dist`.
   - Set environment variable: `VITE_API_URL=https://[RAILWAY_STAGING_URL]/api`.
   - Ensure `_redirects` file (`/* /index.html 200`) is copied to `dist/` for SPA refresh support.

---

## 6. Final Status

**Final Status**: **NOT DEPLOYED** (Code and pre-flight verifications 100% complete and passed; awaiting external cloud infrastructure provisioning and operator credentials).
