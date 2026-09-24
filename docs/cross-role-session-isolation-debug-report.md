# Cross-Role Session Isolation Debug Report

## Root cause

Patient and hospital sessions shared `localStorage["jwt"]`. `saveAuthToken()` wrote every login token there, and the API client preferred that value over the tab-scoped token. A hospital login therefore replaced the patient JWT for every tab in the browser. A stale Patient React view could then send SOS with a Hospital token.

The backend was correctly rejecting that request: the JWT decoded as `HOSPITAL`, so `POST /api/emergency/sos` failed the existing `authorize('PATIENT', 'GUEST')` guard with `403`. The security failure was session selection in the frontend, not an RBAC bypass.

## Session fix

Authentication is now deliberately tab-scoped:

- `sessionStorage["caresetu_auth_token"]` is the only frontend auth-token source.
- `localStorage["jwt"]` is removed during token save and logout, including stale values left by older builds.
- API fetches, route guards, sockets, document downloads, Firebase registration, and verification flows all use `getAuthToken()`.
- Separate browser tabs can hold independent Patient and Hospital sessions. Within one tab, a role transition replaces that tab's session and the UI must follow the new authenticated role.
- Logout clears only the current tab's auth state; it no longer removes a shared token used by another tab.

The default Socket.IO origin now follows the current browser hostname when the API URL is relative, so LAN clients do not attempt to connect to their own `localhost`.

## Files modified

- `frontend/src/services/api.ts`: tab-scoped token accessor, SOS diagnostic metadata, stale shared-token cleanup, LAN-aware socket origin.
- `frontend/src/context/AuthContext.tsx`: session initialization and validation use the scoped token.
- `frontend/src/routes/ProtectedRoute.tsx`: guard uses the scoped token.
- `frontend/src/context/SocketContext.tsx`: socket handshake uses the same scoped token.
- `frontend/src/pages/hospital/HospitalEmergencyPages.tsx`: document download uses the shared API/token helpers.
- `frontend/src/pages/auth/DocumentVerificationPage.tsx`: verification session refresh uses the scoped token.
- `frontend/src/pages/hospital/HospitalProfileVerificationPage.tsx`: verification session refresh uses the scoped token.
- `frontend/src/pages/patient/PatientProfileCompletionPage.tsx`: profile session refresh uses the scoped token.
- `frontend/src/utils/firebase.ts`: FCM registration uses the scoped token.
- `backend/src/middleware/auth.middleware.js`: non-guest role is rechecked from the active database user; inactive/missing users are rejected.
- `backend/src/utils/socket.js`: socket role is resolved from the active database user instead of trusting only the JWT role claim.
- `frontend/src/context/README.md`: corrected storage documentation.

## Safe diagnostics

For SOS requests, the frontend logs only:

```text
{ userId, role, requestPath, hasAuthorizationHeader, apiBaseUrl }
```

The backend logs the same request identity fields. JWTs, passwords, OTPs, and medical data are never logged.

## Backend behavior

- Valid, active PATIENT session: allowed to reach SOS controller.
- Valid, active HOSPITAL session: `403` from patient-only authorization.
- Missing, invalid, or expired token: `401` from authentication middleware.
- A token with a mismatched role claim: the active database role is authoritative for non-guest users.
- Socket.IO uses the same active-user and role checks as HTTP API authorization.

## Verification results

- Frontend diagnostics: no TypeScript errors reported for the changed API, auth context, route guard, socket context, Firebase, or backend files.
- Auth storage scan: no remaining frontend reads of `localStorage` JWT/token keys; remaining local storage usage is limited to offline profile/sync UI data and stale-token cleanup.
- Backend syntax checks for `auth.middleware.js` and `socket.js`: passed with no output/errors using the available Node executable.
- The earlier API route test in this workspace confirmed the backend's status convention for authenticated routes: missing auth `401`, wrong role `403`, invalid payload `400`. The new SOS middleware diagnostics follow that same path.
- The frontend production build reached Vite compilation and reported only existing chunk-size/dynamic-import warnings, but the shared terminal did not return a reliable final status for the later rerun.

## Tests not claimed GREEN

The exact two-tab browser reproduction was not completed in this environment, so current URL, browser storage contents, and a live browser Network-panel Authorization header were not captured. The terminal session became unable to execute subsequent `node`/`npm` commands reliably after the build process. Consequently, the following remain required evidence checks:

1. Patient login and successful SOS.
2. Hospital login and rejected Patient SOS (`403`).
3. Patient and Hospital sessions in two tabs, confirming each tab sends its own redacted `{ userId, role }` metadata.
4. Patient refresh, logout/login transition, expired token, missing token, invalid token, and Socket.IO role consistency.

This report intentionally does not claim the full cross-role test matrix is GREEN without those browser and live-request results.