/**
 * Enterprise Structured Logger with Automatic PII & Secret Redaction
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'confirmpassword',
  'otp',
  'otphash',
  'devotp',
  'token',
  'jwt',
  'authorization',
  'x-auth-token',
  'secret',
  'jwt_secret',
  'apikey',
  'api_key',
  'privatekey',
  'creditcard',
  'cardnumber',
  'cvv',
  'ssn',
  'aadhaar',
]);

function maskStringValue(key, val) {
  if (typeof val !== 'string') return val;
  const lowerKey = key.toLowerCase();

  if (SENSITIVE_KEYS.has(lowerKey)) {
    return '[REDACTED_SECRET]';
  }

  // Email masking: y***@domain.com
  if (lowerKey === 'email' || (val.includes('@') && val.includes('.'))) {
    const parts = val.split('@');
    if (parts.length === 2 && parts[0].length > 0) {
      const namePart = parts[0];
      const domain = parts[1];
      const maskedName = namePart.length <= 2 ? `${namePart[0]}***` : `${namePart[0]}***${namePart[namePart.length - 1]}`;
      return `${maskedName}@${domain}`;
    }
  }

  // Phone masking: ******1234
  if (lowerKey === 'phone' || lowerKey === 'mobile' || /^\+?[0-9]{10,12}$/.test(val)) {
    const clean = val.replace(/\D/g, '');
    if (clean.length >= 10) {
      return `******${clean.slice(-4)}`;
    }
  }

  return val;
}

function redactObject(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      redacted[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value, depth + 1);
    } else if (typeof value === 'string') {
      redacted[key] = maskStringValue(key, value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const safeMeta = redactObject(meta);
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message: typeof message === 'object' ? redactObject(message) : message,
    ...(Object.keys(safeMeta).length > 0 ? { meta: safeMeta } : {}),
  };

  return JSON.stringify(logEntry);
}

const logger = {
  info: (message, meta) => {
    console.log(formatMessage('info', message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatMessage('warn', message, meta));
  },
  error: (message, meta) => {
    console.error(formatMessage('error', message, meta));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
      console.log(formatMessage('debug', message, meta));
    }
  },
  redact: redactObject,
};

module.exports = logger;
