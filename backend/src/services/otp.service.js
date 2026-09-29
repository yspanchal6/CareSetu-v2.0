const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const textbee = require('./providers/textbee.provider');
const brevo = require('./providers/brevo.provider');

class OtpService {
  constructor() {
    this.OTP_LENGTH = 6;
    this.EXPIRY_MINUTES = 5;
    this.MAX_ATTEMPTS = 5;
    this.SALT_ROUNDS = 10;
  }

  /**
   * Generates a cryptographically secure 6-digit OTP
   */
  generateRandomOtp() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Creates and stores a new OTP hash for an identifier
   */
  async createOtp(identifier, purpose = 'LOGIN') {
    if (process.env.NODE_ENV !== 'test') {
      const recentRecord = await prisma.otp.findFirst({
        where: {
          identifier,
          purpose,
          verifiedAt: null,
          createdAt: { gte: new Date(Date.now() - 30 * 1000) },
        },
      });

      if (recentRecord) {
        const err = new Error('An OTP was recently requested for this account. Please wait 30 seconds before requesting another code.');
        err.status = 429;
        throw err;
      }
    }

    const otp = this.generateRandomOtp();
    const otpHash = await bcrypt.hash(otp, this.SALT_ROUNDS);

    const expiresAt = new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing unverified OTP for this identifier & purpose
    await prisma.otp.deleteMany({ where: { identifier, purpose } });
    await prisma.otp.create({
      data: {
        identifier,
        otpHash,
        purpose,
        expiresAt,
        attemptCount: 0,
      },
    });

    return otp;
  }

  async requestOtp({ identifier, phone, email, purpose = 'LOGIN' }) {
    const otp = await this.createOtp(identifier, purpose);
    const otpRecord = await prisma.otp.findFirst({
      where: { identifier, purpose, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const expiresAt = otpRecord.expiresAt;
    const message = `CareSetu OTP: ${otp}\nValid for 5 minutes.\nDo not share.`;
    const sends = [];

    if (phone) {
      sends.push(
        textbee.sendSMS(phone, message)
          .then((result) => ({
            channel: 'sms',
            status: result.success ? 'sent' : 'failed',
            httpStatus: result.status,
            phone,
            deliveryState: result.deliveryState || (result.success ? 'ACCEPTED_BY_PROVIDER' : 'REJECTED_BY_PROVIDER'),
            ...(result.messageId ? { messageId: result.messageId } : {}),
            ...(result.mock ? { mock: true } : {}),
            ...(result.error ? { error: result.error } : {}),
          }))
          .catch((error) => ({ channel: 'sms', status: 'failed', httpStatus: 500, error: error.message }))
      );
    }

    if (email) {
      sends.push(
        brevo.sendEmail({
          to: email,
          subject: 'CareSetu — Email Verification OTP',
          html: `<p>Your CareSetu OTP is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes. Do not share this code with anyone.</p><p>If you did not request this OTP, please ignore this message.</p>`,
          text: message,
        })
          .then((result) => ({
            channel: 'email',
            status: result.success ? 'sent' : 'failed',
            httpStatus: result.status,
            email,
            deliveryState: result.deliveryState || (result.success ? 'ACCEPTED_BY_PROVIDER' : 'REJECTED_BY_PROVIDER'),
            ...(result.messageId ? { messageId: result.messageId } : {}),
            ...(result.mock ? { mock: true } : {}),
            ...(result.error ? { error: result.error } : {}),
          }))
          .catch((error) => ({ channel: 'email', status: 'failed', httpStatus: 500, error: error.message }))
      );
    }

    const channels = await Promise.all(sends);

    // Only log OTP in test environment — NEVER in normal dev/prod logs
    if (process.env.NODE_ENV === 'test') {
      console.log('[OTP_TEST] Expires:', expiresAt.toISOString());
    }

    let anySent = channels.some((ch) => ch.status === 'sent');

    if (!anySent && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_OTP === 'true')) {
      // Allow synthetic fallback in development/test mode if external SMS/Email providers fail or are unconfigured
      anySent = true;
      channels.forEach((ch) => {
        ch.status = 'sent';
        ch.mock = true;
      });
    }

    if (!anySent && channels.length > 0) {
      // SECURITY CRITICAL: Delete un-delivered OTP record so it CANNOT be verified
      await prisma.otp.deleteMany({ where: { identifier, purpose } });

      const smsChannel = channels.find((c) => c.channel === 'sms');
      const emailChannel = channels.find((c) => c.channel === 'email');
      const safeErrorMsg = smsChannel?.error || emailChannel?.error || 'Verification code delivery is temporarily unavailable. Please try again later.';

      console.error('[OTP_SERVICE] Delivery Failed — OTP Record Cleared:', { identifier, purpose, channels });

      const err = new Error(safeErrorMsg);
      const rawStatus = emailChannel?.httpStatus || smsChannel?.httpStatus;
      // External provider status codes like 401/403 (e.g. Brevo/TextBee API key issues) must NEVER be sent as client 401 Unauthorized
      err.status = (rawStatus && rawStatus !== 401 && rawStatus !== 403) ? rawStatus : 502;
      throw err;
    }

    return {
      success: true,
      message: 'OTP request accepted. Please check your phone or inbox for your verification code.',
      expiresAt,
      channels: channels.map((c) => ({
        channel: c.channel,
        status: c.status,
        ...(c.mock ? { mock: true } : {}),
      })),
      mock: channels.some((channel) => channel.status === 'sent' && channel.mock === true),
      ...((process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_OTP === 'true') ? { devOtp: otp } : {}),
    };
  }

  /**
   * Verifies a provided OTP against the stored hash
   */
  async verifyOtp(identifierOrPayload, purposeParam, providedOtpParam) {
    let identifier, purpose, providedOtp;
    if (typeof identifierOrPayload === 'object' && identifierOrPayload !== null) {
      identifier = identifierOrPayload.identifier;
      purpose = identifierOrPayload.purpose;
      providedOtp = identifierOrPayload.otp || identifierOrPayload.providedOtp || identifierOrPayload.otpCode;
    } else {
      identifier = identifierOrPayload;
      purpose = purposeParam;
      providedOtp = providedOtpParam;
    }

    if (!providedOtp || typeof providedOtp !== 'string' || !providedOtp.trim()) {
      throw new Error('OTP code is required.');
    }

    // Find the latest valid unverified OTP
    const otpRecord = await prisma.otp.findFirst({
      where: {
        identifier,
        purpose,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new Error('No active OTP found. Please request a new one.');
    }

    if (otpRecord.attemptCount >= this.MAX_ATTEMPTS) {
      await prisma.otp.delete({ where: { id: otpRecord.id } });
      throw new Error('Maximum verification attempts exceeded. Please request a new OTP.');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new Error('OTP has expired.');
    }

    // Increment attempt count
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { attemptCount: otpRecord.attemptCount + 1 },
    });

    const isValid = await bcrypt.compare(providedOtp.trim(), otpRecord.otpHash);
    if (!isValid) {
      throw new Error('Invalid OTP code.');
    }

    // Mark as verified
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    return true;
  }
}

module.exports = new OtpService();
