const msg91Provider = require('./providers/msg91.provider');
const twoFactorProvider = require('./providers/twofactor.provider');
const brevoProvider = require('./providers/brevo.provider');

/**
 * Multi-Provider OTP Dispatcher with Resilient Circuit-Breaker & Fallback
 * Priority Sequence:
 * 1. MSG91 (Primary SMS)
 * 2. 2Factor (Secondary SMS)
 * 3. Brevo (Verified Email Fallback)
 */
class MultiProviderOtpDispatcher {
  constructor() {
    this.CIRCUIT_FAIL_THRESHOLD = 3;
    this.CIRCUIT_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown on tripping

    this.failureCounts = {
      msg91: 0,
      twofactor: 0,
      brevo: 0,
    };

    this.circuitTrippedUntil = {
      msg91: 0,
      twofactor: 0,
      brevo: 0,
    };
  }

  isCircuitOpen(providerName) {
    const trippedUntil = this.circuitTrippedUntil[providerName] || 0;
    if (Date.now() < trippedUntil) {
      return true;
    }
    return false;
  }

  recordSuccess(providerName) {
    this.failureCounts[providerName] = 0;
    this.circuitTrippedUntil[providerName] = 0;
  }

  recordFailure(providerName) {
    this.failureCounts[providerName] = (this.failureCounts[providerName] || 0) + 1;
    if (this.failureCounts[providerName] >= this.CIRCUIT_FAIL_THRESHOLD) {
      this.circuitTrippedUntil[providerName] = Date.now() + this.CIRCUIT_COOLDOWN_MS;
      console.warn(`[OTP_DISPATCHER] Circuit breaker tripped for provider '${providerName}' until ${new Date(this.circuitTrippedUntil[providerName]).toISOString()}`);
    }
  }

  /**
   * Dispatches OTP using resilient fallback chain
   * @param {Object} params
   * @param {string} [params.phone] Recipient phone number
   * @param {string} [params.email] Verified recipient email address
   * @param {string} params.otp The cryptographically secure OTP string
   * @param {string} params.purpose The OTP intent (LOGIN, PASSWORD_RESET, etc.)
   */
  async dispatchOtp({ phone, email, otp, purpose = 'LOGIN' }) {
    const auditTrail = [];
    let delivered = false;
    let finalDeliveryInfo = null;

    // --- STEP 1: MSG91 (Primary SMS Provider) ---
    if (phone) {
      if (this.isCircuitOpen('msg91')) {
        console.warn(`[OTP_DISPATCHER] Skipping MSG91: circuit breaker active.`);
        auditTrail.push({ provider: 'msg91', status: 'skipped', reason: 'CIRCUIT_OPEN' });
      } else {
        const msg91Result = await msg91Provider.sendOtp(phone, otp, purpose);
        auditTrail.push({
          provider: 'msg91',
          channel: 'sms',
          success: msg91Result.success,
          deliveryState: msg91Result.deliveryState,
          ...(msg91Result.messageId ? { messageId: msg91Result.messageId } : {}),
          ...(msg91Result.mock ? { mock: true } : {}),
          ...(msg91Result.error ? { error: msg91Result.error } : {}),
        });

        if (msg91Result.success) {
          this.recordSuccess('msg91');
          delivered = true;
          finalDeliveryInfo = {
            channel: 'sms',
            provider: 'msg91',
            deliveryState: msg91Result.deliveryState,
            messageId: msg91Result.messageId,
            mock: !!msg91Result.mock,
          };
        } else {
          this.recordFailure('msg91');
        }
      }
    }

    // --- STEP 2: 2Factor (Secondary SMS Provider Fallback) ---
    if (!delivered && phone) {
      if (this.isCircuitOpen('twofactor')) {
        console.warn(`[OTP_DISPATCHER] Skipping 2Factor: circuit breaker active.`);
        auditTrail.push({ provider: '2factor', status: 'skipped', reason: 'CIRCUIT_OPEN' });
      } else {
        console.log(`[OTP_DISPATCHER] Initiating fallback to secondary SMS provider: 2Factor.`);
        const twoFactorResult = await twoFactorProvider.sendOtp(phone, otp, purpose);
        auditTrail.push({
          provider: '2factor',
          channel: 'sms',
          success: twoFactorResult.success,
          deliveryState: twoFactorResult.deliveryState,
          ...(twoFactorResult.messageId ? { messageId: twoFactorResult.messageId } : {}),
          ...(twoFactorResult.mock ? { mock: true } : {}),
          ...(twoFactorResult.error ? { error: twoFactorResult.error } : {}),
        });

        if (twoFactorResult.success) {
          this.recordSuccess('twofactor');
          delivered = true;
          finalDeliveryInfo = {
            channel: 'sms',
            provider: '2factor',
            deliveryState: twoFactorResult.deliveryState,
            messageId: twoFactorResult.messageId,
            mock: !!twoFactorResult.mock,
          };
        } else {
          this.recordFailure('twofactor');
        }
      }
    }

    // --- STEP 3: Brevo (Verified Email Fallback) ---
    if (!delivered && email) {
      if (this.isCircuitOpen('brevo')) {
        console.warn(`[OTP_DISPATCHER] Skipping Brevo: circuit breaker active.`);
        auditTrail.push({ provider: 'brevo', status: 'skipped', reason: 'CIRCUIT_OPEN' });
      } else {
        console.log(`[OTP_DISPATCHER] Initiating fallback to email provider: Brevo.`);
        const emailResult = await brevoProvider.sendEmail({
          to: email,
          subject: 'CareSetu — Verification OTP',
          html: `<p>Your CareSetu verification code is: <strong>${otp}</strong></p><p>This code is valid for 5 minutes. Do not share this code with anyone.</p><p>If you did not request this verification code, please ignore this email.</p>`,
          text: `CareSetu OTP: ${otp}\nValid for 5 minutes.\nDo not share.`,
        });

        auditTrail.push({
          provider: 'brevo',
          channel: 'email',
          success: emailResult.success,
          deliveryState: emailResult.deliveryState,
          ...(emailResult.messageId ? { messageId: emailResult.messageId } : {}),
          ...(emailResult.mock ? { mock: true } : {}),
          ...(emailResult.error ? { error: emailResult.error } : {}),
        });

        if (emailResult.success) {
          this.recordSuccess('brevo');
          delivered = true;
          finalDeliveryInfo = {
            channel: 'email',
            provider: 'brevo',
            deliveryState: emailResult.deliveryState,
            messageId: emailResult.messageId,
            mock: !!emailResult.mock,
          };
        } else {
          this.recordFailure('brevo');
        }
      }
    }

    return {
      delivered,
      finalDeliveryInfo,
      auditTrail,
    };
  }
}

module.exports = new MultiProviderOtpDispatcher();
