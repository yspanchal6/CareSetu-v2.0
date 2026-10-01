const crypto = require('crypto');

/**
 * CareSetu Reversible URL Payload Encryption Utility
 * Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
 *
 * Security features:
 * - 12-byte cryptographically secure random IV/nonce per payload
 * - 16-byte authentication tag verification to reject tampered/modified ciphertext
 * - 32-byte key derived via SHA-256 hash of server environment secrets
 * - Versioned ciphertext format: v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * - Never logs keys, IVs, or sensitive parameters
 */

function getEncryptionKey() {
  const secret = process.env.URL_ENCRYPTION_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: URL_ENCRYPTION_SECRET or JWT_SECRET environment variable must be set in production.');
    }
    // Safe fallback for local development and automated testing only
    return crypto.createHash('sha256').update('caresetu-dev-test-encryption-key-do-not-use-in-prod').digest();
  }

  if (secret.length < 16) {
    throw new Error('Security Error: Encryption secret must be at least 16 characters long.');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a JSON serializable payload object into a versioned AES-256-GCM string
 * @param {object} payload - Object to encrypt (e.g., { resourceId, resourceType, expiresAt })
 * @returns {string} Versioned encrypted token string (v1:iv:tag:ciphertext)
 */
function encryptPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload object for encryption.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonStr = JSON.stringify({
    ...payload,
    _t: Date.now(),
  });

  let encrypted = cipher.update(jsonStr, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  return `v1:${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a versioned AES-256-GCM encrypted token string back into the payload object
 * @param {string} encryptedString - Versioned ciphertext (v1:iv:tag:ciphertext)
 * @returns {object} Decrypted payload object
 */
function decryptPayload(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string') {
    const error = new Error('Invalid ciphertext format.');
    error.status = 400;
    throw error;
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    const error = new Error('Unsupported or malformed encrypted token format.');
    error.status = 400;
    throw error;
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;

  if (!ivHex || !authTagHex || !ciphertextHex || ivHex.length !== 24 || authTagHex.length !== 32) {
    const error = new Error('Malformed encryption metadata or authentication tag.');
    error.status = 400;
    throw error;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const payload = JSON.parse(decrypted);

    // Optional expiration check if expiresAt is present in payload
    if (payload.expiresAt) {
      const expTime = new Date(payload.expiresAt).getTime();
      if (!isNaN(expTime) && Date.now() > expTime) {
        const error = new Error('Encrypted URL token has expired.');
        error.status = 410;
        throw error;
      }
    }

    return payload;
  } catch (err) {
    if (err.status) throw err;
    const error = new Error('Token decryption failed: Ciphertext is corrupted or tampered.');
    error.status = 403;
    throw error;
  }
}

/**
 * Hashes a raw token string using SHA-256 for secure database storage and lookup
 * @param {string} rawToken
 * @returns {string} 64-character hex hash
 */
function hashToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    throw new Error('Raw token must be a valid string.');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a cryptographically secure 32-byte hex token string (64 hex characters)
 * @returns {string} Unpredictable random token
 */
function generateOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encryptPayload,
  decryptPayload,
  hashToken,
  generateOpaqueToken,
};
