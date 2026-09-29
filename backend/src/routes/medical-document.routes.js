const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  uploadDocument,
  getMyDocuments,
  deleteDocument,
  downloadDocument,
  viewDocument,
} = require('../controllers/medical-document.controller');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');

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

router.use(auth, denyGuest);

router.post('/', authorize('PATIENT'), handleMulterUpload, uploadDocument);
router.get('/my-documents', authorize('PATIENT'), getMyDocuments);
router.get('/:documentId/view', auth, authorize('PATIENT', 'HOSPITAL'), viewDocument);
router.get('/:documentId/download', auth, authorize('PATIENT', 'HOSPITAL'), downloadDocument);
router.get('/download/:documentId', auth, authorize('PATIENT', 'HOSPITAL'), downloadDocument);
router.get('/:documentId', auth, authorize('PATIENT', 'HOSPITAL'), downloadDocument);
router.delete('/:documentId', authorize('PATIENT'), deleteDocument);

module.exports = router;
