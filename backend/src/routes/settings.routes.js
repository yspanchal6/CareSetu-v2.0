const express = require('express');
const { auth, denyGuest } = require('../middleware/auth.middleware');
const { passwordChangeRateLimiter, otpEmailLimiter, otpVerifyLimiter } = require('../middleware/rate-limiters');
const settingsController = require('../controllers/settings.controller');

const router = express.Router();

// Require authentication & registered account for all settings endpoints
router.use(auth, denyGuest);

router.get('/profile', settingsController.getProfile);
router.patch('/profile', settingsController.updateProfile);
router.patch('/password', passwordChangeRateLimiter, settingsController.updatePassword);
router.patch('/notifications', settingsController.updateNotifications);

// OTP-based Credential Updates (Email / Mobile Number)
router.post('/credentials/request-change', otpEmailLimiter, settingsController.requestCredentialChange);
router.post('/credentials/verify-otp', otpVerifyLimiter, settingsController.verifyCredentialOtp);
router.post('/credentials/cancel-change', settingsController.cancelCredentialChange);

module.exports = router;

