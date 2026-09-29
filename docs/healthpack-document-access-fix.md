# CARESETU — MULTI-PLATFORM PROTECTED HEALTH DOCUMENT SECURITY ARCHITECTURE

## 1. Executive Security Architecture Overview
CareSetu enforces a zero-trust, multi-layered Protected Health Document Architecture across Web/PWA, Android Native, and iOS Native platforms. 

```
                               CARE SETU BACKEND
                                       │
                               Authentication
                                       │
                                Hospital RBAC
                                       │
                            Emergency Case Acceptance
                                       │
                           HealthPack 24h Share/Consent
                                       │
                              Document Ownership
                                       │
                           24h Expiry & Revocation
                                       │
                             Protected View API
                                       │
               ┌───────────────────────┴───────────────────────┐
               │                                               │
           WEB / PWA                                      MOBILE NATIVE
               │                                               │
      Browser Privacy Overlay                        Native Secure Content
    (Visibility / Focus Loss)                      (SecureContentService Bridge)
               │                                       ┌───────┴───────┐
               │                                       │               │
        React Component                             Android           iOS
      Dynamic Watermark                           FLAG_SECURE     Capture State
  No-Download / No-Print                           Screen Guard    Redaction UI
               │                                       │               │
               └───────────────────────┬───────────────┴───────────────┘
                                       │
                             Secure Medical Document
                                   VIEW ONLY
```

## 2. Server-Authoritative 24-Hour Idempotent Timer
- **Access Start**: Access window starts deterministically when the hospital **ACCEPTS** an emergency case (`accessGrantedAt = serverNow`, `expiresAt = accessGrantedAt + 24 hours`).
- **Idempotency**: Repeated ACCEPT calls or page refreshes preserve the existing `expiresAt` rather than resetting or extending the 24-hour window.
- **Expiry Enforcement**: Server checks `serverNow < expiresAt` on every document request (`GET /api/patient/documents/:documentId/view`). Requests made after 24 hours return `HTTP 403 Forbidden` (`HEALTHPACK_ACCESS_EXPIRED`).

## 3. Multi-Platform Security Bridge (`SecureContentService`)
Located at `frontend/src/services/secure-content.service.ts`:
- **Web / PWA**: Monitors `document.visibilityState` and `window.blur` / `window.focus`. Displays `SecureViewerPrivacyOverlay` to hide protected document content whenever tab focus or window visibility is lost.
- **Android Native**: Triggers native `WindowManager.LayoutParams.FLAG_SECURE` via Capacitor / Cordova plugins to exclude protected document screens from screenshots, screen recording, and recents app-switcher previews.
- **iOS / iPadOS Native**: Interfaces with native iOS `UIScreen.main.isCaptured` and `sceneCaptureState` to redact medical document UI during active screen recording or AirPlay screen mirroring.

## 4. Anti-Caching & Delivery Headers
```http
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
X-Content-Type-Options: nosniff
Content-Disposition: inline; filename="protected_document.pdf"
```
Protected medical documents are **NETWORK ONLY** and are NEVER cached in `localStorage`, `sessionStorage`, `IndexedDB`, or PWA Service Worker caches.

## 5. Security Watermark & View-Only Controls
- Dynamic semi-transparent watermark: `CONFIDENTIAL — CARESETU • SECURE HEALTHPACK VIEW ONLY`, `Case Ref: <caseId>`, `Expires: <timestamp>`.
- UI provides **Close Viewer** ONLY — no Download, Print, or Save buttons exist.
- CSS print suppression (`@media print`) and disabled context menu / text selection.

## 6. Honest Multi-Platform Security Disclosure Statement
> "CareSetu uses platform-specific protected-content mechanisms where supported. Android native protected windows use `FLAG_SECURE` to block OS screenshots, screen recording, and recents previews. iOS/iPadOS applications monitor system capture state (`UIScreen.main.isCaptured`) and redact protected healthcare content. The web/PWA version uses layered browser privacy protections, in-memory Blob streams, and dynamic watermarks but cannot guarantee OS-level screenshot prevention."

## 7. Verification & Test Suite Results
- `healthpack-case-access-security.test.js`: **11 PASSED, 0 FAILED** (Authorized view 200, Unauthorized IDOR 403, 25h expired case 403, Revoked share 403, Audit log verified).
- `healthpack.data.flow.test.js`: **60 PASSED, 0 FAILED**
- `auth.security.test.js`: **20 PASSED, 0 FAILED**
- `hospital-matching.test.js`: **25 PASSED, 0 FAILED**
- `audit-db-integrity.js`: **PASSED**
- `npm run build` (Frontend): **PASSED (0 errors in 9.18s)**
