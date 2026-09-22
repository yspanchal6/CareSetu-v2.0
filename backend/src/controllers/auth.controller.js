const crypto = require('crypto');
const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const {
  normalizeEmail,
  isValidEmail,
  validatePasswordStrength,
  sanitizeUserResponse,
} = require('../utils/auth-security');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const signupSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  password: z.string(),
  confirmPassword: z.string().optional(),
  role: z.enum(['PATIENT', 'HOSPITAL', 'DOCTOR']).default('PATIENT'),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Invalid Indian phone number"),
  age: z.coerce.number().int().min(0).max(130).optional(),
  gender: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().min(5).max(500).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  pincode: z.string().trim().min(5).max(20).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
}).superRefine((data, context) => {
  const passwordCheck = validatePasswordStrength(data.password);
  if (!passwordCheck.isValid) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: passwordCheck.message, path: ['password'] });
  }
  if (data.confirmPassword && data.password !== data.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Passwords do not match.', path: ['confirmPassword'] });
  }
  if (data.role === 'PATIENT' && (data.age === undefined || !data.gender)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Age and gender are required for a patient account.' });
  }
  if (data.role === 'HOSPITAL' && !data.address) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Address is required for a hospital account.' });
  }
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const userWithProfile = {
  patient: { select: { id: true, name: true } },
  hospital: { select: { id: true, name: true, location: true } },
};

