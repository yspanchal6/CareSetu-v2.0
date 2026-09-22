/**
 * guest-access.middleware.js
 * Enforces guest feature restrictions on protected backend endpoints.
 */

const denyGuest = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.isGuest || req.user.role === 'GUEST') {
    return res.status(403).json({
      error: 'This feature requires a registered account. Please log in or create an account.',
      isGuestRestricted: true,
      code: 'GUEST_RESTRICTED',
    });
  }

  next();
};

module.exports = {
  denyGuest,
};
