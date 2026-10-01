const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const UrlTokenService = require('../services/urlToken.service');

/**
 * CareSetu URL Tokenization & Secure Link API Routes
 */

/**
 * @route   POST /api/share-tokens/create
 * @desc    Create an opaque public share token for a resource
 * @access  Private (Authenticated Patients, Hospitals, Doctors, Admins)
 */
router.post('/create', auth, async (req, res, next) => {
  try {
    const {
      resourceType,
      resourceId,
      allowedAction,
      expiresInHours,
      isOneTime,
      maxUses,
    } = req.body;

    const result = await UrlTokenService.createShareToken({
      resourceType,
      resourceId,
      allowedAction,
      expiresInHours: expiresInHours || 24,
      isOneTime,
      maxUses,
      createdByUserId: req.user?.id || req.user?.userId || null,
    });

    return res.status(201).json({
      success: true,
      message: 'Share token created successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/share-tokens/validate/:token
 * @desc    Validate opaque share token format & SHA-256 database lookup
 * @access  Public / Authenticated
 */
router.get('/validate/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { resourceType, action } = req.query;

    const validation = await UrlTokenService.validateToken(token, resourceType, action);

    return res.status(200).json({
      success: true,
      valid: true,
      data: validation.tokenRecord,
    });
  } catch (err) {
    return res.status(err.status || 400).json({
      success: false,
      valid: false,
      error: err.message,
    });
  }
});

/**
 * @route   POST /api/share-tokens/consume/:token
 * @desc    Atomically consume a token (useful for one-time links)
 * @access  Public / Authenticated
 */
router.post('/consume/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { resourceType, action } = req.body;

    const result = await UrlTokenService.consumeToken(token, resourceType, action);

    return res.status(200).json({
      success: true,
      message: 'Token consumed successfully.',
      data: result.tokenRecord,
    });
  } catch (err) {
    return res.status(err.status || 410).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * @route   DELETE /api/share-tokens/:id
 * @desc    Revoke an active share token
 * @access  Private (Token Creator or Admin)
 */
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const isAdmin = req.user?.role === 'ADMIN';

    const result = await UrlTokenService.revokeToken(id, userId, isAdmin);

    return res.status(200).json({
      success: true,
      message: 'Token revoked successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/share-tokens/encrypt
 * @desc    Encrypt a URL payload using AES-256-GCM
 * @access  Private (Authenticated Users)
 */
router.post('/encrypt', auth, async (req, res, next) => {
  try {
    const { payload } = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload object is required.' });
    }

    const encryptedToken = UrlTokenService.createEncryptedPayload(payload);

    return res.status(200).json({
      success: true,
      encryptedToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/share-tokens/decrypt
 * @desc    Decrypt and verify an AES-256-GCM token string
 * @access  Private (Authenticated Users)
 */
router.post('/decrypt', auth, async (req, res, next) => {
  try {
    const { encryptedToken } = req.body;
    if (!encryptedToken || typeof encryptedToken !== 'string') {
      return res.status(400).json({ error: 'encryptedToken string is required.' });
    }

    const payload = UrlTokenService.decryptEncryptedPayload(encryptedToken);

    return res.status(200).json({
      success: true,
      payload,
    });
  } catch (err) {
    return res.status(err.status || 403).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