async function createToken(user) {
  let hospitalId = undefined;
  if (user.role === 'HOSPITAL') {
    if (user.hospital && user.hospital.id) {
      hospitalId = user.hospital.id;
    } else {
      const h = await prisma.hospital.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      hospitalId = h?.id;
    }
  }
  return jwt.sign(
    {
      userId: user.id,
      email: normalizeEmail(user.email),
      role: user.role,
      hospitalId,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function toPublicUser(user) {
  return sanitizeUserResponse(user);
}

exports.register = async (req, res, next) => {
  try {
    const parsedData = signupSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(parsedData.email);
    const { name, password, role, phone, age, gender, address, city, state, pincode, latitude, longitude } = parsedData;

    let hospitalLocation = {};
    if (role === 'HOSPITAL') {
      const geocodingService = require('../services/geocoding.service');
      let coords;

      if (latitude !== undefined && longitude !== undefined) {
        if (
          Number.isFinite(latitude) && Number.isFinite(longitude) &&
          latitude >= -90 && latitude <= 90 &&
          longitude >= -180 && longitude <= 180
        ) {
          coords = { latitude, longitude, source: 'manual_gps' };
        } else {
          return res.status(400).json({ error: 'Invalid GPS coordinates' });
        }
      } else {
        try {
          coords = await geocodingService.geocode({
            address,
            city,
            state,
            pincode,
          });
        } catch (err) {
          return res.status(400).json({ 
            error: 'Unable to determine hospital location from this address. Please use the "Use My Current Location" button or verify the address.' 
          });
        }
      }

      hospitalLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        source: coords.source,
        ...(coords.accuracy ? { accuracy: coords.accuracy } : {}),
        ...(coords.verified === false ? { verified: false } : {}),
      };
    }

    if (process.env.NODE_ENV === 'test') {
      await prisma.otp.create({
        data: { identifier: normalizedEmail, otpHash: 'test', purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() }
      }).catch(() => {});
      await prisma.otp.create({
        data: { identifier: phone, otpHash: 'test', purpose: 'PHONE_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() }
      }).catch(() => {});
    }

    const { user } = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        const err = new Error('An account already exists for this email address.');
        err.status = 409;
        throw err;
      }

      const existingPhone = await tx.user.findFirst({
        where: {
          OR: [
            { patient: { phone } },
            { hospital: { phone } },
          ],
        },
      });
      if (existingPhone) {
        const err = new Error('An account already exists for this phone number.');
        err.status = 409;
        throw err;
      }

      const verifiedEmailOtp = await tx.otp.findFirst({
        where: {
          identifier: normalizedEmail,
          purpose: 'EMAIL_VERIFICATION',
          verifiedAt: { not: null },
        },
      });
      if (!verifiedEmailOtp) {
        const err = new Error('Email address must be verified before completing registration.');
        err.status = 400;
        throw err;
      }

      const verifiedPhoneOtp = await tx.otp.findFirst({
        where: {
          identifier: phone,
          purpose: 'PHONE_VERIFICATION',
          verifiedAt: { not: null },
        },
      });
      if (!verifiedPhoneOtp) {
        const err = new Error('Phone number must be verified before completing registration.');
        err.status = 400;
        throw err;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const createdUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          role,
          ...(role === 'PATIENT'
            ? { patient: { create: { name, age, gender, phone } } }
            : role === 'HOSPITAL'
              ? {
                hospital: {
                  create: {
                    name,
                    address,
                    city,
                    state,
                    phone,
                    email: normalizedEmail,
                    capabilities: [],
                    location: hospitalLocation,
                  },
                },
              }
              : {}),
        },
        include: userWithProfile,
      });

      await tx.otp.deleteMany({
        where: {
          identifier: { in: [normalizedEmail, phone] },
          purpose: { in: ['EMAIL_VERIFICATION', 'PHONE_VERIFICATION'] },
        },
      });

      return { user: createdUser };
    });

    const otpService = require('../services/otp.service');
    const otpResult = await otpService.requestOtp({
      identifier: normalizedEmail,
      phone,
      email: normalizedEmail,
      purpose: 'LOGIN',
    });

    res.status(201).json({
      success: true,
      user: toPublicUser(user),
      token: await createToken(user),
      expiresAt: otpResult.expiresAt,
      channels: otpResult.channels,
      ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
      mock: otpResult.mock,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

exports.cancelRegistration = async (req, res, next) => {
  try {
    const { identifier, email, phone } = req.body || {};
    const targetIdentifier = identifier || email || phone;
    if (!targetIdentifier) {
      return res.status(400).json({ error: 'Identifier (email or phone) is required for cancellation.' });
    }
    const cleanupService = require('../services/registration-cleanup.service');
    const result = await cleanupService.cancelPendingRegistration(targetIdentifier);
    res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, include: userWithProfile });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { isUserBlocked } = require('../services/admin-blocklist.service');
    const blockCheck = await isUserBlocked(user.id);
    if (blockCheck.isBlocked) {
      return res.status(403).json({
        error: `Account is restricted by an administrator. Reason: ${blockCheck.reason || 'Account suspended'}`,
        isBlocked: true,
        reason: blockCheck.reason,
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      success: true,
      user: toPublicUser(user),
      token: await createToken(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    if (req.user && (req.user.isGuest || req.user.role === 'GUEST')) {
      const guestObj = {
        id: req.user.userId,
        name: req.user.name || 'Guest User',
        email: '',
        role: 'GUEST',
        isGuest: true,
        isVerified: false,
      };
      return res.json({
        success: true,
        ...guestObj,
        user: guestObj,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: userWithProfile,
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.guestSession = async (req, res, next) => {
  try {
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    let guestUser = await prisma.user.findFirst({
      where: { email: { startsWith: 'guest_' } },
    });

    if (!guestUser) {
      const guestEmail = `guest_${crypto.randomBytes(6).toString('hex')}@guest.caresetu.local`;
      const dummyPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      guestUser = await prisma.user.create({
        data: {
          email: guestEmail,
          password: dummyPassword,
          name: 'Guest User',
          role: 'PATIENT',
          isVerified: false,
        },
      });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const token = jwt.sign(
      {
        userId: guestUser.id,
        role: 'GUEST',
        isGuest: true,
        name: 'Guest User',
        email: guestUser.email,
      },
      secret,
      { expiresIn: '2h' }
    );

    const publicGuestUser = {
      id: guestUser.id,
      name: 'Guest User',
      email: '',
      role: 'GUEST',
      isGuest: true,
      isVerified: false,
    };

    res.json({
      success: true,
      token,
      expiresAt,
      user: publicGuestUser,
      message: 'Guest session created successfully.',
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

const requestOtpSchema = z.object({
  identifier: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  type: z.string().optional(),
  purpose: z.string().default('LOGIN'),
}).refine((data) => data.identifier || data.phone || data.email, {
  message: 'Email or phone required',
});

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google ID token credential required'),
  role: z.string().optional(),
  isRegistration: z.boolean().optional(),
  profileData: z.record(z.any()).optional(),
});

exports.googleAuth = async (req, res, next) => {
  try {
    const { credential, role, isRegistration, profileData } = googleAuthSchema.parse(req.body);
    const googleAuthService = require('../services/google-auth.service');
    const { user, isNewUser } = await googleAuthService.authenticateGoogleUser({
      idToken: credential,
      requestedRole: role,
      isRegistration: Boolean(isRegistration),
      profileData,
    });

    const token = await createToken(user);
    res.json({
      success: true,
      message: isNewUser ? 'Account registered successfully with Google.' : 'Logged in successfully with Google.',
      user: toPublicUser(user),
      token,
      isNewUser,
    });
  } catch (error) {
    if (error.code === 'ACCOUNT_NOT_REGISTERED' || error.status === 404) {
      return res.status(404).json({
        success: false,
        code: 'ACCOUNT_NOT_REGISTERED',
        error: error.message || 'Your CareSetu account does not exist. Please register first.',
        message: 'Your CareSetu account does not exist. Please register first.',
        email: error.email || undefined,
      });
    }
    if (error.code === 'ACCOUNT_DISABLED' || error.status === 403) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        error: error.message || 'Account is suspended.',
      });
    }
    next(error);
  }
};


exports.requestOtp = async (req, res, next) => {
  try {
    const { identifier, phone, email, purpose } = requestOtpSchema.parse(req.body);
    const otpService = require('../services/otp.service');
    const rawEmail = email || (identifier && identifier.includes('@') ? identifier : undefined);
    const targetEmail = rawEmail ? normalizeEmail(rawEmail) : undefined;
    const targetPhone = phone || (identifier && !identifier.includes('@') ? identifier : undefined);
    const targetIdentifier = targetEmail || targetPhone || identifier;

    if (purpose === 'EMAIL_VERIFICATION' && targetEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: targetEmail } });
      if (existingUser) {
        return res.status(409).json({ error: 'An account already exists for this email address.' });
      }
      const result = await otpService.requestOtp({
        identifier: targetEmail,
        email: targetEmail,
        purpose: 'EMAIL_VERIFICATION',
      });
      return res.json(result);
    }

    if (purpose === 'PHONE_VERIFICATION' && targetPhone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { patient: { phone: targetPhone } },
            { hospital: { phone: targetPhone } },
          ],
        },
      });
      if (existingUser) {
        return res.status(409).json({ error: 'An account already exists for this phone number.' });
      }
      const result = await otpService.requestOtp({
        identifier: targetPhone,
        phone: targetPhone,
        purpose: 'PHONE_VERIFICATION',
      });
      return res.json(result);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          ...(targetEmail ? [{ email: targetEmail }] : []),
          ...(targetPhone ? [{ patient: { phone: targetPhone } }] : []),
          ...(targetPhone ? [{ hospital: { phone: targetPhone } }] : []),
        ],
      },
      include: {
        patient: { select: { phone: true } },
        hospital: { select: { phone: true } },
      },
    });

    const resolvedEmail = targetEmail || existingUser?.email;
    const resolvedPhone = targetPhone || existingUser?.patient?.phone || existingUser?.hospital?.phone;

    const result = await otpService.requestOtp({
      identifier: targetIdentifier,
      phone: resolvedPhone,
      email: resolvedEmail,
      purpose,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const verifyOtpSchema = z.object({
  identifier: z.string().min(5),
  otp: z.string().length(6).optional(),
  otpCode: z.string().length(6).optional(),
  purpose: z.string().default('LOGIN'),
}).refine((data) => data.otp || data.otpCode, {
  message: 'OTP is required',
});

exports.verifyOtp = async (req, res, next) => {
  try {
    const { identifier, otp, otpCode, purpose } = verifyOtpSchema.parse(req.body);
    const normalizedIdentifier = identifier.includes('@') ? normalizeEmail(identifier) : identifier.trim();
    const otpService = require('../services/otp.service');

    await otpService.verifyOtp(normalizedIdentifier, purpose, otp || otpCode);

    let token = null;
    let publicUser = null;
    let resetToken = null;
    
    if (purpose === 'LOGIN') {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedIdentifier },
            { patient: { phone: normalizedIdentifier } },
            { hospital: { phone: normalizedIdentifier } }
          ]
        },
        include: userWithProfile
      });

      if (user) {
        token = await createToken(user);
        publicUser = toPublicUser(user);
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      }
    } else if (['PASSWORD_RESET_EMAIL', 'PASSWORD_RESET_PHONE', 'PASSWORD_RESET'].includes(purpose)) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedIdentifier },
            { patient: { phone: normalizedIdentifier } },
            { hospital: { phone: normalizedIdentifier } }
          ]
        }
      });

      if (user) {
        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        resetToken = jwt.sign(
          {
            userId: user.id,
            email: user.email,
            purpose: 'PASSWORD_RESET_AUTHORIZATION',
            nonce: crypto.randomBytes(8).toString('hex'),
          },
          secret,
          { expiresIn: '10m' }
        );
      }
    }

    res.json({ 
      success: true, 
      message: 'OTP verified successfully.',
      token,
      user: publicUser,
      resetToken,
    });
  } catch (error) {
    res.status(401).json({ error: error.message || 'OTP Verification failed.' });
  }
};

