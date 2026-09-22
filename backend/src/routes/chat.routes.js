const express = require('express');
const {
  sendMessage,
  getConversations,
  getConversation,
} = require('../controllers/chat.controller');
const { auth, authorize, denyGuest } = require('../middleware/auth.middleware');

const router = express.Router();

// Text chat is available to registered roles and GUEST users.
router.post('/send', auth, authorize('PATIENT', 'DOCTOR', 'HOSPITAL', 'GUEST'), sendMessage);
router.post('/message', auth, authorize('PATIENT', 'DOCTOR', 'HOSPITAL', 'GUEST'), sendMessage);
router.get('/conversations', auth, authorize('PATIENT', 'DOCTOR', 'HOSPITAL', 'GUEST'), getConversations);
router.get('/conversations/:id', auth, authorize('PATIENT', 'DOCTOR', 'HOSPITAL', 'GUEST'), getConversation);

// Document upload, OCR, and medical record analysis are strictly DENIED for guest users
router.post('/upload-document', auth, denyGuest, (req, res) => {
  res.status(403).json({ error: 'Document upload is not available in Guest Mode. Please create an account or log in.', isGuestRestricted: true });
});
router.post('/ocr', auth, denyGuest, (req, res) => {
  res.status(403).json({ error: 'OCR analysis is not available in Guest Mode. Please create an account or log in.', isGuestRestricted: true });
});
router.post('/analyze-image', auth, denyGuest, (req, res) => {
  res.status(403).json({ error: 'Medical document analysis is not available in Guest Mode. Please create an account or log in.', isGuestRestricted: true });
});

module.exports = router;