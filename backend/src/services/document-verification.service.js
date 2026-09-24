const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const otpService = require('./otp.service');
const { normalizeEmail, sanitizeUserResponse } = require('../utils/auth-security');

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/documents');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ROLE_REQUIRED_DOCUMENTS = {
  PATIENT: [
    { type: 'ID_PROOF', label: 'Government Photo ID / Aadhaar Card / Passport' },
  ],
  DOCTOR: [
    { type: 'MEDICAL_LICENSE', label: 'Medical Registration Certificate / License' },
    { type: 'GOVT_ID', label: 'Government Photo ID' },
  ],
  HOSPITAL: [
    { type: 'REGISTRATION_CERTIFICATE', label: 'Hospital Registration Certificate' },
    { type: 'OPERATIONAL_LICENSE', label: 'Clinical Establishment Operational License' },
  ],
  ADMIN: [
    { type: 'ID_PROOF', label: 'Admin Identity Authorization' },
  ],
};

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [namePart, domain] = email.split('@');
  if (namePart.length <= 2) return `${namePart[0]}***@${domain}`;
  return `${namePart[0]}***${namePart[namePart.length - 1]}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 10) return phone || '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return phone;
  const last4 = clean.slice(-4);
  return `******${last4}`;
}

function validateFileSignature(buffer, originalname) {
  if (!buffer || buffer.length < 4) return false;

  const ext = path.extname(originalname || '').toLowerCase();
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
  if (!allowedExts.includes(ext)) {
    return false;
  }

  // Magic bytes check
  const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47; // \x89PNG
  const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF; // JPEG

  if (ext === '.pdf') return isPdf;
  if (ext === '.png') return isPng;
  if (ext === '.jpg' || ext === '.jpeg') return isJpg;

  return false;
}

/**
 * Get user verification status, uploaded documents, and checklist state
 */
async function getVerificationStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true, hospital: true },
  });

  if (!user) {
    const error = new Error('User account not found.');
    error.status = 404;
    throw error;
  }

  const role = user.role || 'PATIENT';
  const requiredDocSpecs = ROLE_REQUIRED_DOCUMENTS[role] || ROLE_REQUIRED_DOCUMENTS.PATIENT;
  const requiredTypes = requiredDocSpecs.map(d => d.type);

  // Retrieve verification documents
  const allDocs = await prisma.medicalDocument.findMany({
    where: {
      OR: [
        { patientId: user.patient?.id || 'non-existent' },
        { extractedText: { contains: `"userId":"${userId}"` } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const uploadedDocTypes = new Set(allDocs.map(d => d.documentType));
  const missingDocTypes = requiredTypes.filter(t => !uploadedDocTypes.has(t));
  const hasAllRequiredDocs = missingDocTypes.length === 0;

  const phone = user.patient?.phone || user.hospital?.phone || null;

  const verificationStatus = user.role === 'HOSPITAL' && user.hospital
    ? user.hospital.verificationStatus
    : (user.isVerified ? 'APPROVED' : 'PENDING');
  const hospitalStatus = user.role === 'HOSPITAL' && user.hospital
    ? user.hospital.status
    : (user.isVerified ? 'ACTIVE' : 'INACTIVE');

  return {
    success: true,
    user: sanitizeUserResponse(user),
    role,
    isVerified: user.role === 'HOSPITAL' ? (verificationStatus === 'APPROVED' && hospitalStatus === 'ACTIVE') : Boolean(user.isVerified),
    verificationStatus,
    hospitalStatus,
    requiredDocuments: requiredDocSpecs,
    uploadedDocuments: allDocs.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      documentType: doc.documentType,
      createdAt: doc.createdAt,
    })),
    hasAllRequiredDocs,
    missingDocTypes,
    maskedEmail: maskEmail(user.email),
    maskedPhone: maskPhone(phone),
    hasPhone: Boolean(phone),
  };
}

/**
 * Upload a verification document
 */
async function uploadVerificationDocument(userId, file, documentType) {
  if (!file || !file.buffer) {
    const error = new Error('Document file buffer is required.');
    error.status = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true },
  });

  if (!user) {
    const error = new Error('User account not found.');
    error.status = 404;
    throw error;
  }

  const role = user.role || 'PATIENT';
  const validSpecs = ROLE_REQUIRED_DOCUMENTS[role] || ROLE_REQUIRED_DOCUMENTS.PATIENT;
  const validTypes = validSpecs.map(s => s.type);

  if (!validTypes.includes(documentType)) {
    const error = new Error(`Invalid document type '${documentType}' for role ${role}. Allowed types: ${validTypes.join(', ')}.`);
    error.status = 400;
    throw error;
  }

  if (file.size > 10 * 1024 * 1024) {
    const error = new Error('File size exceeds maximum allowed limit of 10MB.');
    error.status = 400;
    throw error;
  }

  const isValidSig = validateFileSignature(file.buffer, file.originalname);
  if (!isValidSig) {
    const error = new Error('Invalid file format or corrupted signature. Allowed formats: PDF, JPG, PNG.');
    error.status = 400;
    throw error;
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const safeBaseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const storedFileName = `verify_${userId.slice(0, 8)}_${Date.now()}_${safeBaseName}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, storedFileName);

  fs.writeFileSync(fullPath, file.buffer);

  const fileTypeStr = ext.replace('.', '').toUpperCase();
  const metadata = JSON.stringify({ userId, documentType, isVerificationDoc: true, originalName: file.originalname });

  const createdDoc = await prisma.medicalDocument.create({
    data: {
      patientId: user.patient?.id || null,
      fileName: file.originalname,
      fileUrl: `/uploads/documents/${storedFileName}`,
      fileType: fileTypeStr,
      fileSize: file.size,
      documentType,
      processingStatus: 'COMPLETED',
      extractedText: metadata,
    },
  });

  return {
    success: true,
    message: 'Verification document uploaded successfully.',
    document: {
      id: createdDoc.id,
      fileName: createdDoc.fileName,
      fileType: createdDoc.fileType,
      fileSize: createdDoc.fileSize,
      documentType: createdDoc.documentType,
      createdAt: createdDoc.createdAt,
    },
  };
}

