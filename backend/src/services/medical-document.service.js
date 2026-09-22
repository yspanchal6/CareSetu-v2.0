const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/documents');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Priority 4: Negation-aware keyword scanner for condition suggestions.
 * Negated or family-history phrases ("no heart disease", "rule out diabetes") do NOT generate suggestions.
 */
function extractConditionSuggestions(text) {
  if (!text) return [];
  const textUpper = text.toUpperCase();
  const suggestions = [];

  const isKeywordPresentAndPositive = (keywordPatterns, negationWords = ['NO ', 'DENIES', 'NEGATIVE FOR', 'WITHOUT', 'RULE OUT', 'FAMILY HISTORY OF', 'NO HISTORY OF']) => {
    for (const pattern of keywordPatterns) {
      const index = textUpper.indexOf(pattern);
      if (index !== -1) {
        const precedingText = textUpper.substring(Math.max(0, index - 35), index);
        const isNegated = negationWords.some(neg => precedingText.includes(neg));
        if (!isNegated) {
          return true;
        }
      }
    }
    return false;
  };

  if (isKeywordPresentAndPositive(['CARDIAC', 'HEART DISEASE', 'HEART ATTACK', 'MYOCARDIAL'])) {
    suggestions.push('Heart disease / Cardiac condition');
  }
  if (isKeywordPresentAndPositive(['DIABETES', 'DIABETIC', 'HIGH GLUCOSE', 'INSULIN DEPENDENT'])) {
    suggestions.push('Diabetes');
  }
  if (isKeywordPresentAndPositive(['HYPERTENSION', 'HIGH BLOOD PRESSURE', 'HIGH BP'])) {
    suggestions.push('Hypertension / High BP');
  }
  if (isKeywordPresentAndPositive(['PENICILLIN', 'ALLERGY TO PENICILLIN'])) {
    suggestions.push('Penicillin allergy');
  }

  return suggestions;
}

/**
 * Strict Magic Bytes & File Extension Validation for PDF, JPG, and PNG.
 */
function validateFileSignature(buffer, originalname) {
  if (!buffer || buffer.length < 4) return false;

  const ext = path.extname(originalname || '').toLowerCase();
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
  if (!allowedExts.includes(ext)) {
    return false;
  }

  // Magic bytes check
  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;

  // JPEG: 0xFF 0xD8 0xFF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  // PNG: 0x89 0x50 0x4E 0x47 (\x89PNG)
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;

  if (ext === '.pdf' && !isPdf) return false;
  if ((ext === '.jpg' || ext === '.jpeg') && !isJpeg) return false;
  if (ext === '.png' && !isPng) return false;

  return isPdf || isJpeg || isPng;
}

class MedicalDocumentService {
  /**
   * Processes file upload, saves file, parses text for condition suggestions, and creates DB record.
   */
  async uploadDocument(patientId, file, documentType = 'OTHER') {
    if (!file) {
      throw new Error('No document file provided.');
    }

    // Validate size limit (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File size exceeds maximum allowed limit of 10MB.');
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (patient) {
      const { isUserBlocked } = require('./admin-blocklist.service');
      const blockCheck = await isUserBlocked(patient.userId);
      if (blockCheck.isBlocked) {
        const error = new Error(`Blocked patients cannot upload medical documents. Reason: ${blockCheck.reason || 'Account suspended'}`);
        error.status = 403;
        throw error;
      }
    }

    // Strict extension check
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowedExtensions.includes(ext)) {
      throw new Error('Invalid file format. Allowed formats: PDF, JPG, PNG.');
    }

