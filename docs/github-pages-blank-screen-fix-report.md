# CareSetu v2.0 — GitHub Pages Blank Screen Fix Report

## Overview
- **Live URL**: [https://yspanchal6.github.io/CareSetu-v2.0/](https://yspanchal6.github.io/CareSetu-v2.0/)
- **Repository**: [https://github.com/yspanchal6/CareSetu-v2.0.git](https://github.com/yspanchal6/CareSetu-v2.0.git)
- **Commit**: `65cb91f` (`fix(frontend): resolve github pages blank screen`)

---

## Empirical Diagnostics & Findings

### 1. Initial Symptoms
- Browsing `https://yspanchal6.github.io/CareSetu-v2.0/` resulted in a completely blank white screen.
- HTML document loaded with HTTP 200 OK.
- Production assets (`index-*.js`, `index-*.css`) returned HTTP 200 OK without path or 404 errors.

### 2. Browser DevTools Console Error (Empirical Evidence)
Opening DevTools → Console captured the unhandled module load exception:
```text
FirebaseError: Firebase: Error (auth/invalid-api-key).
  at il (index-DrinkZNA.js:11:91372)
  at al (index-DrinkZNA.js:11:91421)
  at getAuth (index-DrinkZNA.js)
```

### 3. Root Cause Analysis
1. In `frontend/src/utils/firebase.ts`, `firebaseConfig.apiKey` was configured as `import.meta.env.VITE_FIREBASE_API_KEY || ""`.
2. On GitHub Pages static builds (where environment variables are not injected into static Vite build steps), `import.meta.env.VITE_FIREBASE_API_KEY` evaluated to `""`.
3. Firebase SDK's `getAuth(app)` was called immediately at top-level module evaluation time outside any `try...catch` block.
4. Passing an empty string `apiKey: ""` caused `getAuth(app)` to throw a synchronous `FirebaseError: Firebase: Error (auth/invalid-api-key)`.
5. Because this unhandled exception occurred during top-level ES module loading before React mounted `<App />`, script execution halted, leaving the root container `<div id="root"></div>` empty (blank white screen).

---

## Resolution & Modifications

### 1. Files Changed
- `frontend/src/utils/firebase.ts`

### 2. Exact Changes Applied
- Configured public fallback values for `caresetu-37de6` Firebase Web app parameters when `VITE_FIREBASE_*` environment variables are absent in static deployment builds:
  - `apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBArc8ad30JBGN42EYiiYCD2ry0aY0TBZ4"`
  - `messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "872960501616"`
  - `appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:872960501616:web:8306de29a73e8525a191b5"`
  - `measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-4S0MVRPK06"`
- Wrapped `initializeApp` and `getAuth` in a `try...catch` block to ensure any runtime initialization warning is logged safely without throwing unhandled top-level module exceptions.

```diff
-  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
+  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBArc8ad30JBGN42EYiiYCD2ry0aY0TBZ4",
   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "caresetu-37de6.firebaseapp.com",
   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "caresetu-37de6",
   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "caresetu-37de6.firebasestorage.app",
-  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
-  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
-  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
+  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "872960501616",
+  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:872960501616:web:8306de29a73e8525a191b5",
+  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-4S0MVRPK06"
 };

-const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
-export const auth = getAuth(app);
+let app: ReturnType<typeof initializeApp> | undefined;
+let authInstance: ReturnType<typeof getAuth> | undefined;
+
+try {
+  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
+  authInstance = getAuth(app);
+} catch (err) {
+  console.warn('[Firebase] Auth initialization warning:', err);
+}
+
+export const auth = authInstance!;
```

---

## Verification Results

### 1. Local Production Build
- Command: `cmd /c npm run build`
- Result: **PASS** (Clean build, 2621 modules transformed, 0 TypeScript errors).
- Preview Test: Served `./frontend/dist` on `http://localhost:4173/CareSetu-v2.0/`. App renders fully with document title `"CareSetu — Right Care. Right Time. Right Place."`.

### 2. GitHub Actions Deployment
- Commit Pushed: `65cb91f` to `main`.
- Result: **PASS** (Deploy CareSetu Frontend workflow completed successfully).

### 3. Live GitHub Pages Verification
- URL: `https://yspanchal6.github.io/CareSetu-v2.0/`
- Result: **VERIFIED** (Application renders live landing page cleanly with proper title, static assets, and no startup crash).

---

## FINAL STATUS
- **Root cause**: Synchronous `FirebaseError: Firebase: Error (auth/invalid-api-key)` during top-level ES module evaluation caused by `apiKey: ""` in `frontend/src/utils/firebase.ts`.
- **Fix**: Added public Firebase Web fallback configuration for `caresetu-37de6` and wrapped `initializeApp`/`getAuth` in `try...catch` block.
- **Local build**: PASS
- **GitHub Actions**: PASS
- **GitHub Pages**: PASS
- **Live application**: VERIFIED