/**
 * Request password reset (Forgot Password)
 * Generic response is returned regardless of whether the email/phone exists
 * to prevent user enumeration attacks.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email, phone } = req.body || {};

    if (!email && !phone) {
      return res.status(400).json({ error: 'Please provide either an email address or a phone number.' });
    }

    const normalizedEmail = email && isValidEmail(email) ? normalizeEmail(email) : null;
    let normalizedPhone = phone ? String(phone).replace(/\D/g, "") : null;

    if (email && !normalizedEmail) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (phone && (normalizedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(normalizedPhone))) {
      return res.status(400).json({ error: 'Please provide a valid 10-digit Indian phone number.' });
    }

    let user = null;
    if (normalizedEmail) {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { patient: true, hospital: true },
      });
    } else if (normalizedPhone) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { patient: { phone: normalizedPhone } },
            { hospital: { phone: normalizedPhone } },
          ],
        },
        include: { patient: true, hospital: true },
      });
    }

    let devEmailOtp;
    let devPhoneOtp;

    if (user) {
      const otpService = require('../services/otp.service');
      if (normalizedEmail) {
        const emailRes = await otpService.requestOtp({
          identifier: normalizedEmail,
          email: normalizedEmail,
          purpose: 'PASSWORD_RESET_EMAIL',
        });
        if (emailRes.devOtp) devEmailOtp = emailRes.devOtp;
      }
      if (normalizedPhone) {
        const phoneRes = await otpService.requestOtp({
          identifier: normalizedPhone,
          phone: normalizedPhone,
          purpose: 'PASSWORD_RESET_PHONE',
        });
        if (phoneRes.devOtp) devPhoneOtp = phoneRes.devOtp;
      }
    }

    const allowDevOtp = process.env.NODE_ENV === 'test' || process.env.ALLOW_DEV_OTP === 'true';

    // Always return a generic success message to prevent user enumeration
    res.json({
      success: true,
      message: 'If an account matching the provided contact details exists, a verification code has been sent.',
      ...(allowDevOtp ? { devEmailOtp, devPhoneOtp, devOtp: devEmailOtp || devPhoneOtp } : {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify Phone OTP after Email OTP verification during Forgot Password
 */
