const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.HEALTH_PACK_SECRET_KEY || '12345678901234567890123456789012';
const ALGORITHM = 'aes-256-gcm';

function getSecretKeyBuffer() {
  return Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32), 'utf-8');
}

/**
 * Encrypts a payload string using AES-256-GCM
 * @param {string} text - The data to encrypt
 * @returns { iv: string, encryptedData: string } - The IV and ciphertext:authTag
 */
function encrypt(text) {
  if (typeof text !== 'string') {
    text = JSON.stringify(text);
  }
  const keyBuffer = getSecretKeyBuffer();
  const iv = crypto.randomBytes(12); // 12 bytes standard for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    encryptedData: `${encrypted}:${authTag}`,
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM
 * @param {string} encryptedDataWithTag - The ciphertext:authTag string
 * @param {string} ivHex - The hex representation of the initialization vector
 * @returns {string} - The decrypted text
 */
function decrypt(encryptedDataWithTag, ivHex) {
  try {
    if (!encryptedDataWithTag || !ivHex) {
      throw new Error('Missing encryption parameters');
    }
    const keyBuffer = getSecretKeyBuffer();
    const iv = Buffer.from(ivHex, 'hex');

    const [encrypted, authTagHex] = encryptedDataWithTag.split(':');
    if (!encrypted || !authTagHex) {
      throw new Error('Invalid encrypted payload format or missing authentication tag');
    }

    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    throw new Error('Decryption failed: Unsupported state or invalid authentication tag.');
  }
}

/**
 * Encrypts an object and returns { iv, encryptedData }
 */
function encryptJSON(obj) {
  return encrypt(JSON.stringify(obj || {}));
}

/**
 * Decrypts an encrypted payload and parses JSON safely
 */
function decryptJSON(encryptedData, ivHex) {
  try {
    const raw = decrypt(encryptedData, ivHex);
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Decryption failed: Unsupported state or invalid payload.');
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
};
