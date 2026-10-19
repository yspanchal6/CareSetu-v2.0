const express = require('express');
const {
  createHealthPack,
  getMyHealthPack,
  getCaseHealthPack,
  getSharedHealthPack,
  shareHealthPack,
} = require('../controllers/health-pack.controller');
const { auth, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Patient routes
router.post('/', auth, authorize('PATIENT'), createHealthPack);
router.get('/my-pack', auth, authorize('PATIENT'), getMyHealthPack);
router.post('/share', auth, authorize('PATIENT'), shareHealthPack);

// Hospital / Doctor / Admin case HealthPack routes
router.get('/case/:caseId', auth, authorize('HOSPITAL', 'DOCTOR', 'ADMIN'), getCaseHealthPack);
router.get('/shared/:packId', auth, authorize('HOSPITAL', 'DOCTOR', 'ADMIN'), getSharedHealthPack);
router.get('/:caseId', auth, authorize('HOSPITAL', 'DOCTOR', 'ADMIN'), getCaseHealthPack);

module.exports = router;
