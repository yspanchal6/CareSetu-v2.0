const medicalDocumentService = require('../services/medical-document.service');
const emergencyRepository = require('../repositories/emergency.repository');

const uploadDocument = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const patient = await emergencyRepository.getPatientByUserId(userId);
    
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient profile not found.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'File upload is required.' });
    }

    const documentType = req.body.documentType || 'OTHER';

    const result = await medicalDocumentService.uploadDocument(patient.id, file, documentType);

    return res.status(201).json({
      success: true,
      message: 'Medical document uploaded successfully.',
      data: result.document,
      suggestedConditions: result.suggestedConditions,
    });
  } catch (error) {
    if (error.message.includes('file format') || error.message.includes('Allowed formats') || error.message.includes('maximum allowed limit') || error.message.includes('exceeds')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const getMyDocuments = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const patient = await emergencyRepository.getPatientByUserId(userId);

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient profile not found.' });
    }

    const documents = await medicalDocumentService.getPatientDocuments(patient.id);

    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { documentId } = req.params;

    const patient = await emergencyRepository.getPatientByUserId(userId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient profile not found.' });
    }

    await medicalDocumentService.deleteDocument(documentId, patient.id);

    return res.status(200).json({
      success: true,
      message: 'Medical document removed successfully.',
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('access denied') || error.message.includes('traversal')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    next(error);
  }
};

const downloadDocument = async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const requestingUser = req.user;

    const fileInfo = await medicalDocumentService.getDocumentFilePath(documentId, requestingUser);

    const safeFileName = (fileInfo.fileName || 'document')
      .replace(/[\r\n"'\\]/g, '_')
      .replace(/[^\x20-\x7E]/g, '');

    let contentType = 'application/octet-stream';
    const lowerName = (fileInfo.fileName || '').toLowerCase();
    if (fileInfo.fileType === 'PDF' || lowerName.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (lowerName.endsWith('.png')) {
      contentType = 'image/png';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    return res.sendFile(fileInfo.fullPath);
  } catch (error) {
    if (error.message.includes('traversal') || error.message.includes('Security Error') || error.message.includes('Access denied') || error.message.includes('expired')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    if (error.message.includes('Invalid document ID') || error.message.includes('invalid')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('File not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    next(error);
  }
};

module.exports = {
  uploadDocument,
  getMyDocuments,
  deleteDocument,
  downloadDocument,
};
