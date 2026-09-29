const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const controller = require('../controllers/account-deletion.controller');

const router = express.Router();

// User endpoints (requires authentication, guests denied)
router.post('/request', auth, denyGuest, controller.submitDeletionRequest);
router.get('/my-request', auth, denyGuest, controller.getMyDeletionRequest);

// Admin endpoints (strictly requires ADMIN role)
router.get('/admin/requests', auth, denyGuest, authorize('ADMIN'), controller.getAdminDeletionRequests);
router.post('/admin/requests/:id/approve', auth, denyGuest, authorize('ADMIN'), controller.approveDeletionRequest);
router.post('/admin/requests/:id/reject', auth, denyGuest, authorize('ADMIN'), controller.rejectDeletionRequest);

module.exports = router;
