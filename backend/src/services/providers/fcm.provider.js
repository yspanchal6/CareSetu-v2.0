const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const prisma = require('../../config/prisma');

class FCMProvider {
  constructor() {
    this.isInitialized = false;

    try {
      if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      ) {
        // Prevent duplicate initialization
        if (getApps().length === 0) {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              // Key contains real newlines, no need to replace
              privateKey: process.env.FIREBASE_PRIVATE_KEY,
            })
          });
        }
        this.isInitialized = true;
        console.log('[FCM_PROVIDER] Firebase Admin initialized successfully.');
      } else {
        console.warn('[FCM_PROVIDER] Missing Firebase Admin credentials in environment. Push notifications will be MOCKED.');
      }
    } catch (error) {
      console.error(`[FCM_PROVIDER] Failed to initialize Firebase Admin: ${error.message}`);
    }
  }

  async sendPush({ token, title, body, data = {} }) {
    if (!this.isInitialized) {
      console.log(`\n================ MOCK FCM PUSH ================`);
      console.log(`TOKEN: [REDACTED]`);
      console.log(`TITLE: ${title}`);
      console.log(`BODY: ${body}`);
      console.log(`================================================\n`);
      return { success: true, provider: 'fcm', mock: true };
    }

    try {
      const stringifiedData = {};
      for (const [key, value] of Object.entries(data)) {
        stringifiedData[key] = String(value);
      }

      const message = {
        token,
        notification: { title, body },
        data: stringifiedData
      };

      const response = await getMessaging().send(message);
      return { success: true, provider: 'fcm', messageId: response };
    } catch (error) {
      console.error(`[FCM_PROVIDER] Push send error: ${error.message}`);

      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        console.log(`[FCM_PROVIDER] Deactivating invalid token.`);
        await this.deactivateToken(token);
      }

      return { success: false, provider: 'fcm', error: error.message };
    }
  }

  async deactivateToken(token) {
    try {
      await prisma.fcmToken.updateMany({
        where: { token },
        data: { isActive: false }
      });
    } catch (e) {
      console.error(`[FCM_PROVIDER] Failed to deactivate token: ${e.message}`);
    }
  }
}

module.exports = new FCMProvider();