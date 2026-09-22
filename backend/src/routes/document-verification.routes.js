const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getStatus,
  uploadDocument,
  deleteDocument,
  requestOtp,
  verifyOtp,
  cancelOtp,
  skipVerification,
} = require('../controllers/document-verification.controller');
const { auth, denyGuest } = require('../middleware/auth.middleware');
const { otpEmailLimiter, otpVerifyLimiter } = require('../middleware/rate-limiters');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];

    if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed formats: PDF, JPG, PNG.'));
    }
  },
});

const handleMulterUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE' || err.message.includes('file size') || err.message.includes('limit')) {
        return res.status(400).json({ success: false, error: 'File size exceeds maximum allowed limit of 10MB.' });
      }
      if (err.message.includes('format') || err.message.includes('Allowed formats')) {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(400).json({ success: false, error: err.message || 'File upload error.' });
    }
    next();
  });
};

const router = express.Router();

// Apply authentication and denyGuest middleware to all document verification routes
router.use(auth, denyGuest);

router.get('/status', getStatus);
router.post('/upload', handleMulterUpload, uploadDocument);
router.delete('/document/:documentId', deleteDocument);
router.post('/request-otp', otpEmailLimiter, requestOtp);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/cancel', cancelOtp);
router.post('/skip', skipVerification);



module.exports = router;
