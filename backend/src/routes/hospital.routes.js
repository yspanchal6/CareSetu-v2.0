const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const {
  getAllHospitals,
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
  getHospitalStaff,
  getHospitalSettings,
  updateHospitalSettings,
} = require('../controllers/hospital.controller');

const router = express.Router();

// Get all hospitals (Public / Patient view)
router.get('/', getAllHospitals);

// Apply auth & denyGuest to all operational hospital routes
router.use(auth, denyGuest);

// Get nearest hospitals
router.get('/nearest', findNearbyHospitals);

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
router.get('/staff', auth, authorize('HOSPITAL'), getHospitalStaff);
router.get('/settings', auth, authorize('HOSPITAL'), getHospitalSettings);
router.put('/settings', auth, authorize('HOSPITAL'), updateHospitalSettings);

// Accept a case (Requires HOSPITAL role)
router.post('/:caseId/accept', auth, authorize('HOSPITAL'), acceptCase);

module.exports = router;
