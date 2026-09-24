/**
 * Authentication & Security Utility Functions
 */

/**
 * Normalizes email address by trimming whitespace and converting to lowercase.
 * Ensures consistent case-insensitive handling across DB queries and updates.
 */
function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Validates email format using RFC 5322 compatible regex.
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = normalizeEmail(email);
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(normalized);
}

/**
 * Validates password strength.
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&* etc.)
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required.' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }

  if (password.length > 128) {
    return { isValid: false, message: 'Password must not exceed 128 characters.' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one digit.' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character.' };
  }

  return { isValid: true, message: 'Password meets security requirements.' };
}

/**
 * Sanitizes user object for API responses, ensuring sensitive data
 * like password hashes, OTP secrets, or internal tokens are NEVER returned.
 */
function sanitizeUserResponse(user) {
  if (!user) return null;

  const {
    password,
    passwordHash,
    otp,
    otpHash,
    fcmTokens,
    pendingCredentialChanges,
    ...safeUser
  } = user;

  const isPatientComplete = Boolean(
    safeUser.isVerified ||
    (safeUser.patient && safeUser.patient.name && String(safeUser.patient.name).trim().length >= 2 && Number(safeUser.patient.age) > 0 && safeUser.patient.gender && String(safeUser.patient.gender).toUpperCase() !== 'UNSPECIFIED')
  );

  return {
    id: safeUser.id,
    email: safeUser.email ? normalizeEmail(safeUser.email) : undefined,
    role: safeUser.role,
    name: safeUser.name || safeUser.patient?.name || safeUser.hospital?.name || undefined,
    status: safeUser.status,
    isVerified: safeUser.isVerified,
    isProfileComplete: safeUser.role === 'PATIENT' ? isPatientComplete : safeUser.isVerified,
    lastLoginAt: safeUser.lastLoginAt,
    createdAt: safeUser.createdAt,
    hospitalId: safeUser.hospital?.id || undefined,
    patientId: safeUser.patient?.id || undefined,
    patient: safeUser.patient ? safeUser.patient : undefined,
    locationSource: safeUser.hospital?.location?.source || undefined,
    locationAccuracy: safeUser.hospital?.location?.accuracy || undefined,
  };
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  validatePasswordStrength,
  sanitizeUserResponse,
};
