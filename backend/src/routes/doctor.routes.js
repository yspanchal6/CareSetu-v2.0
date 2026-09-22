const express = require('express');
const router = express.Router();

const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');

router.use(auth, denyGuest);

// Doctor profile/dashboard route
router.get('/profile', authorize('DOCTOR'), (req, res) => {
  res.json({ success: true, message: 'Doctor profile route', doctor: req.user });
});

module.exports = router;
