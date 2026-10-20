const BaseSmsProvider = require('./base-sms.provider');

/**
 * CareSetu 2Factor SMS Provider
 * Official 2Factor Custom OTP Endpoint:
 * POST/GET https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp_value}/{otp_template_name}
 */
class TwoFactorProvider extends BaseSmsProvider {
  constructor() {
    super('2factor');
  }

  get apiKey() {
    return process.env.TWO_FACTOR_API_KEY;
  }

  get templateName() {
    return process.env.TWO_FACTOR_OTP_TEMPLATE_NAME || 'OTP1';
  }

  get baseUrl() {
    return process.env.TWO_FACTOR_BASE_URL || 'https://2factor.in';
  }

  validateConfig() {
    const errors = [];
    if (!this.apiKey || !this.apiKey.trim()) {
      errors.push('TWO_FACTOR_API_KEY is not configured.');
    }
    if (!this.templateName || !this.templateName.trim()) {
      errors.push('TWO_FACTOR_OTP_TEMPLATE_NAME is not configured.');
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
      apiKeyConfigured: !!this.apiKey,
      templateName: this.templateName,
    };
  }

  /**
   * Dispatches custom OTP via 2Factor Custom SMS API
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
        console.log(`[2Factor DEV_MOCK] Missing config (${config.errors.join(', ')}). Dev fallback active for ${this.maskPhone(phone)}.`);
        return {
          success: true,
          mock: true,
          provider: this.name,
          deliveryState: 'DEV_MOCK_SENT',
          messageId: `dev-2factor-${Date.now()}`,
        };
      }

      return {
        success: false,
        provider: this.name,
        deliveryState: 'CONFIG_MISSING',
        error: config.errors.join('; '),
      };
    }

    // 2Factor manual OTP URL structure:
    // https://2factor.in/API/V1/{api_key}/SMS/{phone_number}/{otp_val}/{template_name}
    const cleanApiKey = encodeURIComponent(this.apiKey.trim());
    const cleanPhone = encodeURIComponent(phone);
    const cleanOtp = encodeURIComponent(String(otp).trim());
    const cleanTemplate = encodeURIComponent(this.templateName.trim());

    const endpoint = `${this.baseUrl}/API/V1/${cleanApiKey}/SMS/${cleanPhone}/${cleanOtp}/${cleanTemplate}`;

    try {
      console.log(`[2FACTOR_PROVIDER] Dispatching OTP to ${this.maskPhone(phone)}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        data = { Details: responseText };
      }

      if (!response.ok) {
        console.error(`[2FACTOR_PROVIDER] HTTP ${response.status} Error: ${data.Details || responseText}`);
        return {
          success: false,
          provider: this.name,
          status: response.status,
          deliveryState: response.status === 429 ? 'QUOTA_EXCEEDED' : 'REJECTED_BY_PROVIDER',
          error: data.Details || `2Factor HTTP ${response.status}`,
        };
      }

      // 2Factor JSON format: { "Status": "Success", "Details": "session_id_or_msg_id" }
      if (data.Status === 'Success' || data.Status === 'SUCCESS') {
        const messageId = typeof data.Details === 'string' ? data.Details : `2factor-${Date.now()}`;
        console.log(`[2FACTOR_PROVIDER] OTP successfully accepted by 2Factor (MsgId: ${messageId})`);
        return {
          success: true,
          provider: this.name,
          status: response.status,
          deliveryState: 'ACCEPTED_BY_PROVIDER',
          messageId,
        };
      }

      console.warn(`[2FACTOR_PROVIDER] Request rejected with status '${data.Status}': ${data.Details || responseText}`);
      return {
        success: false,
        provider: this.name,
        status: response.status,
        deliveryState: 'REJECTED_BY_PROVIDER',
        error: data.Details || '2Factor OTP dispatch failed.',
      };
    } catch (err) {
      const isTimeout = err.name === 'TimeoutError' || err.code === 20;
      console.error(`[2FACTOR_PROVIDER] Network/Timeout error: ${err.message}`);
      return {
        success: false,
        provider: this.name,
        deliveryState: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        error: isTimeout ? '2Factor request timed out.' : err.message,
      };
    }
  }
}

module.exports = new TwoFactorProvider();
