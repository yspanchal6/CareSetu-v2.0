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
} = require('../controllers/hospital.controller');

const router = express.Router();

// Public / Patient view endpoints
router.get('/', getAllHospitals);
router.get('/nearest', findNearbyHospitals);
router.get('/nearby', findNearbyHospitals);
router.get('/details/:id', getHospitalById);
router.get('/:id', getHospitalById);

// Apply auth & denyGuest to all operational hospital routes
router.use(auth, denyGuest);

// Hospital operational routes (Requires HOSPITAL role)
router.get('/cases', auth, authorize('HOSPITAL'), getHospitalCases);
router.get('/stats', auth, authorize('HOSPITAL'), getHospitalStats);
router.get('/capacity', auth, authorize('HOSPITAL'), getHospitalCapacity);
router.put('/capacity', auth, authorize('HOSPITAL'), updateHospitalCapacity);
router.get('/patients', auth, authorize('HOSPITAL'), getHospitalPatients);
router.get('/notifications', auth, authorize('HOSPITAL'), getHospitalNotifications);
router.put('/notifications/:id/read', auth, authorize('HOSPITAL'), markNotificationRead);
router.get('/reports', auth, authorize('HOSPITAL'), getHospitalReports);
router.get('/profile', auth, authorize('HOSPITAL'), getHospitalProfile);
router.put('/profile', auth, authorize('HOSPITAL'), updateHospitalProfile);
router.post('/submit-onboarding', auth, authorize('HOSPITAL'), submitHospitalOnboarding);
router.get('/staff', auth, authorize('HOSPITAL'), getHospitalStaff);
router.get('/settings', auth, authorize('HOSPITAL'), getHospitalSettings);
router.put('/settings', auth, authorize('HOSPITAL'), updateHospitalSettings);
router.get('/diagnostics', auth, authorize('HOSPITAL', 'ADMIN'), getHospitalDiagnostics);
router.get('/approval-event', auth, authorize('HOSPITAL'), getUnseenApprovalEvent);
router.post('/approval-event/consume', auth, authorize('HOSPITAL'), consumeApprovalEvent);

// Accept a case (Requires HOSPITAL role)
router.post('/:caseId/accept', auth, authorize('HOSPITAL'), acceptCase);
router.post('/cases/:caseId/accept', auth, authorize('HOSPITAL'), acceptCase);

module.exports = router;
