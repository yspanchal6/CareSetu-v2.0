const express = require('express');
const router = express.Router();
const { auth, authorize, denyGuest, requireApprovedIndependentDoctor } = require('../middleware/auth.middleware');
const {
  getDoctorDashboard,
  getIndependentDoctorDashboard,
  getDoctorProfile,
  updateDoctorProfile,
  getDoctorCases,
  getDoctorCaseById,
  updateDoctorCaseStatus,
  getDoctorCaseHealthPack,
  getDoctorVerificationStatus,
  submitDoctorDiagnosis,
  getDoctorDiagnosis,
  addDoctorTreatmentNote,
} = require('../controllers/doctor.controller');

router.use(auth, denyGuest);

// Doctor profile and verification status routes
router.get('/profile', authorize('DOCTOR'), getDoctorProfile);
router.put('/profile', authorize('DOCTOR'), updateDoctorProfile);
router.get('/independent/verification-status', authorize('DOCTOR'), getDoctorVerificationStatus);
router.get('/verification-status', authorize('DOCTOR'), getDoctorVerificationStatus);
router.get('/independent/dashboard', authorize('DOCTOR', 'ADMIN'), requireApprovedIndependentDoctor, getIndependentDoctorDashboard);

// Doctor Dashboard statistics and assigned case routes
router.get('/dashboard', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), getDoctorDashboard);
router.get('/cases', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), getDoctorCases);
router.get('/cases/:id', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), getDoctorCaseById);
router.put('/cases/:id/status', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), updateDoctorCaseStatus);
router.post('/cases/:id/status', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), updateDoctorCaseStatus);
router.get('/cases/:id/health-pack', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), getDoctorCaseHealthPack);

// Diagnosis submission and treatment notes routes
router.post('/cases/:id/diagnosis', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), submitDoctorDiagnosis);
router.get('/cases/:id/diagnosis', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), getDoctorDiagnosis);
router.post('/cases/:id/treatment-notes', authorize('DOCTOR', 'HOSPITAL', 'ADMIN'), addDoctorTreatmentNote);

module.exports = router;
