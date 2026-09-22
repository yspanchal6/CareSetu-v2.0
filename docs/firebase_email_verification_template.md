# CareSetu — Firebase Email Verification Template Guide

## Executive Summary

- **Feature:** Official **Firebase Email Address Verification** using the template configured in Firebase Console.
- **Firebase Location:** `Authentication -> Templates -> Email address verification`.
- **Purpose:** Dispatches official Firebase verification emails when users register using Firebase Email/Password Auth, while keeping Brevo Email OTP and TextBee Phone OTP completely separate.

---

## 📧 Firebase Console Template Configuration

### Template Settings
- **Subject:** `Verify your email for %APP_NAME%`
- **Sender Name:** `CareSetu`
- **Sender Address:** `noreply@caresetu-37de6.firebaseapp.com`
- **Action URL:** `https://caresetu-37de6.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=%LINK%`

---

## 🛠️ Verification Workflow & State Machine

### 1. Verification Triggering
When a user signs up using Firebase Email/Password:
```ts
import { sendFirebaseVerificationEmail } from '../utils/firebase';

const result = await sendFirebaseVerificationEmail(user);
```
Firebase Client SDK issues the email directly via Firebase's backend infrastructure using the configured template.

### 2. Verification State Machine (Frontend)
- `idle`: Form submission ready.
- `pending`: Verification email sent to inbox; awaiting link click.
- `verifying`: Reloading Firebase user profile or parsing `oobCode` action link.
- `verified`: `user.emailVerified === true`. Dispatches backend sync.
- `cooldown`: 30-60 second resend timer active.
- `error`: Expired link, invalid action code, or network error.

### 3. Backend Synchronization
Once Firebase confirms `user.emailVerified === true`, the frontend notifies the backend to update Prisma `user.isVerified = true`.

---

## 🔒 Separation of Verification Services

| Service | Channel | Purpose | Template Source |
|---|---|---|---|
| **Firebase Email Verification** | Email (Link) | Firebase Auth Email Verification | Firebase Console (`Authentication -> Templates`) |
| **Brevo Custom Email OTP** | Email (6-digit Code) | 2FA, Forgot Password, Direct OTP | Brevo SMTP API (`api.brevo.com`) |
| **TextBee Phone OTP** | SMS (6-digit Code) | Indian Phone Number Verification | TextBee Gateway API (`api.textbee.dev`) |
| **Google Sign-In** | OAuth 2.0 / OIDC | Direct Social Login | Google Identity Services |
