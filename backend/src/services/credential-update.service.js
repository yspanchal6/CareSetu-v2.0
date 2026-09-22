const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const brevo = require('./providers/brevo.provider');
const textbee = require('./providers/textbee.provider');

/**
 * Mask sensitive email or mobile number for UI/logging.
 * e.g., j***n@domain.com or +91 ******3210
 */
function maskCredential(value, type) {
  if (!value) return '***';
  if (type === 'EMAIL' || value.includes('@')) {
    const [local, domain] = value.split('@');
    if (local.length <= 2) return `${local[0]}*@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  } else {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 4) return '****';
    return `+91 ******${clean.slice(-4)}`;
  }
}

class CredentialUpdateService {
  /**
   * Step 1: Request credential change (Email or Mobile).
   * Generates OTP, hashes it, stores pending record, sends OTP.
   * Existing database credential is NOT modified.
   */
  async requestCredentialChange({ userId, currentPassword, type, newValue }) {
    if (!type || !['EMAIL', 'MOBILE'].includes(type.toUpperCase())) {
      const err = new Error('Invalid credential type. Must be EMAIL or MOBILE.');
      err.status = 400;
      throw err;
    }
    const credType = type.toUpperCase();

    if (!newValue || typeof newValue !== 'string' || !newValue.trim()) {
      const err = new Error(`New ${credType.toLowerCase()} is required.`);
      err.status = 400;
      throw err;
    }

    // 1. Fetch current user and verify current password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patient: true,
        hospital: true,
      },
    });

    if (!user) {
      const err = new Error('User account not found.');
      err.status = 404;
      throw err;
    }

    if (!currentPassword) {
      const err = new Error('Current password is required to update credentials.');
      err.status = 400;
      throw err;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      const err = new Error('Current password is incorrect.');
      err.status = 400;
      throw err;
    }

    // 2. Format & normalize newValue
    let normalizedValue = newValue.trim();
    if (credType === 'EMAIL') {
      normalizedValue = normalizedValue.toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        const err = new Error('Invalid email address format.');
        err.status = 400;
        throw err;
      }

      if (user.email === normalizedValue) {
        const err = new Error('New email address is identical to your current email.');
        err.status = 400;
        throw err;
      }
    } else {
      // MOBILE
      const phoneRegex = /^[6-9]\d{9}$/;
      const cleanPhone = normalizedValue.replace(/\D/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        const err = new Error('Invalid Indian 10-digit mobile number format.');
        err.status = 400;
        throw err;
      }
      normalizedValue = cleanPhone;

      const currentPhone = user.patient?.phone || user.hospital?.phone;
      if (currentPhone === normalizedValue) {
        const err = new Error('New mobile number is identical to your current mobile number.');
        err.status = 400;
        throw err;
      }
    }

    // 3. Ownership / Conflict Check
    if (credType === 'EMAIL') {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: normalizedValue,
          id: { not: userId },
        },
      });
      if (existingUser) {
        const err = new Error('This email address is already associated with another account.');
        err.status = 409;
        throw err;
      }
    } else {
      // MOBILE check across Patient and Hospital records
      const existingPatient = await prisma.patient.findFirst({
        where: {
          phone: normalizedValue,
          userId: { not: userId },
        },
      });
      const existingHospital = await prisma.hospital.findFirst({
        where: {
          phone: normalizedValue,
          userId: { not: userId },
        },
      });
      if (existingPatient || existingHospital) {
        const err = new Error('This mobile number is already associated with another account.');
        err.status = 409;
        throw err;
      }
    }

    // 4. Rate-limiting check: Min 60s between OTP requests
    const recentChange = await prisma.pendingCredentialChange.findFirst({
      where: {
        userId,
        type: credType,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    if (recentChange) {
      const err = new Error('Please wait 60 seconds before requesting another OTP.');
      err.status = 429;
      throw err;
    }

    // 5. Cancel any previous active PENDING change for this user & type
    await prisma.pendingCredentialChange.updateMany({
      where: {
        userId,
        type: credType,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // 6. Generate cryptographically secure random 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // 7. Store pending credential record (Existing user email/phone unchanged)
    const pendingChange = await prisma.pendingCredentialChange.create({
      data: {
        userId,
        type: credType,
        newValue: normalizedValue,
        otpHash,
        expiresAt,
        status: 'PENDING',
      },
    });

    // 8. Send OTP to new destination
    const messageText = `CareSetu OTP: ${otp}\nValid for 5 minutes.\nUse this OTP to update your ${credType === 'EMAIL' ? 'email address' : 'mobile number'}.`;
    let sendResult = { success: true };

    try {
      if (credType === 'EMAIL') {
        sendResult = await brevo.sendEmail({
          to: normalizedValue,
          subject: 'CareSetu — Account Credential Update OTP',
          html: `<p>Your CareSetu OTP to update your email address is: <strong>${otp}</strong></p><p>Valid for 5 minutes. Do not share this code with anyone.</p><p>If you did not request this update, please secure your account immediately.</p>`,
          text: messageText,
        });
      } else {
        sendResult = await textbee.sendSMS(normalizedValue, messageText);
      }
    } catch (sendErr) {
      sendResult = { success: false, error: sendErr.message };
    }

    // Handle provider rejection: if email/SMS delivery is rejected by provider, cancel pending record and do NOT claim success!
    if (!sendResult.success) {
      await prisma.pendingCredentialChange.update({
        where: { id: pendingChange.id },
        data: { status: 'CANCELLED' },
      });

      const err = new Error(
        `Unable to deliver verification OTP to ${credType === 'EMAIL' ? 'email address' : 'mobile number'}. Delivery service reported failure: ${sendResult.error || 'Provider rejected request'}. Your account details were not updated.`
      );
      err.status = 502;
      throw err;
    }

    // 9. Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'SECURITY_EVENT',
        details: {
          event: 'CREDENTIAL_CHANGE_REQUESTED',
          type: credType,
          maskedDestination: maskCredential(normalizedValue, credType),
          requestId: pendingChange.id,
          messageId: sendResult.messageId || null,
          deliveryState: sendResult.deliveryState || 'SENT',
        },
      },
    });

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      console.log(`[CredentialUpdate DEV ONLY] OTP for ${credType} (${normalizedValue}): ${otp}`);
    }

    return {
      success: true,
      message: `OTP request accepted. Check your ${credType === 'EMAIL' ? 'email inbox and spam folder' : 'mobile number'} for the verification code.`,
      requestId: pendingChange.id,
      expiresAt,
      maskedDestination: maskCredential(normalizedValue, credType),
      deliveryState: sendResult.deliveryState || 'ACCEPTED_BY_PROVIDER',
      ...(isDev ? { devOtp: otp } : {}),
    };
  }

  /**
   * Step 2 & 3: Verify OTP and commit database update atomically.
   * Only after OTP matches, expiresAt is valid, and attempt count is within limit
   * is the database record updated in a transaction.
   */
  async verifyCredentialChange({ userId, requestId, type, otp }) {
    if (!otp || typeof otp !== 'string' || !otp.trim()) {
      const err = new Error('OTP is required.');
      err.status = 400;
      throw err;
    }

    const credType = type ? type.toUpperCase() : undefined;

    // 1. Locate active pending change
    const pendingChange = await prisma.pendingCredentialChange.findFirst({
      where: {
        userId,
        ...(requestId ? { id: requestId } : {}),
        ...(credType ? { type: credType } : {}),
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pendingChange) {
      const err = new Error('No active credential change request found or request was cancelled.');
      err.status = 400;
      throw err;
    }

    // 2. Check expiration
    if (new Date() > pendingChange.expiresAt) {
      await prisma.pendingCredentialChange.update({
        where: { id: pendingChange.id },
        data: { status: 'EXPIRED' },
      });
      const err = new Error('OTP has expired. Please request a new OTP.');
      err.status = 400;
      throw err;
    }

    // 3. Check attempt limit
    if (pendingChange.attemptCount >= pendingChange.maxAttempts) {
      await prisma.pendingCredentialChange.update({
        where: { id: pendingChange.id },
        data: { status: 'EXPIRED' },
      });
      const err = new Error('Maximum verification attempts exceeded. Please request a new OTP.');
      err.status = 400;
      throw err;
    }

    // 4. Increment attempt count
    await prisma.pendingCredentialChange.update({
      where: { id: pendingChange.id },
      data: { attemptCount: pendingChange.attemptCount + 1 },
    });

    // 5. Verify hash
    const isValid = await bcrypt.compare(otp.trim(), pendingChange.otpHash);
    if (!isValid) {
      const remainingAttempts = pendingChange.maxAttempts - (pendingChange.attemptCount + 1);
      const err = new Error(`Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'Maximum attempts exceeded.'}`);
      err.status = 400;
      throw err;
    }

    // 6. ATOMIC TRANSACTION: Commit update to database only after successful verification
    const result = await prisma.$transaction(async (tx) => {
      // Atomic status transition from PENDING -> CONSUMED
      // Guarantees exact-once execution under concurrent requests
      const updateResult = await tx.pendingCredentialChange.updateMany({
        where: {
          id: pendingChange.id,
          status: 'PENDING',
        },
        data: {
          status: 'CONSUMED',
          consumedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const err = new Error('This request has already been processed, consumed, or cancelled.');
        err.status = 400;
        throw err;
      }

      // Re-verify conflict within transaction to prevent race conditions
      if (pendingChange.type === 'EMAIL') {
        const conflict = await tx.user.findFirst({
          where: {
            email: pendingChange.newValue,
            id: { not: userId },
          },
        });
        if (conflict) {
          throw new Error('This email address is now in use by another account.');
        }

        // Update User email
        await tx.user.update({
          where: { id: userId },
          data: {
            email: pendingChange.newValue,
            isVerified: true,
          },
        });

        // Also update Hospital email if user is a hospital
        const hospital = await tx.hospital.findUnique({ where: { userId } });
        if (hospital) {
          await tx.hospital.update({
            where: { id: hospital.id },
            data: { email: pendingChange.newValue },
          });
        }
      } else {
        // MOBILE
        const conflictPatient = await tx.patient.findFirst({
          where: { phone: pendingChange.newValue, userId: { not: userId } },
        });
        const conflictHospital = await tx.hospital.findFirst({
          where: { phone: pendingChange.newValue, userId: { not: userId } },
        });
        if (conflictPatient || conflictHospital) {
          throw new Error('This mobile number is now in use by another account.');
        }

        const patient = await tx.patient.findUnique({ where: { userId } });
        if (patient) {
          await tx.patient.update({
            where: { id: patient.id },
            data: { phone: pendingChange.newValue },
          });
        }

        const hospital = await tx.hospital.findUnique({ where: { userId } });
        if (hospital) {
          await tx.hospital.update({
            where: { id: hospital.id },
            data: { phone: pendingChange.newValue },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'PROFILE_UPDATED',
          details: {
            event: 'CREDENTIAL_UPDATED',
            type: pendingChange.type,
            newValueMasked: maskCredential(pendingChange.newValue, pendingChange.type),
          },
        },
      });

      return {
        type: pendingChange.type,
        newValue: pendingChange.newValue,
      };
    });

    return {
      success: true,
      message: `${result.type === 'EMAIL' ? 'Email address' : 'Mobile number'} successfully verified and updated.`,
      type: result.type,
      newValue: result.newValue,
    };
  }

  /**
   * Cancel an active pending credential change request.
   */
  async cancelCredentialChange({ userId, requestId, type }) {
    const credType = type ? type.toUpperCase() : undefined;
    await prisma.pendingCredentialChange.updateMany({
      where: {
        userId,
        ...(requestId ? { id: requestId } : {}),
        ...(credType ? { type: credType } : {}),
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    return { success: true, message: 'Pending credential change request cancelled.' };
  }
}

module.exports = new CredentialUpdateService();
