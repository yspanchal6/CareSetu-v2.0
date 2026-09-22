const express = require('express');
const router = express.Router();
const fcmController = require('../controllers/fcm.controller');
const { auth } = require('../middleware/auth.middleware');

router.post('/token', auth, fcmController.registerToken);
router.delete('/token', auth, fcmController.deactivateToken);

module.exports = router;
