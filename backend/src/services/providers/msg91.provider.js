const BaseSmsProvider = require('./base-sms.provider');

/**
 * CareSetu MSG91 SMS Provider
 * Official MSG91 Send OTP API (v5)
 * Endpoint: POST https://control.msg91.com/api/v5/otp?template_id=...&mobile=...&otp=...
 */
class Msg91Provider extends BaseSmsProvider {
  constructor() {
    super('msg91');
  }

  get authKey() {
    return process.env.MSG91_AUTH_KEY;
  }

  get templateId() {
    return process.env.MSG91_OTP_TEMPLATE_ID;
  }

  get baseUrl() {
    return process.env.MSG91_BASE_URL || 'https://control.msg91.com';
  }

  validateConfig() {
    const errors = [];
    if (!this.authKey || !this.authKey.trim()) {
      errors.push('MSG91_AUTH_KEY is not configured.');
    }
    if (!this.templateId || !this.templateId.trim()) {
      errors.push('MSG91_OTP_TEMPLATE_ID is not configured.');
    }

    return {
      valid: errors.length === 0,
      errors,
      provider: this.name,
    };
  }

  getDiagnostics() {
    const config = this.validateConfig();
    return {
      provider: this.name,
      configured: config.valid,
      errors: config.errors,
      authKeyConfigured: !!this.authKey,
      templateIdConfigured: !!this.templateId,
    };
  }

  /**
   * Dispatches custom OTP via MSG91 Send OTP API v5
   */
  async sendOtp(recipient, otp, purpose = 'LOGIN', timeoutMs = 8000) {
    const phone = this.normalizePhone(recipient);
    if (!phone || phone.length !== 10) {
      return {
        success: false,
        provider: this.name,
        deliveryState: 'INVALID_RECIPIENT',
        error: 'A valid 10-digit Indian mobile number is required.',
      };
    }

    const config = this.validateConfig();
    if (!config.valid) {
      if (this.isDevOtpModeAllowed()) {
        console.log(`[MSG91 DEV_MOCK] Missing config (${config.errors.join(', ')}). Dev fallback active for ${this.maskPhone(phone)}.`);
        return {
          success: true,
          mock: true,
          provider: this.name,
          deliveryState: 'DEV_MOCK_SENT',
          messageId: `dev-msg91-${Date.now()}`,
        };
      }

      return {
        success: false,
        provider: this.name,
        deliveryState: 'CONFIG_MISSING',
        error: config.errors.join('; '),
      };
    }

    // MSG91 mobile format: 91 + 10-digit number (without +)
    const mobileWithCountryCode = `91${phone}`;
    const url = new URL('/api/v5/otp', this.baseUrl);
    url.searchParams.set('template_id', this.templateId.trim());
    url.searchParams.set('mobile', mobileWithCountryCode);
    url.searchParams.set('otp', String(otp).trim());

    try {
      console.log(`[MSG91_PROVIDER] Dispatching OTP to ${this.maskPhone(phone)}`);
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.authKey.trim(),
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { message: responseText };
      }

      if (!response.ok) {
        console.error(`[MSG91_PROVIDER] HTTP ${response.status} Error: ${data.message || responseText}`);
        return {
          success: false,
          provider: this.name,
          status: response.status,
          deliveryState: response.status === 429 ? 'QUOTA_EXCEEDED' : 'REJECTED_BY_PROVIDER',
          error: data.message || `MSG91 HTTP ${response.status}`,
        };
      }

      // Check MSG91 JSON response type
      // Success: { "message": "...", "type": "success" }
      if (data.type === 'success' || data.type === 'SUCCESS') {
        const messageId = typeof data.message === 'string' ? data.message : `msg91-${Date.now()}`;
        console.log(`[MSG91_PROVIDER] OTP successfully accepted by MSG91 (MsgId: ${messageId})`);
        return {
          success: true,
          provider: this.name,
          status: response.status,
          deliveryState: 'ACCEPTED_BY_PROVIDER',
          messageId,
        };
      }

      console.warn(`[MSG91_PROVIDER] Request rejected with type '${data.type}': ${data.message || responseText}`);
      return {
        success: false,
        provider: this.name,
        status: response.status,
        deliveryState: 'REJECTED_BY_PROVIDER',
        error: data.message || 'MSG91 OTP dispatch failed.',
      };
    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.code === 20;
      console.error(`[MSG91_PROVIDER] Network/Timeout error: ${err.message}`);
      return {
        success: false,
        provider: this.name,
        deliveryState: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        error: isTimeout ? 'MSG91 request timed out.' : err.message,
      };
    }
  }
}

module.exports = new Msg91Provider();