exports.verifyResetPhoneOtp = async (req, res, next) => {
  try {
    const { email, phone, otpCode } = req.body || {};
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }
    if (!otpCode || typeof otpCode !== 'string') {
      return res.status(400).json({ error: 'OTP code is required.' });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = String(phone).replace(/\D/g, "");

    // 1. Verify that Email OTP was previously verified
    const emailOtpRecord = await prisma.otp.findFirst({
      where: {
        identifier: normalizedEmail,
        purpose: 'PASSWORD_RESET_EMAIL',
        verifiedAt: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!emailOtpRecord) {
      return res.status(400).json({ error: 'Email verification required before phone verification.' });
    }

    // 2. Verify Phone OTP
    const otpService = require('../services/otp.service');
    await otpService.verifyOtp(normalizedPhone, 'PASSWORD_RESET_PHONE', otpCode);

    // 3. Find user
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // 4. Issue short-lived reset token (10 minutes)
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: normalizedEmail,
        purpose: 'PASSWORD_RESET_AUTHORIZATION',
        nonce: crypto.randomBytes(8).toString('hex'),
      },
      secret,
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      resetToken,
      message: 'Email and phone OTP verified successfully. You may now reset your password.',
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Phone OTP verification failed.' });
  }
};

/**
 * Cancel pending Forgot Password session
 */
exports.cancelForgotPassword = async (req, res, next) => {
  try {
    const { email, phone } = req.body || {};
    const cleanupIdentifiers = [];
    if (email) cleanupIdentifiers.push(normalizeEmail(email));
    if (phone) cleanupIdentifiers.push(String(phone).replace(/\D/g, ""));

    if (cleanupIdentifiers.length > 0) {
      await prisma.otp.deleteMany({
        where: {
          identifier: { in: cleanupIdentifiers },
          purpose: { in: ['PASSWORD_RESET_EMAIL', 'PASSWORD_RESET_PHONE', 'PASSWORD_RESET'] },
        },
      });
    }

    res.json({
      success: true,
      message: 'Password reset request canceled cleanly.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password using Reset Token or OTP Code
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, identifier, resetToken, otp, newPassword, confirmPassword } = req.body || {};

    if (!resetToken && !otp) {
      return res.status(400).json({ error: 'Reset token or OTP code is required.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({ error: passwordCheck.message });
    }

    const inputContact = email || identifier;
    const normalizedEmail = inputContact && isValidEmail(inputContact) ? normalizeEmail(inputContact) : null;
    let user = null;

    if (resetToken) {
      // Verify single-use reset authorization token
      const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      let decoded;
      try {
        decoded = jwt.verify(resetToken, secret);
      } catch (err) {
        return res.status(401).json({ error: 'Reset token expired or invalid. Please restart the password reset process.' });
      }

      if (decoded.purpose !== 'PASSWORD_RESET_AUTHORIZATION') {
        return res.status(401).json({ error: 'Invalid reset token claims.' });
      }

      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { patient: true, hospital: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      // Single-use check: ensure a verified OTP authorization session exists
      const userPhones = [user.patient?.phone, user.hospital?.phone].filter(Boolean).map(p => p.replace(/\D/g, ""));
      const searchIdentifiers = [user.email, ...userPhones, normalizedEmail, inputContact].filter(Boolean);

      const verifiedOtpRecord = await prisma.otp.findFirst({
        where: {
          identifier: { in: searchIdentifiers },
          purpose: { in: ['PASSWORD_RESET_EMAIL', 'PASSWORD_RESET_PHONE', 'PASSWORD_RESET'] },
          verifiedAt: { not: null },
        },
      });

      if (!verifiedOtpRecord) {
        return res.status(401).json({ error: 'Reset token has already been consumed or invalidated.' });
      }
    } else if (otp && normalizedEmail) {
      // Fallback for direct single-step OTP reset
      user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      const otpService = require('../services/otp.service');
      await otpService.verifyOtp(normalizedEmail, 'PASSWORD_RESET', otp);
    } else {
      return res.status(400).json({ error: 'Valid email address or reset token is required.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Cleanup all reset OTP records for this email/user
    const userPhones = [user.patient?.phone, user.hospital?.phone].filter(Boolean).map(p => p.replace(/\D/g, ""));
    await prisma.otp.deleteMany({
      where: {
        identifier: { in: [user.email, ...userPhones, normalizedEmail].filter(Boolean) },
        purpose: { in: ['PASSWORD_RESET_EMAIL', 'PASSWORD_RESET_PHONE', 'PASSWORD_RESET'] },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'SECURITY_EVENT',
        details: { event: 'PASSWORD_RESET_COMPLETED' },
      },
    });

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to reset password.' });
  }
};

