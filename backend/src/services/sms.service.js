const textbeeProvider = require('./providers/textbee.provider');
const prisma = require('../config/prisma');

class SmsService {
  async sendSms(to, message, context = {}) {
    const result = await textbeeProvider.sendSMS(to, message);
    
    if (!result.success && result.error === 'MISSING_API_KEY') {
      return this._sendMockSms(to, message, context);
    }

    if (!result.success) {
      console.warn(`[SMS_SERVICE] Real SMS Provider Failed, falling back to MOCK: ${result.error}`);
      return this._sendMockSms(to, message, context);
    }

    return result;
  }

  sendSMS(to, message, context = {}) {
    return this.sendSms(to, message, context);
  }

  async _sendMockSms(to, message, context) {
    console.log('\n================ MOCK SMS ================');
    console.log(`TO: ${to}`);
    console.log(`MESSAGE: ${message}`);
    console.log('==========================================\n');

    // Attempt to log via AuditLog if possible
    try {
      await prisma.auditLog.create({
        data: {
          action: 'SECURITY_EVENT',
          entity: 'SMS',
          details: {
            mode: 'MOCK',
            to,
            messagePreview: message.substring(0, 50),
            context
          },
        }
      });
    } catch (err) {
      console.error('[SMS_SERVICE] Failed to audit log mock SMS', err);
    }

    return { status: 'MOCK_DELIVERED', timestamp: new Date() };
  }
}

module.exports = new SmsService();
