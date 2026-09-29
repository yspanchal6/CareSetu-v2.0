const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const {
  getAllHospitals,
  getHospitalById,
  findNearbyHospitals,
  acceptCase,
  getHospitalCases,
  getHospitalStats,
  getHospitalCapacity,
  updateHospitalCapacity,
  getHospitalPatients,
  getHospitalNotifications,
  markNotificationRead,
  getHospitalReports,
  getHospitalProfile,
  updateHospitalProfile,
  submitHospitalOnboarding,
  getHospitalStaff,
  getHospitalSettings,
  updateHospitalSettings,
  getHospitalDiagnostics,
  getUnseenApprovalEvent,
  consumeApprovalEvent,
  getDirectory,
  getDirectoryFilters,
  getDirectoryItemById,
} = require('../controllers/hospital.controller');

const router = express.Router();

// Public / Patient view endpoints
router.get('/directory', getDirectory);
router.get('/directory/filters', getDirectoryFilters);
router.get('/directory/:id', getDirectoryItemById);
router.get('/', getAllHospitals);
router.get('/nearest', findNearbyHospitals);
router.get('/nearby', findNearbyHospitals);
router.get('/details/:id', getHospitalById);

// Hospital operational routes (Protected: Requires auth, denyGuest, and appropriate role)
router.get('/cases', auth, denyGuest, authorize('HOSPITAL'), getHospitalCases);
router.get('/stats', auth, denyGuest, authorize('HOSPITAL'), getHospitalStats);
router.get('/capacity', auth, denyGuest, authorize('HOSPITAL'), getHospitalCapacity);
router.put('/capacity', auth, denyGuest, authorize('HOSPITAL'), updateHospitalCapacity);
router.get('/patients', auth, denyGuest, authorize('HOSPITAL'), getHospitalPatients);
router.get('/notifications', auth, denyGuest, authorize('HOSPITAL'), getHospitalNotifications);
router.put('/notifications/:id/read', auth, denyGuest, authorize('HOSPITAL'), markNotificationRead);
router.get('/reports', auth, denyGuest, authorize('HOSPITAL'), getHospitalReports);
router.get('/profile', auth, denyGuest, authorize('HOSPITAL'), getHospitalProfile);
router.put('/profile', auth, denyGuest, authorize('HOSPITAL'), updateHospitalProfile);
router.post('/submit-onboarding', auth, denyGuest, authorize('HOSPITAL'), submitHospitalOnboarding);
router.get('/staff', auth, denyGuest, authorize('HOSPITAL'), getHospitalStaff);
router.get('/settings', auth, denyGuest, authorize('HOSPITAL'), getHospitalSettings);
router.put('/settings', auth, denyGuest, authorize('HOSPITAL'), updateHospitalSettings);
router.get('/diagnostics', auth, denyGuest, authorize('HOSPITAL', 'ADMIN'), getHospitalDiagnostics);
router.get('/approval-event', auth, denyGuest, authorize('HOSPITAL'), getUnseenApprovalEvent);
router.post('/approval-event/consume', auth, denyGuest, authorize('HOSPITAL'), consumeApprovalEvent);

// Accept a case (Requires HOSPITAL role)
router.post('/:caseId/accept', auth, denyGuest, authorize('HOSPITAL'), acceptCase);
router.post('/cases/:caseId/accept', auth, denyGuest, authorize('HOSPITAL'), acceptCase);

// Public / Patient view hospital by ID route (must be AFTER static endpoints like /stats, /profile, /approval-event)
router.get('/:id', getHospitalById);

module.exports = router;
