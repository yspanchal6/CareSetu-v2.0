const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';

/**
 * Returns a 32-byte Buffer derived from HEALTH_PACK_KEY or HEALTH_PACK_SECRET_KEY
 * @returns {Buffer} 32-byte secret key buffer
 */
function getSecretKeyBuffer(overrideKey) {
  const rawKey = overrideKey || process.env.HEALTH_PACK_KEY || process.env.HEALTH_PACK_SECRET_KEY || '12345678901234567890123456789012';
  if (Buffer.isBuffer(rawKey)) {
    if (rawKey.length === 32) return rawKey;
    const buf = Buffer.alloc(32);
    rawKey.copy(buf, 0, 0, Math.min(rawKey.length, 32));
    return buf;
  }
  const str = String(rawKey);
  if (/^[0-9a-fA-F]{64}$/.test(str)) {
    return Buffer.from(str, 'hex');
  }
  const buf = Buffer.from(str, 'utf-8');
  if (buf.length === 32) return buf;
  const res = Buffer.alloc(32);
  buf.copy(res, 0, 0, Math.min(buf.length, 32));
  return res;
}

/**
 * Encrypts a payload string using AES-256-CBC
 * Both encrypted_data and iv are strictly hex encoded strings.
 * @param {string} text - The data to encrypt
 * @param {string|Buffer} [overrideKey] - Optional key override for testing
 * @returns { { iv: string, encryptedData: string } }
 */
function encrypt(text, overrideKey) {
  let input = text;
  if (typeof input !== 'string') {
    input = JSON.stringify(input || {});
  }
  const keyBuffer = getSecretKeyBuffer(overrideKey);
  const iv = crypto.randomBytes(16); // 16 bytes for AES-256-CBC
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(input, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
  };
}

/**
 * Decrypts an encrypted payload using AES-256-CBC
 * strictly expecting hex-encoded encryptedData and hex-encoded iv.
 * @param {string} encryptedData - The hex ciphertext
 * @param {string} ivHex - The 16-byte (32 hex char) initialization vector
 * @param {string|Buffer} [overrideKey] - Optional key override for testing
 * @returns {string} - Decrypted plaintext UTF-8 string
 */
function decrypt(encryptedData, ivHex, overrideKey) {
  if (!encryptedData || typeof encryptedData !== 'string' || !ivHex || typeof ivHex !== 'string') {
    throw new Error('Decryption failed: Missing or invalid encryption parameters.');
  }

  const cleanIvHex = ivHex.trim();
  if (!/^[0-9a-fA-F]+$/.test(cleanIvHex)) {
    throw new Error('Decryption failed: Invalid IV format (non-hex).');
  }

  const cleanCipher = encryptedData.trim();
  const keyBuffer = getSecretKeyBuffer(overrideKey);

  // Check for legacy GCM payload containing ':' tag delimiter
  if (cleanCipher.includes(':')) {
    try {
      const [cipherHex, authTagHex] = cleanCipher.split(':');
      const ivBuffer = Buffer.from(cleanIvHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      decipher.setAuthTag(authTag);
      let dec = decipher.update(cipherHex, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } catch (gcmErr) {
      // Fallback failed, continue to CBC decryption logic
    }
  }

  // Strict AES-256-CBC IV byte-length check (16 bytes = 32 hex chars)
  if (cleanIvHex.length !== 32) {
    throw new Error('Decryption failed: Invalid IV byte length (must be 16 bytes / 32 hex chars).');
  }

  if (!/^[0-9a-fA-F]+$/.test(cleanCipher)) {
    throw new Error('Decryption failed: Ciphertext is not valid hex.');
  }

  try {
    const ivBuffer = Buffer.from(cleanIvHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);
    let decrypted = decipher.update(cleanCipher, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error('Decryption failed: Unsupported state, corrupted ciphertext, or invalid key.');
  }
}

/**
 * Encrypts an object into { iv, encryptedData }
 */
function encryptJSON(obj, overrideKey) {
  return encrypt(JSON.stringify(obj || {}), overrideKey);
}

/**
 * Decrypts an encrypted payload and parses JSON safely
 */
function decryptJSON(encryptedData, ivHex, overrideKey) {
  const raw = decrypt(encryptedData, ivHex, overrideKey);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Decryption failed: Decrypted payload is not valid JSON.');
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  getSecretKeyBuffer,
};
