const helmet = require('helmet');
const crypto = require('crypto');

/**
 * Enterprise Security Headers & Request Correlation ID Middleware
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://*.firebaseapp.com", "https://*.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com', 'https://*.gstatic.com'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'https://*.trycloudflare.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://*.firebaseio.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"],
      frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

function correlationIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

module.exports = {
  helmetConfig,
  correlationIdMiddleware,
};
