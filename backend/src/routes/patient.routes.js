const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const patientController = require('../controllers/patient.controller');

const router = express.Router();

router.use(auth, denyGuest, authorize('PATIENT'));
router.get('/profile', patientController.getProfile);
router.put('/profile', patientController.updateProfile);

module.exports = router;