const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const govHealthDataController = require('../controllers/gov-health-data.controller');

const router = express.Router();

// Requires Admin Authentication
router.use(auth, denyGuest, authorize('ADMIN'));

router.get('/summary', govHealthDataController.getGovHealthDataSummary);
router.post('/sync', govHealthDataController.syncGovHealthData);
router.get('/records', govHealthDataController.getGovHealthRecords);

module.exports = router;
