# CareSetu — Firebase Authentication & Google Login Implementation Guide

## Executive Summary

- **Feature:** Production-grade authentication using **Firebase Authentication** for Google Sign-In and Firebase Email Verification.
- **Frontend Architecture:** Firebase Client SDK (`firebase/auth`) with `signInWithPopup(auth, googleProvider)` and `sendEmailVerification(user)`.
- **Backend Architecture:** Firebase Admin SDK (`firebase-admin/auth`) server-side ID token verification (`getAdminAuth().verifyIdToken(idToken)`).
- **Security Controls:**
  1. Signature, issuer (`https://securetoken.google.com/caresetu-37de6`), audience, expiration, and `email_verified` claims validated server-side.
  2. Untrusted frontend claims or role escalation attempts to `ADMIN` are strictly **sanitized to default roles** (`PATIENT`).
  3. Accounts with `BLOCKED` status are **rejected with HTTP 403 Forbidden**.
  4. Phone verification requirements are preserved for accounts mandating phone verification (e.g. Patient SOS dispatch).
  5. Zero client secrets, private keys, ID tokens, or access tokens exposed in server logs or frontend bundles.

---

## 🛠️ Firebase Console & Google Auth Setup Instructions

### 1. Enable Sign-In Providers in Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/) -> Select project `caresetu-37de6`.
2. Go to **Build** -> **Authentication** -> **Sign-in method**.
3. Enable **Google** provider and configure project support email.
4. Enable **Email/Password** provider.

### 2. Configure Authorized Domains in Firebase Authentication
- Go to Firebase Console -> Authentication -> Settings -> **Authorized domains**:
  - `localhost` (Development)
  - `caresetu-37de6.firebaseapp.com`
  - `caresetu.in` (Production domain)
  - `app.caresetu.in`

---

## ⚙️ Environment Variables

### Frontend (`frontend/.env`)
```env
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=caresetu-37de6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=caresetu-37de6
VITE_FIREBASE_STORAGE_BUCKET=caresetu-37de6.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=872960501616
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

### Backend (`backend/.env`)
```env
FIREBASE_PROJECT_ID="caresetu-37de6"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@caresetu-37de6.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 🔒 Google Authentication & Account Linking Flow

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
