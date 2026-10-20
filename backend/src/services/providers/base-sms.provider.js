/**
 * Base SMS Provider Interface
 * All SMS providers in CareSetu implement this contract.
 */
class BaseSmsProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Helper to mask phone numbers safely in log files
   * e.g., +91 98*** **534
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
   * Normalizes phone number into 10-digit Indian mobile format
   */
  normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) return clean;
    if (clean.length === 11 && clean.startsWith('0')) return clean.slice(1);
    if (clean.length === 12 && clean.startsWith('91')) return clean.slice(2);
    return clean;
  }

  /**
   * Determines if Dev OTP mode is allowed in non-production environments
   */
  isDevOtpModeAllowed() {
    const isProd = process.env.NODE_ENV === 'production';
    const isDevFlag = process.env.DEV_OTP_MODE === 'true' || process.env.DEV_OTP_MODE === '1' || process.env.NODE_ENV === 'test';

    if (isProd && isDevFlag) {
      console.error(`[SECURITY_ALERT] DEV_OTP_MODE=true is enabled in production! Disabling dev fallback for ${this.name}.`);
      return false;
    }

    return !isProd && isDevFlag;
  }

  /**
   * Abstract validation method
   * Must return { valid: boolean, errors: string[] }
   */
  validateConfig() {
    throw new Error('validateConfig() must be implemented by subclass');
  }

  /**
   * Abstract sendOtp method
   * Must return:
   * {
   *   success: boolean,
   *   provider: string,
   *   deliveryState: string,
   *   messageId?: string,
   *   error?: string,
   *   status?: number,
   *   mock?: boolean
   * }
   */
  async sendOtp(recipient, otp, purpose = 'LOGIN') {
    throw new Error('sendOtp() must be implemented by subclass');
  }
}

module.exports = BaseSmsProvider;