/**
 * Delete an uploaded verification document
 */
async function deleteVerificationDocument(userId, documentId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true },
  });

  if (!user) {
    const error = new Error('User account not found.');
    error.status = 404;
    throw error;
  }

  const doc = await prisma.medicalDocument.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    const error = new Error('Document not found.');
    error.status = 404;
    throw error;
  }

  const isOwner = (doc.patientId && doc.patientId === user.patient?.id) ||
                  (doc.extractedText && doc.extractedText.includes(`"userId":"${userId}"`));

  if (!isOwner) {
    const error = new Error('Unauthorized document access.');
    error.status = 403;
    throw error;
  }

  await prisma.medicalDocument.delete({ where: { id: documentId } });

  // Delete physical file if exists
  if (doc.fileUrl) {
    const fileName = path.basename(doc.fileUrl);
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }

  return { success: true, message: 'Verification document removed successfully.' };
}

/**
 * Request Verification OTP (Email via Brevo or SMS via TextBee)
 */
async function requestVerificationOtp(userId, method, confirmChecklist) {
  if (!confirmChecklist) {
    const error = new Error('You must confirm that all submitted documents are genuine and belong to you before requesting OTP.');
    error.status = 400;
    throw error;
  }

  if (!['EMAIL', 'SMS'].includes(method)) {
    const error = new Error('Invalid OTP delivery method. Must be EMAIL or SMS.');
    error.status = 400;
    throw error;
  }

  const status = await getVerificationStatus(userId);
  if (!status.hasAllRequiredDocs) {
    const error = new Error(`Please upload all required verification documents before requesting OTP. Missing: ${status.missingDocTypes.join(', ')}.`);
    error.status = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true, hospital: true },
  });

  let identifier;
  let purpose;

  if (method === 'EMAIL') {
    identifier = normalizeEmail(user.email);
    purpose = 'DOCUMENT_VERIFICATION_EMAIL';
  } else {
    const phone = user.patient?.phone || user.hospital?.phone;
    if (!phone) {
      const error = new Error('No registered phone number found on your account. Please select Email verification.');
      error.status = 400;
      throw error;
    }
    identifier = phone;
    purpose = 'DOCUMENT_VERIFICATION_PHONE';
  }

  // Delete existing pending OTP for this identifier & purpose
  await prisma.otp.deleteMany({
    where: { identifier, purpose },
  }).catch(() => {});

  const otpResult = await otpService.requestOtp({
    identifier,
    email: method === 'EMAIL' ? identifier : null,
    phone: method === 'SMS' ? identifier : null,
    purpose,
  });

  const maskedDestination = method === 'EMAIL' ? status.maskedEmail : status.maskedPhone;

  return {
    success: true,
    message: `Verification code sent to your registered ${method === 'EMAIL' ? 'email' : 'mobile number'}.`,
    maskedDestination,
    method,
    expiresAt: otpResult.expiresAt,
    cooldownSeconds: 60,
    ...(otpResult.devOtp ? { devOtp: otpResult.devOtp } : {}),
  };
}

