const prisma = require('../config/prisma');
const textbeeProvider = require('./providers/textbee.provider');
const brevoProvider = require('./providers/brevo.provider');
const fcmProvider = require('./providers/fcm.provider');
const { getIo } = require('../utils/socket');

class NotificationService {
  /**
   * Dispatch a notification across available channels
   */
  async sendNotification({ userId, type, title, message, phone, email, payload = {} }) {
    try {
      // 1. Persist to Database (In-App)
      let notification = null;
      if (userId) {
        notification = await prisma.notification.create({
          data: {
            userId,
            type,
            title: title || 'Notification',
            message,
            status: 'UNREAD',
            data: payload
          }
        });

        // 2. Dispatch Real-time Event via Socket.IO
        try {
          const io = getIo();
          io.to(userId).emit('notification', {
            id: notification.id,
            type,
            title,
            message,
            payload,
            createdAt: new Date(),
          });
        } catch (err) {
          console.warn('[NOTIFICATION_SERVICE] Socket.IO instance error. Real-time push skipped.', err.message);
        }

        // 3. Dispatch Push Notification via FCM
        try {
          // Find active tokens
          const tokens = await prisma.fcmToken.findMany({
            where: { userId, isActive: true }
          });
          
          for (const t of tokens) {
            await fcmProvider.sendPush({
              token: t.token,
              title: title || 'CareSetu',
              body: message,
              data: payload
            });
          }
        } catch (err) {
          console.warn('[NOTIFICATION_SERVICE] FCM error. Push skipped.', err.message);
        }
      }

      // 4. Dispatch SMS if phone provided
      if (phone) {
        await textbeeProvider.sendSMS(phone, message);
      }

      // 5. Dispatch Email if email provided
      if (email) {
        await brevoProvider.sendEmail({
          to: email,
          subject: title || 'CareSetu Notification',
          text: message,
          html: `<p>${message}</p>`
        });
      }

      return notification;
    } catch (error) {
      console.error(`[NOTIFICATION_SERVICE] Failed to send notification to ${userId}: ${error.message}`);
      // Non-blocking
      return null;
    }
  }

  /**
   * Wrapper for Hospital specific notifications
   */
  async notifyHospital(hospitalUserId, message, payload, phone, email) {
    return this.sendNotification({
      userId: hospitalUserId,
      type: 'HOSPITAL_REQUEST',
      title: 'Emergency Assigned',
      message,
      phone,
      email,
      payload
    });
  }

  /**
   * Wrapper for Patient specific notifications
   */
  async notifyPatient(patientUserId, message, type, payload, phone, email) {
    return this.sendNotification({
      userId: patientUserId,
      type,
      title: 'Emergency Status Update',
      message,
      phone,
      email,
      payload
    });
  }
}

module.exports = new NotificationService();
