const documentVerificationService = require('../services/document-verification.service');

const getStatus = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = await documentVerificationService.getVerificationStatus(userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const file = req.file;
    const documentType = req.body.documentType;

    if (!file) {
      return res.status(400).json({ success: false, error: 'Document file upload is required.' });
    }
    if (!documentType) {
      return res.status(400).json({ success: false, error: 'documentType parameter is required.' });
    }

    const result = await documentVerificationService.uploadVerificationDocument(userId, file, documentType);
    return res.status(201).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { documentId } = req.params;
    const result = await documentVerificationService.deleteVerificationDocument(userId, documentId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const requestOtp = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { method, confirmChecklist } = req.body;
    const result = await documentVerificationService.requestVerificationOtp(userId, method, confirmChecklist);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { otp, method } = req.body;
    const result = await documentVerificationService.verifyVerificationOtp(userId, otp, method);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const cancelOtp = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = await documentVerificationService.cancelVerificationOtp(userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const skipVerification = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = await documentVerificationService.skipVerification(userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message });
    }
    next(error);
  }
};

module.exports = {
  getStatus,
  uploadDocument,
  deleteDocument,
  requestOtp,
  verifyOtp,
  cancelOtp,
  skipVerification,
};

