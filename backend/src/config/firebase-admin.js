const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

let isInitialized = false;

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    isInitialized = true;
    return;
  }

  try {
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY,
        }),
      });
      isInitialized = true;
      console.log('[FIREBASE_ADMIN] Initialized via environment credentials.');
    } else {
      const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        initializeApp({
          credential: cert(serviceAccountPath),
        });
        isInitialized = true;
        console.log('[FIREBASE_ADMIN] Initialized via firebase-service-account.json file.');
      } else {
        console.warn('[FIREBASE_ADMIN] Missing Firebase Admin credentials in environment. Fallback token verification enabled.');
      }
    }
  } catch (error) {
    console.error(`[FIREBASE_ADMIN] Failed to initialize Firebase Admin: ${error.message}`);
  }
}

initFirebaseAdmin();

module.exports = {
  isInitialized: () => isInitialized,
  getAdminAuth: () => (isInitialized ? getAuth() : null),
};
