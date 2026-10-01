const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const OpaqueRouteService = require('../services/opaqueRoute.service');

/**
 * @route   POST /api/opaque-routes/create
 * @desc    Create an opaque route alias for a protected path
 * @access  Private (Authenticated Users)
 */
router.post('/create', auth, async (req, res, next) => {
  try {
    const { targetPath, expiresInHours } = req.body;
    const userId = req.user?.id || req.user?.userId;
    const role = req.user?.role;

    const result = await OpaqueRouteService.createOpaqueRoute({
      targetPath,
      userId,
      role,
      expiresInHours: expiresInHours || 48,
    });

    return res.status(201).json({
      success: true,
      message: 'Opaque route created successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/opaque-routes/resolve/:opaqueId
 * @desc    Resolve an opaque route ID back to the target destination path
 * @access  Public / Authenticated
 */
router.get('/resolve/:opaqueId', async (req, res, next) => {
  try {
    const { opaqueId } = req.params;
    const result = await OpaqueRouteService.resolveOpaqueRoute(opaqueId, req.user || null);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return res.status(err.status || 404).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
