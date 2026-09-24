const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Optional Redis store integration for load-balanced distributed deployments
let redisStore = undefined;
if (process.env.REDIS_URL && process.env.NODE_ENV !== 'test') {
  try {
    const { RedisStore } = require('rate-limit-redis');
    const { createClient } = require('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.connect().catch((err) => logger.error('Redis RateLimiter Client Error', { error: err.message }));
    redisStore = new RedisStore({
      sendCommand: (...args) => client.sendCommand(args),
    });
    logger.info('Shared Redis Rate Limiter Store initialized successfully.');
  } catch (err) {
    logger.warn('Redis Store package or connection unavailable. Falling back to MemoryStore.', { error: err.message });
  }
}

/**
 * Creates a rate limit key generator scoped by category, client IP, and authenticated user ID.
 */
const createRateLimitKeyGenerator = (category = 'general') => (req) => {
  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const targetId = req.user?.userId || req.user?.id || req.body?.email || req.body?.username || 'anonymous';
  return `${category}:${clientIp}:${targetId}`;
};

/**
 * Creates a safe, non-sensitive rate limit handler that logs diagnostics and sets Retry-After.
 */
const createRateLimitHandler = (category = 'general') => (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  res.setHeader('Retry-After', retryAfterSeconds);

  // Safe SHA-256 user hash (never log actual email, tokens, passwords, or medical data)
  const rawUserId = req.user?.userId || req.user?.id || req.body?.email;
  const userHash = rawUserId
    ? crypto.createHash('sha256').update(String(rawUserId)).digest('hex').slice(0, 10)
    : 'anonymous';

  logger.warn('[RateLimitExceeded]', {
    category,
    endpoint: req.originalUrl || req.path,
    method: req.method,
    userHash,
    role: req.user?.role || 'UNAUTHENTICATED',
    ip: req.ip,
    retryAfterSeconds,
    correlationId: req.correlationId || req.headers?.['x-correlation-id'] || 'n/a',
  });

  return res.status(429).json({
    success: false,
    error: options.message?.error || 'Too many requests. Please wait before trying again.',
    code: 'TOO_MANY_REQUESTS',
    retryAfterSeconds,
    category,
  });
};

/**
 * General API Limiter (300 requests per 15 minutes)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('api'),
  handler: createRateLimitHandler('api'),
  message: { error: 'Too many API requests. Please wait a few minutes before trying again.' },
});

/**
 * Read-Only Dashboard Limiter (300 requests per 15 minutes)
 */
const dashboardReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('dashboard_read'),
  handler: createRateLimitHandler('dashboard_read'),
  message: { error: 'Dashboard request limit reached. Please wait before refreshing.' },
});

/**
 * Authentication Limiter (15 requests per 15 minutes per account/IP)
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('auth'),
  handler: createRateLimitHandler('auth'),
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
});

/**
 * Register Rate Limiter (50 requests per hour)
 */
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 50,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('register'),
  handler: createRateLimitHandler('register'),
  message: { error: 'Too many registration requests. Please try again later.' },
});

/**
 * Email OTP Request Limiter (5 requests per 15 minutes)
 */
const otpEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('otp_email'),
  handler: createRateLimitHandler('otp_email'),
  message: { error: 'Too many Email OTP requests. Please wait 15 minutes before requesting a new code.' },
});

/**
 * SMS OTP Request Limiter (5 requests per 15 minutes)
 */
const otpSmsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('otp_sms'),
  handler: createRateLimitHandler('otp_sms'),
  message: { error: 'Too many SMS OTP requests. Please wait 15 minutes before requesting a new code.' },
});

/**
 * OTP Verification Limiter (5 attempts per 15 minutes)
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('otp_verify'),
  handler: createRateLimitHandler('otp_verify'),
  message: { error: 'Maximum verification attempts exceeded. Please request a new code.' },
});

/**
 * Sensitive Write Limiter (30 requests per 15 minutes)
 */
const sensitiveWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('sensitive_write'),
  handler: createRateLimitHandler('sensitive_write'),
  message: { error: 'Action rate limit reached. Please wait a few minutes before trying again.' },
});

/**
 * Document Upload Limiter (10 uploads per hour)
 */
const docUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 10,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('doc_upload'),
  handler: createRateLimitHandler('doc_upload'),
  message: { error: 'Document upload limit reached for this hour.' },
});

/**
 * Document Download / View Limiter (60 downloads per hour)
 */
const docDownloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 60,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('doc_download'),
  handler: createRateLimitHandler('doc_download'),
  message: { error: 'Too many document download requests. Please try again later.' },
});

/**
 * AI Chatbot Request Limiter (30 requests per 15 minutes)
 */
const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('ai_chat'),
  handler: createRateLimitHandler('ai_chat'),
  message: { error: 'AI Assistant rate limit reached. Please wait a few minutes before asking more questions.' },
});

/**
 * Admin Action Limiter (60 requests per 15 minutes)
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 60,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: createRateLimitKeyGenerator('admin'),
  handler: createRateLimitHandler('admin'),
  message: { error: 'Admin endpoint request limit reached.' },
});

module.exports = {
  createRateLimitHandler,
  createRateLimitKeyGenerator,
  apiLimiter,
  dashboardReadLimiter,
  authLimiter: loginRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  otpEmailLimiter,
  otpSmsLimiter,
  otpVerifyLimiter,
  otpRateLimiter: otpVerifyLimiter,
  sensitiveWriteLimiter,
  docUploadLimiter,
  docDownloadLimiter,
  aiChatLimiter,
  adminLimiter,
  passwordChangeRateLimiter: loginRateLimiter,
};
