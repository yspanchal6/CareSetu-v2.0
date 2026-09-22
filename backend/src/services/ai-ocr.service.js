// ai-ocr.service.js
// Medical Document OCR, Text Extraction, MIME Validation, & Prompt Injection Sanitizer Engine.

const fs = require('fs');

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'text/plain'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validate document file bounds, MIME type, and size limit.
 */
function validateDocument(fileBufferOrPath, mimeType, fileSize) {
  if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: 'File exceeds maximum size limit of 10 MB.' };
  }

  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return { valid: false, reason: 'Unsupported file format. Only PDF, JPG, and PNG documents are allowed.' };
  }

  return { valid: true };
}

/**
 * Extract text from supported medical document formats.
 * Sanitizes prompt injection instructions inside document text.
 */
function extractDocumentText(fileBufferOrPath, mimeType = 'text/plain', filename = 'document.pdf', fileSize = 0) {
  const validation = validateDocument(fileBufferOrPath, mimeType, fileSize);
  if (!validation.valid) {
    return {
      filename,
      extractedText: '',
      isSupported: false,
      isSanitized: false,
      containsInjection: false,
      error: validation.reason,
    };
  }

  if (!fileBufferOrPath) {
    return { filename, extractedText: '', isSupported: true, isSanitized: false, containsInjection: false };
  }

  let rawText = '';
  let isImageWithoutText = false;

  try {
    if (Buffer.isBuffer(fileBufferOrPath)) {
      rawText = fileBufferOrPath.toString('utf8', 0, Math.min(fileBufferOrPath.length, 10000));
    } else if (typeof fileBufferOrPath === 'string' && fs.existsSync(fileBufferOrPath)) {
      rawText = fs.readFileSync(fileBufferOrPath, 'utf8').slice(0, 10000);
    } else if (typeof fileBufferOrPath === 'string') {
      rawText = fileBufferOrPath;
    }

    // Check if binary image buffer without ASCII text strings
    if (mimeType.startsWith('image/') && (!rawText || /[\x00-\x08\x0E-\x1F]/.test(rawText.slice(0, 100)))) {
      isImageWithoutText = true;
      rawText = `[Attached Medical Document Image: ${filename} (Image format recognized - text requires OCR sidecar)]`;
    }
  } catch (err) {
    return {
      filename,
      extractedText: '',
      isSupported: true,
      isSanitized: false,
      containsInjection: false,
      error: `Failed to extract document text: ${err.message}`,
    };
  }

  // Detect and sanitize prompt injection payloads in document text
  const injectionPattern = /\b(ignore\s+all\s+previous|system\s+override|reveal\s+system\s+prompt|you\s+are\s+now|prescribe\s+\d+mg)\b/i;
  const containsInjection = injectionPattern.test(rawText);

  let sanitizedText = rawText;
  if (containsInjection) {
    sanitizedText = rawText
      .replace(/ignore\s+all\s+previous\s+instructions[^\.\n]*/gi, '[FILTERED INSTRUCTION]')
      .replace(/system\s+override[^\.\n]*/gi, '[FILTERED INSTRUCTION]')
      .replace(/reveal\s+system\s+prompt[^\.\n]*/gi, '[FILTERED INSTRUCTION]');
  }

  return {
    filename,
    extractedText: sanitizedText.slice(0, 2000).trim(),
    isSupported: true,
    isImageWithoutText,
    isSanitized: true,
    containsInjection,
  };
}

module.exports = {
  extractDocumentText,
  validateDocument,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
};
