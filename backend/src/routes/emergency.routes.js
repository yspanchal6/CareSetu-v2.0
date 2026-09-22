const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  createSOS,
  getSOSStatus,
  getAttempts,
  cancelSOS,
  getMyEmergencies,
  getPendingEmergencies,
  acceptEmergency,
  rejectEmergency,
  updateEmergencyStatus
} = require('../controllers/emergency.controller');
const { auth, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Dedicated SOS limiter — keeps the SOS path frictionless for real emergencies
// while preventing automated abuse/prank floods. Keyed per authenticated user
// (PWA-safe for shared IPs). Idempotency + audit still apply.
const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.socket.remoteAddress || 'unknown',
  message: { success: false, error: 'Too many SOS requests. Please try again in a moment.' },
});

// Patient & Guest Emergency routes
router.post('/sos', auth, authorize('PATIENT', 'GUEST'), sosLimiter, createSOS);
router.get('/status/:caseId', auth, authorize('PATIENT', 'HOSPITAL', 'ADMIN', 'GUEST'), getSOSStatus);
router.get('/attempts/:caseId', auth, authorize('PATIENT', 'HOSPITAL', 'ADMIN', 'GUEST'), getAttempts);
router.post('/cancel/:caseId', auth, authorize('PATIENT', 'GUEST'), cancelSOS);
router.put('/cancel/:caseId', auth, authorize('PATIENT', 'GUEST'), cancelSOS);
router.get('/my-history', auth, authorize('PATIENT'), getMyEmergencies);

// Hospital routes
router.get('/pending', auth, authorize('HOSPITAL'), getPendingEmergencies);
router.post('/accept/:caseId', auth, authorize('HOSPITAL'), acceptEmergency);
router.post('/reject/:caseId', auth, authorize('HOSPITAL'), rejectEmergency);
router.put('/update-status/:caseId', auth, authorize('HOSPITAL', 'ADMIN'), updateEmergencyStatus);

module.exports = router;
