const express = require('express');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');
const controller = require('../controllers/hospital-matching.controller');

const router = express.Router();

// Strictly requires Admin Authentication & Authorization
router.use(auth, denyGuest, authorize('ADMIN'));

router.get('/stats', controller.getStats);
router.get('/candidates', controller.getCandidates);
router.get('/candidates/:id', controller.getMatchById);
router.post('/candidates/generate', controller.generateCandidates);
router.post('/candidates/:id/approve', controller.approveMatch);
router.post('/candidates/:id/reject', controller.rejectMatch);
router.post('/candidates/:id/unmatch', controller.unmatch);

module.exports = router;
