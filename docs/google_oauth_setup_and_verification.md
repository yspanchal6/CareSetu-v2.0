# CareSetu — Google Authentication via Firebase Auth Integration Guide

## Executive Summary

- **Feature:** Secure "Continue with Google" Authentication on Login and Register pages using **Firebase Authentication**.
- **Frontend Architecture:** Firebase Client SDK (`firebase/auth`) with `signInWithPopup(auth, googleProvider)`.
- **Backend Architecture:** Firebase Admin SDK (`firebase-admin/auth`) server-side ID token verification (`getAdminAuth().verifyIdToken(idToken)`).
- **Security Protections:**
  1. Signature, issuer (`https://securetoken.google.com/<projectId>`), audience (Firebase Project ID), expiry, and email verification claims are validated server-side by Firebase Admin SDK.
  2. Untrusted frontend claims or role escalation requests to `ADMIN` are strictly **sanitized to default roles** (`PATIENT`).
  3. Accounts with `BLOCKED` status are **rejected with HTTP 403 Forbidden**.
  4. Phone verification requirements are preserved for accounts mandating phone verification (e.g. Patient SOS dispatch).
  5. Zero client secrets, private keys, ID tokens, or access tokens are exposed in server logs or frontend bundles.

---

## 🛠️ Firebase Console & Google Auth Setup Instructions

### 1. Enable Google Sign-In Provider in Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/).
2. Select project `caresetu-37de6`.
3. Go to **Build** -> **Authentication** -> **Sign-in method**.
4. Click **Google** provider and toggle to **Enable**.
5. Set project support email and click **Save**.

### 2. Configure Authorized Domains in Firebase Authentication

- In Firebase Console -> Authentication -> Settings -> **Authorized domains**:
  - `localhost` (Local development)
  - `caresetu-37de6.firebaseapp.com`
  - `caresetu.in` (Production domain)
  - `app.caresetu.in`

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

Firebase Admin SDK configuration:
```env
FIREBASE_PROJECT_ID=caresetu-37de6
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@caresetu-37de6.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
*(Alternatively, place `firebase-service-account.json` in `backend/src/config/`).*

Google OAuth Client fallback credentials (optional):
```env
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
<!-- GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET -->
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

Vite Firebase configuration:
```env
VITE_FIREBASE_API_KEY=YOUR_VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=caresetu-37de6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=caresetu-37de6
VITE_FIREBASE_STORAGE_BUCKET=caresetu-37de6.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_VITE_FIREBASE_APP_ID
```

---

## 🔒 Security & Data Flow Architecture

```
User Clicks "Continue with Google"
              |
              v
Frontend Firebase Client SDK (signInWithPopup with GoogleAuthProvider)
              |
              v (Generates signed Firebase ID Token)
              |
POST /api/auth/google { credential: idToken, role: "PATIENT" }
              |
              v
Backend Firebase Admin SDK (getAdminAuth().verifyIdToken)
  ├── 1. Signature & Expiry Check (Firebase Public Key)
  ├── 2. Issuer Check (https://securetoken.google.com/caresetu-37de6)
  ├── 3. Audience Check (caresetu-37de6)
  └── 4. Email Verified Check (email_verified: true)
              |
              v
Database Account Resolution (Prisma + PostgreSQL)
  ├── Existing User? -> Verify status (Block check) -> Return JWT Token & User
  └── New User? -> Hash random password -> Create Patient Profile -> Return JWT Token
```

---

## 🧪 Automated Security Test Results (`backend/tests/google.oauth.security.test.js`)

- **Command:** `node backend/tests/google.oauth.security.test.js`
- **Result:** **`21 / 21 PASSED (100% SUCCESS RATE)`**

| Test Case | Result | Summary |
| :--- | :-: | :--- |
| Missing Token Rejection | **PASS (GREEN)** | Rejects empty token with HTTP 400 |
| Expired Token Rejection | **PASS (GREEN)** | Rejects expired token with HTTP 401 |
| Wrong Audience Rejection | **PASS (GREEN)** | Rejects token if audience mismatch |
| Wrong Issuer Rejection | **PASS (GREEN)** | Rejects token if issuer is untrusted |
| Role Escalation Rejection | **PASS (GREEN)** | Rejects untrusted `ADMIN` role request; sanitizes to `PATIENT` |
| Account Linking | **PASS (GREEN)** | Links verified Google email to existing user account without duplicate |
| Blocked Account Rejection | **PASS (GREEN)** | Rejects login for `BLOCKED` user accounts with HTTP 403 |
| Fresh User Registration | **PASS (GREEN)** | Creates new user record with `isVerified: true` |

---

## 📌 Limitations & Production Guidance

- **Authorized Domains:** Ensure your domain (`localhost`, `caresetu.in`) is added under Firebase Console Authentication Authorized Domains for popup sign-in.
- **Phone Verification Policy:** Firebase Google authentication verifies the user's email address. If a user role mandates phone verification for emergency contact dispatch, CareSetu preserves the phone verification state until the user inputs and verifies their phone number via SMS OTP.
