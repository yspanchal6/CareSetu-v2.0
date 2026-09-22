const rateLimit = require('express-rate-limit');
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
 * Key generator combining IP address, authenticated User ID, or target account email
 */
const rateLimitKeyGenerator = (req) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const targetId = req.user?.userId || req.user?.id || req.body?.email || req.body?.username || 'anonymous';
  return `${clientIp}:${targetId}`;
};

/**
 * Handler for HTTP 429 rate limit exceeded
 */
const rateLimitHandler = (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  res.setHeader('Retry-After', retryAfterSeconds);
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.originalUrl,
    userId: req.user?.userId || req.body?.email,
  });
  return res.status(429).json({
    success: false,
    error: options.message?.error || 'Too many requests. Please wait before trying again.',
    code: 'TOO_MANY_REQUESTS',
    retryAfterSeconds,
  });
};

/**
 * General API Limiter (100 requests per 15 minutes)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
  message: { error: 'Too many requests to CareSetu API. Please try again later.' },
});

/**
 * Login Rate Limiter (5 requests per 15 minutes per account/IP)
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
});

/**
 * Register Rate Limiter (50 requests per hour)
 */
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
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
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
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
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
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
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
  message: { error: 'Maximum verification attempts exceeded. Please request a new code.' },
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
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
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
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
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
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
  message: { error: 'AI Assistant rate limit reached. Please wait a few minutes before asking more questions.' },
});

/**
 * Admin Action Limiter (30 requests per 15 minutes)
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  validate: false,
  keyGenerator: rateLimitKeyGenerator,
  handler: rateLimitHandler,
  message: { error: 'Admin endpoint request limit reached.' },
});

module.exports = {
  apiLimiter,
  authLimiter: loginRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  otpEmailLimiter,
  otpSmsLimiter,
  otpVerifyLimiter,
  otpRateLimiter: otpVerifyLimiter,
  docUploadLimiter,

  docDownloadLimiter,
  aiChatLimiter,
  adminLimiter,
  passwordChangeRateLimiter: loginRateLimiter,
};