    // Strict MIME type check (.pdf, .jpg, .png)
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file format. Allowed formats: PDF, JPG, PNG.');
    }

    // Magic Bytes Verification
    const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
    if (!validateFileSignature(fileBuffer, file.originalname)) {
      throw new Error('Invalid file format. Allowed formats: PDF, JPG, PNG.');
    }

    // Generate safe server-side filename
    const uniqueName = `doc_${patientId}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    const filePath = path.normalize(path.join(UPLOAD_DIR, uniqueName));

    // Path traversal check
    if (!filePath.startsWith(UPLOAD_DIR)) {
      throw new Error('Security Error: Illegal path traversal attempt.');
    }

    // Save file buffer or move file
    if (file.buffer) {
      fs.writeFileSync(filePath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, filePath);
    }

    const relativeUrl = `/uploads/documents/${uniqueName}`;

    // Perform negation-aware keyword text scanning for condition suggestions
    const fileContent = (file.originalname + ' ' + (fileBuffer ? fileBuffer.toString('utf8', 0, 1000) : ''));
    const extractedConditions = extractConditionSuggestions(fileContent);

    const documentRecord = await prisma.medicalDocument.create({
      data: {
        patientId,
        fileName: file.originalname,
        fileUrl: relativeUrl,
        fileType: ext === '.pdf' ? 'PDF' : 'IMAGE',
        fileSize: file.size,
        documentType: documentType || 'OTHER',
        processingStatus: 'COMPLETED',
        extractedText: null,
        extractedConditions: extractedConditions.length > 0 ? extractedConditions.join(', ') : null,
      },
    });

    return {
      document: documentRecord,
      suggestedConditions: extractedConditions,
    };
  }

  /**
   * Retrieves all documents for a patient.
   */
  async getPatientDocuments(patientId) {
    return prisma.medicalDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deletes a document with IDOR ownership verification.
   */
  async deleteDocument(documentId, patientId) {
    if (!documentId || documentId.includes('..') || documentId.includes('/') || documentId.includes('\\')) {
      throw new Error('Invalid document ID or path traversal attempt.');
    }

    const doc = await prisma.medicalDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.patientId !== patientId) {
      throw new Error('Document not found or access denied.');
    }

    // Delete file from disk if exists
    const filename = path.basename(doc.fileUrl);
    const fullPath = path.normalize(path.join(UPLOAD_DIR, filename));
    if (fullPath.startsWith(UPLOAD_DIR) && fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch {}
    }

    await prisma.medicalDocument.delete({
      where: { id: documentId },
    });

    return true;
  }

  /**
   * Authenticated document download with path traversal protection and RBAC/share verification.
   */
  async getDocumentFilePath(documentId, requestingUser) {
    if (!documentId || documentId.includes('..') || documentId.includes('/') || documentId.includes('\\')) {
      throw new Error('Invalid document ID or path traversal attempt.');
    }

    const doc = await prisma.medicalDocument.findUnique({ where: { id: documentId } });
    if (!doc) {
      throw new Error('Document not found.');
    }

    // RBAC & Ownership / Share Verification
    if (requestingUser.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({ where: { userId: requestingUser.userId } });
      if (!patient || doc.patientId !== patient.id) {
        throw new Error('Access denied: Unauthorized document request.');
      }
    } else if (requestingUser.role === 'HOSPITAL') {
      const hospital = await prisma.hospital.findFirst({
        where: {
          OR: [
            { id: requestingUser.hospitalId || '' },
            { userId: requestingUser.userId || requestingUser.id || '' },
          ],
        },
      });
      if (!hospital) {
        throw new Error('Access denied: Hospital profile not found.');
      }

      // Check for ACTIVE non-expired HealthPackShare for patient owning this doc
      const activeShare = await prisma.healthPackShare.findFirst({
        where: {
          sharedWithHospitalId: hospital.id,
          healthPack: { patientId: doc.patientId },
          status: 'ACTIVE',
          consentGranted: true,
          expiresAt: { gt: new Date() },
        },
      });

      // Check for assigned / requested emergency case for this hospital & patient
      const assignedCase = await prisma.emergencyCase.findFirst({
        where: {
          hospitalId: hospital.id,
          patientId: doc.patientId,
          status: { in: ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'CLOSED'] },
        },
      });

      if (!activeShare && !assignedCase) {
        throw new Error('Access denied: HealthPack access expired or hospital not authorized for this patient.');
      }
    } else {
      throw new Error('Access denied: Invalid role.');
    }

    const filename = path.basename(doc.fileUrl);
    const fullPath = path.normalize(path.join(UPLOAD_DIR, filename));

    // Path Traversal Security Guard
    if (!fullPath.startsWith(UPLOAD_DIR)) {
      throw new Error('Security Error: Illegal path traversal attempt.');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found on disk.');
    }

    return {
      fullPath,
      fileName: doc.fileName,
      fileType: doc.fileType,
    };
  }
}

module.exports = new MedicalDocumentService();
