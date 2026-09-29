const hospitalSecurityService = require('../services/hospital-security.service');

/**
 * Create a server-backed Secure View Session.
 * POST /api/security/view-session
 */
async function createViewSession(req, res, next) {
  try {
    const hospitalUserId = req.user.userId || req.user.id;
    const { caseId, documentId, healthPackId } = req.body;

    const result = await hospitalSecurityService.createSecureViewSession({
      hospitalUserId,
      caseId,
      documentId,
      healthPackId
    });

    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Register a confirmed capture violation event.
 * POST /api/security/capture-violation
 */
async function handleCaptureViolation(req, res, next) {
  try {
    const hospitalUserId = req.user.userId || req.user.id;
    const {
      eventType,
      captureType,
      platform,
      caseId,
      documentId,
      protectedResourceId,
      healthPackId,
      secureViewerSessionId,
      securityEpoch,
      captureEventId,
      metadata
    } = req.body;

    const result = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId,
      eventType: eventType || captureType || 'SCREENSHOT_ATTEMPT',
      platform: platform || 'WEB',
      caseId,
      documentId: documentId || protectedResourceId,
      healthPackId,
      secureViewerSessionId,
      securityEpoch,
      clientGeneratedEventId: captureEventId || metadata?.clientGeneratedEventId || metadata?.captureEventId,
      metadata
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        error: err.message,
        code: err.code || 'SECURITY_EVENT_ERROR',
        status: err.code || 'ERROR',
        currentViolationCount: err.currentViolationCount,
        securityEpoch: err.securityEpoch
      });
    }
    next(err);
  }
}

/**
 * Get current hospital security status and appeal history.
 * GET /api/security/hospital-status
 */
async function getHospitalStatus(req, res, next) {
  try {
    const userId = req.user.userId || req.user.id;
    const { hospitalId } = req.query;

    const status = await hospitalSecurityService.getHospitalSecurityStatus({
      userId,
      hospitalId
    });

    return res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

/**
 * Submit appeal for a blocked hospital portal.
 * POST /api/security/appeal
 */
async function submitAppeal(req, res, next) {
  try {
    const hospitalUserId = req.user.userId || req.user.id;
    const { reason, description, caseId } = req.body;

    const appeal = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId,
      reason,
      description,
      caseId
    });

    return res.status(201).json({
      message: 'Your review request has been submitted to CareSetu Administration.',
      appeal
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Get capture violations & appeals list.
 * GET /api/security/admin/violations
 */
async function getAdminViolations(req, res, next) {
  try {
    const {
      status,
      search,
      hospitalId,
      userId,
      eventType,
      attemptNumber,
      result,
      platform,
      dateFrom,
      dateTo,
      securityEpoch,
      caseId,
      reviewStatus,
      emailStatus,
      sortBy,
      page,
      pageSize
    } = req.query;

    // Date range validation
    if (dateFrom && isNaN(Date.parse(dateFrom))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateFrom format. Use YYYY-MM-DD or ISO 8601 timestamp.'
      });
    }
    if (dateTo && isNaN(Date.parse(dateTo))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid dateTo format. Use YYYY-MM-DD or ISO 8601 timestamp.'
      });
    }
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range: dateFrom cannot be after dateTo.'
      });
    }

    const data = await hospitalSecurityService.getAdminViolationsAndAppeals({
      status,
      search,
      hospitalId,
      userId,
      eventType,
      attemptNumber,
      result,
      platform,
      dateFrom,
      dateTo,
      securityEpoch,
      caseId,
      reviewStatus,
      emailStatus,
      sortBy,
      page,
      pageSize
    });

    return res.status(200).json(data);
  } catch (err) {
    const adminUserId = req.user?.userId || req.user?.id || 'UNKNOWN';
    console.error('[SECURITY_LOGS_API_ERROR]', {
      requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      adminUserId,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack
    });

    return res.status(500).json({
      success: false,
      error: 'An error occurred while fetching security event logs.'
    });
  }
}

/**
 * Admin: Unlock a hospital portal.
 * POST /api/security/admin/unlock-hospital
 */
async function unlockHospital(req, res, next) {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { hospitalId, decision, adminNotes } = req.body;

    const result = await hospitalSecurityService.unlockHospital({
      adminUserId,
      hospitalId,
      decision,
      adminNotes
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Keep a hospital blocked (reject appeal).
 * POST /api/security/admin/keep-blocked
 */
async function keepBlocked(req, res, next) {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const { hospitalId, appealId, adminNotes } = req.body;

    const result = await hospitalSecurityService.keepBlockedHospital({
      adminUserId,
      hospitalId,
      appealId,
      adminNotes
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createViewSession,
  handleCaptureViolation,
  getHospitalStatus,
  submitAppeal,
  getAdminViolations,
  unlockHospital,
  keepBlocked
};
