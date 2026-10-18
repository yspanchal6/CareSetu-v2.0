const express = require('express');
const { auth, authorize, denyGuest, requireApprovedClinic } = require('../middleware/auth.middleware');
const clinicController = require('../controllers/clinic.controller');

const router = express.Router();

// Base authentication & authorization for CLINIC role
router.use(auth, denyGuest, authorize('CLINIC'));

// Verification status endpoint does not require prior approval
router.get('/verification-status', clinicController.getClinicVerificationStatus);

// All operational clinic routes below require an approved clinic profile
router.use(requireApprovedClinic);

router.get('/profile', clinicController.getClinicProfile);
router.put('/profile', clinicController.updateClinicProfile);
router.get('/staff', clinicController.getClinicStaff);
router.get('/appointments', clinicController.getClinicAppointments);

module.exports = router;
