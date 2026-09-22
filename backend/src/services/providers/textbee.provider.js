/**
 * CareSetu TextBee SMS Service Provider
 * Handles transactional SMS (OTP, emergency alerts) via TextBee API v1
 */

class TextBeeProvider {
  get apiKey() {
    return process.env.TEXTBEE_API_KEY;
  }

  get baseUrl() {
    return process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev';
  }

  get deviceId() {
    return process.env.TEXTBEE_DEVICE_ID;
  }

  /**
   * Safe phone masking helper for logs
   */
  maskPhone(phone) {
    if (!phone || typeof phone !== 'string' || phone.length < 6) return 'not-set';
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    }
    if (clean.length < 10) return '***-***';
    return `+91 ${clean.slice(0, 2)}*** **${clean.slice(-3)}`;
  }

  /**
   * Evaluates if Dev OTP Mode is allowed based on NODE_ENV and DEV_OTP_MODE flag.
   * Strictly FORBIDDEN in production.
   */
  isDevOtpModeAllowed() {
    const isProd = process.env.NODE_ENV === 'production';
    const isDevFlag = process.env.DEV_OTP_MODE === 'true' || process.env.DEV_OTP_MODE === '1';

    if (isProd && isDevFlag) {
      console.error('[SECURITY_ALERT] DEV_OTP_MODE=true is enabled in production! Disabling dev fallback for security compliance.');
      return false;
    }

    return !isProd && isDevFlag;
  }

  /**
   * Validates TextBee configuration safely
   */
  validateConfig() {
    const errors = [];
    if (!this.apiKey || !this.apiKey.trim()) {
      errors.push('TEXTBEE_API_KEY is not configured.');
    }
    if (!this.deviceId || !this.deviceId.trim()) {
      errors.push('TEXTBEE_DEVICE_ID is not configured.');
    }

    return {
      valid: errors.length === 0,
      errors,
      provider: 'textbee',
      deviceIdConfigured: !!this.deviceId,
    };
  }

  /**
   * Dispatches SMS via TextBee API v1
   */
  async sendSMS(recipient, message, maxRetries = 2) {
    if (!recipient || typeof recipient !== 'string' || !recipient.trim()) {
      return {
        success: false,
        provider: 'textbee',
        deliveryState: 'INVALID_RECIPIENT',
        error: 'Recipient phone number is required.',
      };
    }

    const cleanPhone = recipient.trim().replace(/\D/g, '');
    const formattedRecipient = cleanPhone.length === 10 ? `+91${cleanPhone}` : recipient.trim();

    const config = this.validateConfig();
    if (!config.valid) {
      // Check if Dev OTP Mode is explicitly enabled for development
      if (this.isDevOtpModeAllowed()) {
        console.log(`[TextBee DEV_MOCK] Configuration missing (${config.errors.join(', ')}). Dev fallback active for ${this.maskPhone(formattedRecipient)}.`);
        return {
          success: true,
          mock: true,
          provider: 'textbee',
          deliveryState: 'DEV_MOCK_SENT',
          messageId: `dev-sms-${Date.now()}`,
        };
      }

      console.error(`[TEXTBEE_PROVIDER] Configuration error: ${config.errors.join('; ')}`);
      return {
        success: false,
        provider: 'textbee',
        deliveryState: 'CONFIG_ERROR',
        error: 'SMS verification is temporarily unavailable. Please try again later.',
      };
    }

    const payload = {
      recipients: [formattedRecipient],
      message: message,
      deviceId: this.deviceId.trim(),
    };

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      try {
        console.log(`[TEXTBEE_PROVIDER] Dispatching SMS to ${this.maskPhone(formattedRecipient)} (Attempt ${attempt}/${maxRetries + 1})`);

        const response = await fetch(`${this.baseUrl}/api/v1/gateway/send-sms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey.trim(),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 429) {
            console.error(`[TEXTBEE_PROVIDER] HTTP 429 Quota Exceeded / Rate Limit: ${errorText.slice(0, 150)}`);
            // Fast fail — DO NOT retry 429 quota error
            return {
              success: false,
              provider: 'textbee',
              status: 429,
              deliveryState: 'QUOTA_EXCEEDED',
              error: 'SMS verification is temporarily unavailable due to rate limits. Please try again later.',
            };
          }

          if (response.status === 401 || response.status === 403) {
            console.error(`[TEXTBEE_PROVIDER] HTTP ${response.status} Auth Error: Invalid API Key or Device ID.`);
            return {
              success: false,
              provider: 'textbee',
              status: response.status,
              deliveryState: 'AUTH_FAILURE',
              error: 'SMS verification is temporarily unavailable. Please try again later.',
            };
          }

          if (response.status >= 500) {
            console.error(`[TEXTBEE_PROVIDER] HTTP ${response.status} Provider Server Error.`);
            if (attempt <= maxRetries) {
              console.warn(`[TEXTBEE_PROVIDER] Retrying transient 5xx error in ${attempt * 500}ms...`);
              await new Promise((resolve) => setTimeout(resolve, attempt * 500));
              continue;
            }
            return {
              success: false,
              provider: 'textbee',
              status: response.status,
              deliveryState: 'PROVIDER_SERVER_ERROR',
              error: 'SMS service is temporarily unavailable. Please try again later.',
            };
          }

          return {
            success: false,
            provider: 'textbee',
            status: response.status,
            deliveryState: 'REJECTED_BY_PROVIDER',
            error: 'SMS verification is temporarily unavailable. Please try again later.',
          };
        }

        const data = await response.json();
        console.log(`[TEXTBEE_PROVIDER] Provider Accepted SMS (MessageID: ${data.data?._id || data.messageId || 'N/A'})`);

        return {
          success: true,
          provider: 'textbee',
          status: response.status,
          messageId: data.data?._id || data.messageId || `textbee-${Date.now()}`,
          deliveryState: 'ACCEPTED_BY_PROVIDER',
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timeout');
        console.error(`[TEXTBEE_PROVIDER] Network/Timeout Error (Attempt ${attempt}/${maxRetries + 1}): ${error.message}`);

        if (attempt <= maxRetries) {
          console.warn(`[TEXTBEE_PROVIDER] Retrying transient network error in ${attempt * 500}ms...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          continue;
        }

        return {
          success: false,
          provider: 'textbee',
          deliveryState: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
          error: 'SMS delivery timed out. Please try again.',
        };
      }
    }
  }
}

module.exports = new TextBeeProvider();
