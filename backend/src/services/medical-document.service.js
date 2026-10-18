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
 * Strict Magic Bytes & File Extension Validation for PDF, JPG, PNG, and DOCX.
 */
function validateFileSignature(buffer, originalname) {
  if (!buffer || buffer.length < 4) return false;

  const ext = path.extname(originalname || '').toLowerCase();
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
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

  // DOCX: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

  if (ext === '.pdf' && !isPdf) return false;
  if ((ext === '.jpg' || ext === '.jpeg') && !isJpeg) return false;
  if (ext === '.png' && !isPng) return false;
  if (ext === '.docx' && !isDocx) return false;

  return isPdf || isJpeg || isPng || isDocx;
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
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    if (!allowedExtensions.includes(ext)) {
      throw new Error('Invalid file format. Allowed formats: PDF, JPG, PNG, DOCX.');
    }

    // Strict MIME type check (.pdf, .jpg, .png, .docx)
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/zip',
      'application/octet-stream',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Invalid file format. Allowed formats: PDF, JPG, PNG, DOCX.');
    }

    // Magic Bytes Verification
    const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
    if (!validateFileSignature(fileBuffer, file.originalname)) {
      throw new Error('Invalid file format. Allowed formats: PDF, JPG, PNG, DOCX.');
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

    // Perform Genuine Document Extraction & OCR
    let extractedText = '';
    let processingStatus = 'COMPLETED';
    let failureReason = null;

    if (ext === '.pdf') {
      try {
        const pdfModule = require('pdf-parse');
        let parsedText = '';
        if (typeof pdfModule === 'function') {
          const pdfData = await pdfModule(fileBuffer);
          parsedText = (pdfData && pdfData.text) ? pdfData.text.trim() : '';
        } else if (pdfModule.PDFParse) {
          const parser = new pdfModule.PDFParse({ data: fileBuffer });
          const res = await parser.getText();
          parsedText = (res && res.text) ? res.text.trim() : '';
        }

        // Distinguish digital PDF from scanned PDF (no extractable text streams)
        if (parsedText.length >= 20) {
          extractedText = parsedText.slice(0, 10000);
          processingStatus = 'COMPLETED';
        } else {
          // Scanned PDF — explicitly unsupported in this phase
          processingStatus = 'FAILED';
          failureReason = 'Scanned PDFs without digital text streams are not supported in this phase. Please upload original reports in clear image format (PNG, JPG) or digital text PDF format.';
          extractedText = null;
        }
      } catch (pdfErr) {
        processingStatus = 'FAILED';
        failureReason = `Malformed or corrupted PDF document: ${pdfErr.message}`;
        extractedText = null;
      }
    } else if (ext === '.docx') {
      try {
        const mammoth = require('mammoth');
        const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
        const parsedText = (docxResult && docxResult.value) ? docxResult.value.trim() : '';
        if (parsedText.length >= 10) {
          extractedText = parsedText.slice(0, 10000);
          processingStatus = 'COMPLETED';
        } else {
          processingStatus = 'FAILED';
          failureReason = 'Empty or unreadable DOCX document.';
          extractedText = null;
        }
      } catch (docxErr) {
        processingStatus = 'FAILED';
        failureReason = `Invalid or corrupt DOCX document structure: ${docxErr.message}`;
        extractedText = null;
      }
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      let worker = null;
      try {
        const { createWorker } = require('tesseract.js');
        worker = await createWorker('eng');
        const ocrResult = await worker.recognize(fileBuffer);
        const ocrText = (ocrResult && ocrResult.data && ocrResult.data.text) ? ocrResult.data.text.trim() : '';

        if (ocrText.length >= 15) {
          extractedText = ocrText.slice(0, 10000);
          processingStatus = 'COMPLETED';
        } else {
          processingStatus = 'FAILED';
          failureReason = 'Unreadable document image / no legible text detected.';
          extractedText = null;
        }
      } catch (ocrErr) {
        processingStatus = 'FAILED';
        failureReason = `Image OCR extraction failed: ${ocrErr.message}`;
        extractedText = null;
      } finally {
        if (worker) {
          try {
            await worker.terminate();
          } catch (termErr) {
            console.warn('[OCR Worker Termination Warning]:', termErr.message);
          }
        }
      }
    }

    // Perform negation-aware keyword text scanning for condition suggestions on genuine text
    const textToScan = extractedText ? (file.originalname + ' ' + extractedText) : file.originalname;
    const extractedConditions = processingStatus === 'COMPLETED' ? extractConditionSuggestions(textToScan) : [];

    const documentRecord = await prisma.medicalDocument.create({
      data: {
        patientId,
        fileName: file.originalname,
        fileUrl: relativeUrl,
        fileType: ext === '.pdf' ? 'PDF' : ext === '.docx' ? 'DOCX' : 'IMAGE',
        fileSize: file.size,
        documentType: documentType || 'OTHER',
        processingStatus,
        extractedText: extractedText ? extractedText.slice(0, 3000) : null,
        extractedConditions: extractedConditions.length > 0 ? extractedConditions.join(', ') : null,
      },
    });

    return {
      document: documentRecord,
      suggestedConditions: extractedConditions,
      failureReason,
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
        const err = new Error('Access denied: Hospital profile not found.');
        err.code = 'HOSPITAL_NOT_AUTHORIZED';
        throw err;
      }

      // 1. Check for unexpired HealthPackShare with granted consent for this hospital & patient
      const validShare = await prisma.healthPackShare.findFirst({
        where: {
          OR: [
            { sharedWithHospitalId: hospital.id },
            { sharedWithUserId: requestingUser.userId || requestingUser.id || '' },
          ],
          healthPack: { patientId: doc.patientId },
          consentGranted: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { sharedAt: 'desc' },
      });

      // 2. Check for latest active emergency case assigned or requested for this hospital & patient
      let assignedCase = await prisma.emergencyCase.findFirst({
        where: {
          hospitalId: hospital.id,
          patientId: doc.patientId,
          status: { in: ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED', 'ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!assignedCase) {
        const reqCase = await prisma.hospitalRequest.findFirst({
          where: {
            hospitalId: hospital.id,
            emergencyCase: { patientId: doc.patientId, status: { notIn: ['CLOSED', 'CANCELLED'] } },
            status: { in: ['ACCEPTED', 'PENDING'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (reqCase) assignedCase = reqCase;
      }

      // 3. Check for any existing share for this hospital & patient (even if expired or revoked)
      const existingShareRecord = await prisma.healthPackShare.findFirst({
        where: {
          OR: [
            { sharedWithHospitalId: hospital.id },
            { sharedWithUserId: requestingUser.userId || requestingUser.id || '' },
          ],
          healthPack: { patientId: doc.patientId },
        },
        orderBy: { sharedAt: 'desc' },
      });

      // Check if consent was explicitly revoked
      if (existingShareRecord && existingShareRecord.consentGranted === false) {
        const err = new Error('Access denied: Patient consent for document access has been revoked.');
        err.code = 'CONSENT_REQUIRED';
        throw err;
      }

      // Check if access is valid via unexpired share
      let isAccessAuthorized = Boolean(validShare);

      if (!isAccessAuthorized) {
        if (existingShareRecord && existingShareRecord.expiresAt && new Date(existingShareRecord.expiresAt) <= new Date()) {
          const err = new Error('Access denied: HealthPack 24-hour access window has expired.');
          err.code = 'DOCUMENT_ACCESS_EXPIRED';
          throw err;
        }

        const err = new Error('Access denied: Hospital is not authorized for this patient document.');
        err.code = 'HOSPITAL_NOT_AUTHORIZED';
        throw err;
      }
    } else if (requestingUser.role === 'DOCTOR') {
      const doctorUserId = requestingUser.userId || requestingUser.id;
      const userEmail = String(requestingUser.email || '').toLowerCase();
      const doctorUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(doctorUserId ? [{ id: doctorUserId }] : []),
            ...(userEmail ? [{ email: { equals: userEmail, mode: 'insensitive' } }] : []),
          ],
          role: 'DOCTOR',
        },
        select: { id: true, email: true },
      });

      if (!doctorUser) {
        const err = new Error('Access denied: Doctor profile not found.');
        err.code = 'DOCTOR_NOT_FOUND';
        throw err;
      }

      // 1. Check for active emergency cases for this patient
      const activeCaseStatuses = ['ACCEPTED', 'TRANSFER', 'IN_PROGRESS', 'TREATMENT'];
      const activeCases = await prisma.emergencyCase.findMany({
        where: {
          patientId: doc.patientId,
          status: { in: activeCaseStatuses },
          hospitalId: { not: null },
        },
        select: {
          id: true,
          caseId: true,
          hospitalId: true,
          status: true,
          medicalSummary: true,
        },
      });

      if (!activeCases.length) {
        const closedCase = await prisma.emergencyCase.findFirst({
          where: {
            patientId: doc.patientId,
            status: { in: ['CLOSED', 'CANCELLED'] },
          },
        });
        if (closedCase) {
          const err = new Error('Access denied: Emergency case access window has expired or case is closed.');
          err.code = 'DOCUMENT_ACCESS_EXPIRED';
          throw err;
        }
        const err = new Error('Access denied: No active emergency case found for this patient.');
        err.code = 'NO_ACTIVE_EMERGENCY_CASE';
        throw err;
      }

      // 2. Doctor must have active standing at the case hospital AND be the assigned doctor
      let isAuthorizedForCase = false;
      const normalizedDocEmail = String(doctorUser.email || '').toLowerCase();

      for (const c of activeCases) {
        const activeStaff = await prisma.hospitalStaff.findFirst({
          where: {
            hospitalId: c.hospitalId,
            OR: [
              ...(doctorUser.id ? [{ userId: doctorUser.id }] : []),
              ...(normalizedDocEmail ? [{ email: { equals: normalizedDocEmail, mode: 'insensitive' } }] : []),
            ],
            isActive: true,
          },
          select: { id: true },
        });

        if (!activeStaff) {
          continue;
        }

        const assignment = c.medicalSummary?.assignedDoctor;
        const isAssigned = assignment && (
          assignment.id === doctorUser.id ||
          assignment.id === activeStaff.id ||
          (assignment.email && String(assignment.email).toLowerCase() === normalizedDocEmail)
        );

        if (isAssigned) {
          isAuthorizedForCase = true;
          break;
        }
      }

      if (!isAuthorizedForCase) {
        const err = new Error('Access denied: You are not the authorized doctor assigned to this emergency case.');
        err.code = 'DOCTOR_NOT_AUTHORIZED';
        throw err;
      }

      // 3. Verify patient consent has not been explicitly revoked
      const existingShareRecord = await prisma.healthPackShare.findFirst({
        where: {
          healthPack: { patientId: doc.patientId },
        },
        orderBy: { sharedAt: 'desc' },
      });

      if (existingShareRecord && existingShareRecord.consentGranted === false) {
        const err = new Error('Access denied: Patient consent for document access has been revoked.');
        err.code = 'CONSENT_REQUIRED';
        throw err;
      }
    } else if (requestingUser.role === 'ADMIN') {
      // Admin bypass for support/audit purposes
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

    // Write audit log for document access
    try {
      await prisma.auditLog.create({
        data: {
          userId: requestingUser.userId || requestingUser.id,
          action: 'HEALTH_PACK_VIEWED',
          entity: 'MedicalDocument',
          entityId: doc.id,
          details: { event: 'DOCUMENT_VIEWED', fileName: doc.fileName, patientId: doc.patientId },
        },
      });
    } catch (auditErr) {
      console.warn('[MedicalDocumentService] Audit log warning:', auditErr.message);
    }

    return {
      fullPath,
      fileName: doc.fileName,
      fileType: doc.fileType,
    };
  }
}

module.exports = new MedicalDocumentService();
