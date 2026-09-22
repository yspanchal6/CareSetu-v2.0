const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    let token = null;

    // 1. Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    // 2. Fallback: x-auth-token header
    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    // 3. Fallback: cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Read JWT_SECRET at call-time (NOT cached at module load)
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();

  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired authentication token',
      code: err.name || 'UNAUTHORIZED'
    });
  }
};

// Middleware: require specific role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Insufficient permissions. Access restricted.` });
    }
    next();
  };
};

// Middleware: require self or admin (IDOR protection)
const requireSelfOrAdmin = (paramKey = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const targetUserId = req.params[paramKey] || req.body[paramKey] || req.query[paramKey];
    if (req.user.role === 'ADMIN') {
      return next();
    }
    if (targetUserId && targetUserId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied. You can only access your own account resources.' });
    }
    next();
  };
};

const { denyGuest } = require('./guest-access.middleware');

module.exports = {
  auth: authMiddleware,
  authMiddleware,
  authorize: requireRole,
  requireRole,
  requireSelfOrAdmin,
  denyGuest,
};
