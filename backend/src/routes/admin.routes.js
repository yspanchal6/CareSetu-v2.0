const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const controller = require('../controllers/admin.controller');
const blocklistController = require('../controllers/admin-blocklist.controller');
const deletionController = require('../controllers/account-deletion.controller');

const router = express.Router();

// All admin routes strictly require authentication and ADMIN role (guests DENIED)
router.use(auth, denyGuest, authorize('ADMIN'));

router.get('/dashboard/stats', controller.getDashboardStats);
router.get('/analytics', controller.getAnalytics);
router.get('/users', blocklistController.getUsers);
router.get('/hospitals', blocklistController.getHospitals);
router.get('/patients', blocklistController.getPatients);
router.get('/emergencies', controller.getAllEmergencies);

router.get('/hospitals/verification-requests', controller.getHospitalVerificationRequests);
router.post('/hospitals/register', controller.registerHospital);
router.post('/hospitals/:id/approve', controller.approveHospital);
router.post('/hospitals/:id/reject', controller.rejectHospital);

// Account Deletion Requests
router.get('/account-deletion-requests', deletionController.getAdminDeletionRequests);
router.post('/account-deletion-requests/:id/approve', deletionController.approveDeletionRequest);
router.post('/account-deletion-requests/:id/reject', deletionController.rejectDeletionRequest);

// Blocklist & Security Management
router.post('/blocklist', blocklistController.blockAccount);
router.post('/blocklist/block', blocklistController.blockAccount);
router.post('/blocklist/unblock', blocklistController.unblockAccount);
router.post('/unblock', blocklistController.unblockAccount);
router.get('/blocklist/history', blocklistController.getBlocklistHistory);
router.get('/audit-logs', blocklistController.getAuditLogs);
router.get('/system/brevo-health', controller.getBrevoHealth);
router.post('/users/:userId/change-role', controller.changeUserRole);

module.exports = router;
