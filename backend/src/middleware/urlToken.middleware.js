const UrlTokenService = require('../services/urlToken.service');

/**
 * CareSetu URL Token Validation & Consumption Middleware
 */

/**
 * Middleware: Validates token in query parameter (?token=...), header (x-share-token), or req.params.token
 */
const validateUrlToken = ({ resourceType = null, action = null } = {}) => {
  return async (req, res, next) => {
    try {
      const rawToken = req.query.token || req.headers['x-share-token'] || req.params.token || req.body.token;

      if (!rawToken) {
        return res.status(400).json({ error: 'Missing share token parameter.' });
      }

      const { tokenRecord } = await UrlTokenService.validateToken(rawToken, resourceType, action);
      req.shareToken = tokenRecord;
      next();
    } catch (err) {
      return res.status(err.status || 401).json({
        error: err.message || 'Token validation failed.',
      });
    }
  };
};

/**
 * Middleware: Atomically consumes a one-time or multi-use token
 */
const consumeUrlToken = ({ resourceType = null, action = null } = {}) => {
  return async (req, res, next) => {
    try {
      const rawToken = req.query.token || req.headers['x-share-token'] || req.params.token || req.body.token;

      if (!rawToken) {
        return res.status(400).json({ error: 'Missing share token parameter.' });
      }

      const { tokenRecord } = await UrlTokenService.consumeToken(rawToken, resourceType, action);
      req.consumedShareToken = tokenRecord;
      next();
    } catch (err) {
      return res.status(err.status || 410).json({
        error: err.message || 'Token consumption failed.',
      });
    }
  };
};

module.exports = {
  validateUrlToken,
  consumeUrlToken,
};