/**
 * Verify Document Verification OTP
 */
async function verifyVerificationOtp(userId, otp, method) {
  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    const error = new Error('Verification code must be exactly 6 digits.');
    error.status = 400;
    throw error;
  }

  if (!['EMAIL', 'SMS'].includes(method)) {
    const error = new Error('Invalid verification method. Must be EMAIL or SMS.');
    error.status = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true, hospital: true },
  });

  if (!user) {
    const error = new Error('User account not found.');
    error.status = 404;
    throw error;
  }

  let identifier;
  let purpose;

  if (method === 'EMAIL') {
    identifier = normalizeEmail(user.email);
    purpose = 'DOCUMENT_VERIFICATION_EMAIL';
  } else {
    const phone = user.patient?.phone || user.hospital?.phone;
    if (!phone) {
      const error = new Error('No registered mobile number found.');
      error.status = 400;
      throw error;
    }
    identifier = phone;
    purpose = 'DOCUMENT_VERIFICATION_PHONE';
  }

  try {
    await otpService.verifyOtp(identifier, purpose, otp);
  } catch (err) {
    const error = new Error(err.message || 'Invalid or expired verification code.');
    error.status = 400;
    throw error;
  }

  // Update user verification status in database
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isVerified: true },
    include: { patient: true, hospital: true },
  });

  if (user.role === 'HOSPITAL' && user.hospital) {
    await prisma.hospital.update({
      where: { id: user.hospital.id },
      data: { isVerified: true },
    }).catch(() => {});
  }

  // Delete verified OTP record to enforce single-use & prevent replay
  await prisma.otp.deleteMany({
    where: { identifier, purpose },
  }).catch(() => {});

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DOCUMENT_PROCESSED',
      entity: 'User',
      entityId: userId,
      endpoint: '/api/auth/document-verification/verify-otp',
      details: { method, role: user.role, isVerified: true },
    },
  }).catch(() => {});

  const redirectUrl = `/${user.role.toLowerCase()}/dashboard`;

  return {
    success: true,
    message: 'Document Verification Successful',
    isVerified: true,
    user: sanitizeUserResponse(updatedUser),
    redirectUrl,
  };
}

/**
 * Cancel pending verification OTP
 */
async function cancelVerificationOtp(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { patient: true, hospital: true } });
  if (user) {
    const email = normalizeEmail(user.email);
    const phone = user.patient?.phone || user.hospital?.phone || null;

    const identifiers = [email];
    if (phone) identifiers.push(phone);

    await prisma.otp.deleteMany({
      where: {
        identifier: { in: identifiers },
        purpose: { in: ['DOCUMENT_VERIFICATION_EMAIL', 'DOCUMENT_VERIFICATION_PHONE'] },
      },
    }).catch(() => {});
  }

  return { success: true, message: 'Pending verification OTP cancelled.' };
}

/**
 * Skip Document Verification for Now
 */
async function skipVerification(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { patient: true, hospital: true },
  });

  if (!user) {
    const error = new Error('User account not found.');
    error.status = 404;
    throw error;
  }

  // Cancel any pending verification OTP
  await cancelVerificationOtp(userId);

  // Audit log entry for skip action
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'DOCUMENT_VERIFICATION_SKIPPED',
      entity: 'User',
      entityId: userId,
      endpoint: '/api/auth/document-verification/skip',
      details: { role: user.role, isVerified: Boolean(user.isVerified) },
    },
  }).catch(() => {});

  const redirectUrl = `/${(user.role || 'PATIENT').toLowerCase()}/dashboard`;

  return {
    success: true,
    message: 'You can complete your document verification later from Settings.',
    isVerified: Boolean(user.isVerified),
    verificationStatus: user.isVerified ? 'VERIFIED' : 'PENDING',
    user: sanitizeUserResponse(user),
    redirectUrl,
  };
}

module.exports = {
  getVerificationStatus,
  uploadVerificationDocument,
  deleteVerificationDocument,
  requestVerificationOtp,
  verifyVerificationOtp,
  cancelVerificationOtp,
  skipVerification,
};

