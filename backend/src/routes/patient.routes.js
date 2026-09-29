const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const patientController = require('../controllers/patient.controller');

const router = express.Router();

router.get('/profile', auth, denyGuest, authorize('PATIENT'), patientController.getProfile);
router.put('/profile', auth, denyGuest, authorize('PATIENT'), patientController.updateProfile);

module.exports = router;