# CARESETU — MEDICAL DOCUMENT UPLOAD VALIDATION AUDIT REPORT

**Date:** September 18, 2026  
**Project:** CareSetu — HealthPack Document Management  
**Target:** Medical Document Upload Validation & Security Enforcement  

---

## 1. Executive Summary & Requirements Overview

The HealthPack document upload system has been updated with strict file extension, MIME type, file size boundary, and binary magic bytes signature validation across both frontend and backend layers.

### Validation Rules Enforced
1. **Allowed Formats:** Only `.pdf`, `.jpg`, `.jpeg`, and `.png` files (`application/pdf`, `image/jpeg`, `image/png`, `image/jpg`).
2. **File Size Boundary:** Maximum 10 MB per file (`10 * 1024 * 1024` = 10,485,760 bytes). Files up to 10 MB are accepted; files > 10 MB are rejected with `HTTP 400`.
3. **Binary Signature Verification (Magic Bytes):**
   - PDF: `%PDF-` (`0x25, 0x50, 0x44, 0x46`)
   - JPEG: `0xFF, 0xD8, 0xFF`
   - PNG: `0x89, 0x50, 0x4E, 0x47` (`\x89PNG`)
4. **Client MIME Type Untrust:** Renamed executables or documents (e.g. `malware.exe` renamed to `fake.pdf`) are rejected via magic bytes header inspection.

---

## 2. Technical Modifications

### A. Backend Implementation
- **[`backend/src/services/medical-document.service.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/services/medical-document.service.js):**
  - Added `validateFileSignature(buffer, originalname)` to verify magic bytes against file extensions.
  - Implemented 10MB size limit check (`file.size > 10 * 1024 * 1024`).
  - Added strict extension whitelist (`['.pdf', '.jpg', '.jpeg', '.png']`).
- **[`backend/src/routes/medical-document.routes.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/routes/medical-document.routes.js):**
  - Configured Multer `limits: { fileSize: 10 * 1024 * 1024 }` and `fileFilter`.
  - Added `handleMulterUpload` middleware to catch Multer `LIMIT_FILE_SIZE` and format errors, returning `HTTP 400` with clear, safe error messages (`"File size exceeds maximum allowed limit of 10MB."` or `"Invalid file format. Allowed formats: PDF, JPG, PNG."`).
- **[`backend/src/controllers/medical-document.controller.js`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/backend/src/controllers/medical-document.controller.js):**
  - Ensured format and size validation errors return `HTTP 400 Bad Request` without exposing server filesystem paths or tracebacks.

### B. Frontend Implementation
- **[`frontend/src/pages/patient/UploadDocumentsPage.tsx`](file:///d:/2_YASH/SIH/CareSetu/CareSetu-demo/frontend/src/pages/patient/UploadDocumentsPage.tsx):**
  - Updated `<input type="file">` element with `accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"`.
  - Updated UI notice: `"Allowed formats: PDF, JPG, PNG | Maximum size: 10 MB"`.
  - Implemented pre-upload file extension, MIME type, and 10MB boundary validation in `handleFiles()` to prevent invalid files from being sent to the server.

---

## 3. Test Verification & Audit Results

### Test Suite: `backend/scratch/test_document_upload_validation.js`

Executed via `node backend/scratch/test_document_upload_validation.js`:

| # | Test Scenario | Expected Status | Actual Status | Result |
|---|---------------|-----------------|---------------|--------|
| 1 | Valid PDF under 10 MB | 201 Created | 201 Created | ✅ PASS |
| 2 | Valid JPG under 10 MB | 201 Created | 201 Created | ✅ PASS |
| 3 | Valid PNG under 10 MB | 201 Created | 201 Created | ✅ PASS |
| 4 | File exactly 10 MB (10,485,760 bytes) | 201 Created | 201 Created | ✅ PASS |
| 5 | File above 10 MB (10MB + 1KB) | 400 Bad Request | 400 Bad Request | ✅ PASS |
| 6 | DOC / DOCX document | 400 Bad Request | 400 Bad Request | ✅ PASS |
| 7 | EXE / SVG / ZIP file | 400 Bad Request | 400 Bad Request | ✅ PASS |
| 8 | Renamed invalid file (`exe` disguised as `.pdf`) | 400 Bad Request | 400 Bad Request | ✅ PASS |
| 9 | Invalid MIME type (`text/plain`) | 400 Bad Request | 400 Bad Request | ✅ PASS |
| 10 | Unauthenticated upload request | 401 Unauthorized | 401 Unauthorized | ✅ PASS |
| 11 | Error log & response privacy | No server paths | No server paths | ✅ PASS |

**Final Audit Result:** 11 PASSED, 0 FAILED (100% Success Rate).

---

## 4. Build Validation
- **Frontend TypeScript & Vite Build (`npm run build`):** Built successfully in 12.75s with exit code `0`.
