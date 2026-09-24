const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

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
    if (req.user && !req.user.userId && req.user.id) {
      req.user.userId = req.user.id;
    }
    if (req.path === '/sos' && req.baseUrl === '/api/emergency') {
      console.info('[API Auth Diagnostic]', {
        userId: req.user.userId || req.user.id || null,
        role: req.user.role || null,
        requestPath: req.originalUrl,
        hasAuthorizationHeader: Boolean(authHeader || req.headers['x-auth-token'] || req.cookies?.token),
      });
    }
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
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const allowedRoles = roles.map(r => String(r).toUpperCase());
    const tokenRole = String(req.user.role || '').toUpperCase();
    const userId = req.user.userId || req.user.id || req.user.sub;
    const isGuestSession = Boolean(req.user.isGuest || req.user.isGuestSession || tokenRole === 'GUEST');

    let userRole = tokenRole;
    if (userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      });
      if (!dbUser) {
        return res.status(401).json({ error: 'Authenticated user no longer exists.' });
      }
      if (dbUser.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Account is not active.' });
      }
      if (isGuestSession && (allowedRoles.includes('GUEST') || allowedRoles.includes('PATIENT'))) {
        req.user.role = 'GUEST';
        return next();
      }
      userRole = String(dbUser.role || '').toUpperCase();
      req.user.role = userRole;
    }

    if (allowedRoles.length && !allowedRoles.includes(userRole)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Auth] 🛑 Permission denied in requireRole:', {
          userId,
          tokenRole,
          userRole,
          allowedRoles,
          hasUserId: Boolean(req.user.userId || req.user.id),
        });
      }
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
    const userRole = String(req.user.role || '').toUpperCase();
    const currentUserId = req.user.userId || req.user.id || req.user.sub;
    if (userRole === 'ADMIN') {
      return next();
    }
    if (targetUserId && targetUserId !== currentUserId) {
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

