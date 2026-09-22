const express = require("express");
const {
  register,
  login,
  getMe,
  logout,
  requestOtp,
  verifyOtp,
  forgotPassword,
  verifyResetPhoneOtp,
  cancelForgotPassword,
  resetPassword,
  cancelRegistration,
  guestSession,
  googleAuth,
} = require("../controllers/auth.controller");

const { auth } = require("../middleware/auth.middleware");
const {
  loginRateLimiter,
  registerRateLimiter,
  otpRateLimiter,
} = require("../middleware/rate-limiters");

const router = express.Router();

router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/google", loginRateLimiter, googleAuth);
router.post("/guest-session", guestSession);
router.get("/me", auth, getMe);
router.post("/logout", auth, logout);

router.post("/request-otp", otpRateLimiter, requestOtp);
router.post("/verify-otp", otpRateLimiter, verifyOtp);
router.post("/cancel-registration", cancelRegistration);

router.post("/forgot-password", otpRateLimiter, forgotPassword);
router.post("/verify-reset-phone-otp", otpRateLimiter, verifyResetPhoneOtp);
router.post("/cancel-forgot-password", cancelForgotPassword);
router.post("/reset-password", otpRateLimiter, resetPassword);

module.exports = router;