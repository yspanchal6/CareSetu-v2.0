import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getAuth, GoogleAuthProvider, sendEmailVerification, reload, applyActionCode, User as FirebaseUser } from 'firebase/auth';
import { getAuthToken } from '../services/api';

// Use standard env variables for React (Vite uses import.meta.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "caresetu-37de6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "caresetu-37de6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "caresetu-37de6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "872960501616",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-4S0MVRPK06"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Triggers official Firebase Email Address Verification email using configured Firebase Console Template.
 */
export const sendFirebaseVerificationEmail = async (user: FirebaseUser): Promise<{ success: boolean; message: string }> => {
  try {
    const actionCodeSettings = {
      url: `${window.location.origin}/login?emailVerified=true`,
      handleCodeInApp: true,
    };
    await sendEmailVerification(user, actionCodeSettings);
    return {
      success: true,
      message: 'Verification email dispatched via Firebase template. Please check your inbox.',
    };
  } catch (error: any) {
    console.error('[Firebase Auth] sendEmailVerification error:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to send verification email via Firebase.',
    };
  }
};

/**
 * Reloads Firebase User data to check fresh emailVerified claim state.
 */
export const checkFirebaseEmailVerified = async (user: FirebaseUser): Promise<boolean> => {
  try {
    await reload(user);
    return user.emailVerified;
  } catch (err) {
    console.warn('[Firebase Auth] Could not reload user verification state:', err);
    return user.emailVerified;
  }
};

/**
 * Applies oobCode from Firebase verification link.
 */
export const verifyFirebaseActionCode = async (oobCode: string): Promise<boolean> => {
  try {
    await applyActionCode(auth, oobCode);
    return true;
  } catch (err) {
    console.error('[Firebase Auth] applyActionCode error:', err);
    return false;
  }
};



let messaging: ReturnType<typeof getMessaging> | null = null;

try {
  // Messaging only works in supported browsers
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase Messaging not supported:', err);
}

export const requestNotificationPermission = async (): Promise<string | null> => {
  if (!messaging || typeof window === 'undefined' || !('Notification' in window)) return null;

  // Do NOT request permission automatically if not already granted to prevent browser violation
  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
    });
    return currentToken || null;
  } catch (error) {
    console.warn('[FCM] Could not retrieve FCM token:', error);
    return null;
  }
};

export const requestNotificationPermissionWithUserGesture = async (): Promise<string | null> => {
  if (!messaging || typeof window === 'undefined' || !('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const currentToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });
      return currentToken || null;
    }
    return null;
  } catch (error) {
    console.error('[FCM] Error requesting notification permission:', error);
    return null;
  }
};



export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    if (!messaging) return resolve(null); // Or reject(new Error("FCM unsupported"))
    onMessage(messaging, (payload) => resolve(payload));
  });

// New function to send token to backend safely
export const sendTokenToBackend = async (token: string) => {
  const tokenString = getAuthToken();

  if (!tokenString) {
    console.error("No authenticated session found. Cannot save FCM token.");
    return false;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/fcm/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenString}`,
      },
      body: JSON.stringify({ token, platform: 'WEB' }),
    });

    if (!response.ok) {
      console.error("Failed to send FCM token to backend.");
      return false;
    }

    console.log("FCM token sent to backend successfully.");
    return true;
  } catch (error) {
    console.error("Error sending FCM token to backend:", error);
    return false;
  }
};
