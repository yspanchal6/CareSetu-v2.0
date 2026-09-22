require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function runTests() {
  console.log('====================================================');
  console.log(' CARESETU - DOCUMENT UPLOAD VALIDATION AUDIT ');
  console.log('====================================================\n');

  // Start HTTP server on random port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  function assertTest(condition, name, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${detail}`);
      failed++;
    }
  }

  // Helper to post FormData using Node.js fetch with Multipart Boundary
  async function uploadFile({ filename, mimeType, buffer, token }) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let body = [];

    // Add documentType field
    body.push(`--${boundary}\r\nContent-Disposition: form-data; name="documentType"\r\n\r\nLAB_REPORT\r\n`);

    // Add file field
    body.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`);

    const headerBuf = Buffer.from(body.join(''));
    const footerBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([headerBuf, buffer, footerBuf]);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}/api/patient/documents`, {
      method: 'POST',
      headers,
      body: payload,
    });

    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }

  try {
    const timestamp = Date.now();
    
    // Create test user & patient
    const user = await prisma.user.create({
      data: {
        email: `upload_test_${timestamp}@test.com`,
        password: 'hashedpassword',
        role: 'PATIENT',
      },
    });

    const patient = await prisma.patient.create({
      data: {
        userId: user.id,
        name: 'Upload Test Patient',
        phone: '9876543210',
        age: 30,
        gender: 'FEMALE',
      },
    });

    const token = jwt.sign({ userId: user.id, role: 'PATIENT' }, JWT_SECRET, { expiresIn: '1h' });

    // Dummy valid magic bytes
    const pdfMagic = Buffer.from('%PDF-1.4 Valid PDF content header and body structure...');
    
    // JPEG magic: 0xFF, 0xD8, 0xFF, 0xE0
    const jpegMagic = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JPEG Image Data Content')]);

    // PNG magic: 0x89, 0x50, 0x4E, 0x47
    const pngMagic = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('PNG Image Data Content')]);

    // TEST 1: Valid PDF under 10 MB → accepted (201)
    const resPdf = await uploadFile({ filename: 'test_report.pdf', mimeType: 'application/pdf', buffer: pdfMagic, token });
    assertTest(resPdf.status === 201 && resPdf.json.success === true, 'Test 1: Valid PDF under 10MB accepted (201)', `Status: ${resPdf.status}`);

    // TEST 2: Valid JPG under 10 MB → accepted (201)
    const resJpg = await uploadFile({ filename: 'scan.jpg', mimeType: 'image/jpeg', buffer: jpegMagic, token });
    assertTest(resJpg.status === 201 && resJpg.json.success === true, 'Test 2: Valid JPG under 10MB accepted (201)', `Status: ${resJpg.status}`);

    // TEST 3: Valid PNG under 10 MB → accepted (201)
    const resPng = await uploadFile({ filename: 'xray.png', mimeType: 'image/png', buffer: pngMagic, token });
    assertTest(resPng.status === 201 && resPng.json.success === true, 'Test 3: Valid PNG under 10MB accepted (201)', `Status: ${resPng.status}`);

    // TEST 4: File exactly 10 MB → accepted (201)
    const exact10MBBuffer = Buffer.alloc(10 * 1024 * 1024);
    // Write PDF magic bytes at start
    pdfMagic.copy(exact10MBBuffer, 0);
    const resExact10MB = await uploadFile({ filename: 'exact_10mb.pdf', mimeType: 'application/pdf', buffer: exact10MBBuffer, token });
    assertTest(resExact10MB.status === 201 && resExact10MB.json.success === true, 'Test 4: File exactly 10MB accepted (201)', `Status: ${resExact10MB.status}`);

    // TEST 5: File above 10 MB → rejected (400)
    const over10MBBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024); // 10MB + 1KB
    pdfMagic.copy(over10MBBuffer, 0);
    const resOver10MB = await uploadFile({ filename: 'oversized.pdf', mimeType: 'application/pdf', buffer: over10MBBuffer, token });
    assertTest(resOver10MB.status === 400 && resOver10MB.json.error?.includes('10MB'), 'Test 5: File above 10MB rejected with HTTP 400', `Status: ${resOver10MB.status}, Error: ${resOver10MB.json.error}`);

    // TEST 6: DOC / DOCX → rejected (400)
    const docxBuffer = Buffer.from('PK\x03\x04 Document content for Microsoft Word');
    const resDocx = await uploadFile({ filename: 'medical_history.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docxBuffer, token });
    assertTest(resDocx.status === 400 && resDocx.json.error?.includes('Allowed formats'), 'Test 6: DOCX file rejected with HTTP 400', `Status: ${resDocx.status}, Error: ${resDocx.json.error}`);

    // TEST 7: EXE / SVG / ZIP → rejected (400)
    const exeBuffer = Buffer.from('MZ Executable Binary File Header Content');
    const resExe = await uploadFile({ filename: 'malware.exe', mimeType: 'application/octet-stream', buffer: exeBuffer, token });
    assertTest(resExe.status === 400 && resExe.json.error?.includes('Allowed formats'), 'Test 7: EXE file rejected with HTTP 400', `Status: ${resExe.status}, Error: ${resExe.json.error}`);

    // TEST 8: Renamed invalid file (malicious.exe renamed to fake.pdf) → rejected by magic bytes signature validation (400)
    const resRenamedFake = await uploadFile({ filename: 'fake_report.pdf', mimeType: 'application/pdf', buffer: exeBuffer, token });
    assertTest(resRenamedFake.status === 400 && resRenamedFake.json.error?.includes('Allowed formats'), 'Test 8: Renamed invalid file rejected via magic bytes validation', `Status: ${resRenamedFake.status}, Error: ${resRenamedFake.json.error}`);

    // TEST 9: Invalid MIME type → rejected (400)
    const resInvalidMime = await uploadFile({ filename: 'text_file.txt', mimeType: 'text/plain', buffer: Buffer.from('Plain text content'), token });
    assertTest(resInvalidMime.status === 400 && resInvalidMime.json.error?.includes('Allowed formats'), 'Test 9: Invalid MIME type rejected with HTTP 400', `Status: ${resInvalidMime.status}, Error: ${resInvalidMime.json.error}`);

    // TEST 10: Unauthorized upload (no token) → rejected (401)
    const resUnauth = await uploadFile({ filename: 'unauth.pdf', mimeType: 'application/pdf', buffer: pdfMagic, token: null });
    assertTest(resUnauth.status === 401, 'Test 10: Unauthenticated upload rejected with HTTP 401', `Status: ${resUnauth.status}`);

    // TEST 11: Verification that errors contain no sensitive server paths
    const hasServerPath = String(resDocx.json.error || '').includes('D:\\') || String(resDocx.json.error || '').includes('/var/');
    assertTest(!hasServerPath, 'Test 11: Error messages do not expose server file paths or credentials');

    server.close();

    console.log(`\n----------------------------------------------------`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`----------------------------------------------------`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('CRITICAL ERROR DURING TEST EXECUTION:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
