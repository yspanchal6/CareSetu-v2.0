const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { auth, requireRole } = require('../middleware/auth.middleware');
const controller = require('../controllers/hospital-security.controller');

/**
 * Permissive Auth Middleware for Security Status, Appeals & View Sessions.
 * Allows blocked users to inspect their status, submit appeals, and receive structured security responses.
 */
function permissiveAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    }
    if (!token && req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    if (req.user && !req.user.userId && req.user.id) {
      req.user.userId = req.user.id;
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

// 1. Create Server-Backed Secure Viewing Session (HOSPITAL users)
router.post('/view-session', permissiveAuth, controller.createViewSession);

// 2. Report Capture Violation (Permissive Auth - structured response even if blocked)
router.post('/capture-violation', permissiveAuth, controller.handleCaptureViolation);

// 3. Get Hospital Security Status & Appeals (Permissive Auth - allows blocked hospital to read status)
router.get('/hospital-status', permissiveAuth, controller.getHospitalStatus);
router.get('/security-status', permissiveAuth, controller.getHospitalStatus);
router.get('/my-appeal', permissiveAuth, controller.getHospitalStatus);
router.get('/my-review-status', permissiveAuth, controller.getHospitalStatus);

// 4. Submit Security Appeal (Permissive Auth - allows blocked hospital to submit appeal)
router.post('/appeal', permissiveAuth, controller.submitAppeal);
router.post('/hospital-appeals', permissiveAuth, controller.submitAppeal);

// 5. Admin: View Capture Violations & Appeals List
router.get('/admin/violations', auth, requireRole('ADMIN'), controller.getAdminViolations);

// 6. Admin: Unlock Hospital & Restore Portal Access
router.post('/admin/unlock-hospital', auth, requireRole('ADMIN'), controller.unlockHospital);

// 7. Admin: Keep Hospital Blocked & Reject Appeal
router.post('/admin/keep-blocked', auth, requireRole('ADMIN'), controller.keepBlocked);

module.exports = router;
