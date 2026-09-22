const http = require('http');
const prisma = require('../src/config/prisma');

const BASE_URL = 'http://localhost:5000/api';

function makeRequest(path, method = 'GET', body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      if (headers['Content-Type'] && headers['Content-Type'].startsWith('multipart/form-data')) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function createMultipartBody(filename, mimeType, fileBuffer, fields = {}) {
  const boundary = '----WebKitFormBoundaryTest' + Math.random().toString(36).substring(2);
  let body = '';

  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
    body += `${value}\r\n`;
  }

  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
  body += `Content-Type: ${mimeType}\r\n\r\n`;

  const headerBuffer = Buffer.from(body, 'utf-8');
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

  const finalBuffer = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);
  return { boundary, buffer: finalBuffer };
}

async function runTests() {
  console.log(`\n==================================================`);
  console.log(`CARESETU STEP 7: POST-REGISTRATION DOCUMENT VERIFICATION TEST SUITE`);
  console.log(`==================================================\n`);

  let passCount = 0;
  let failCount = 0;

  const testEmail = `verify_doc_test_${Date.now()}@example.com`;
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testPassword = 'Password123!';

  // Clean up any pre-existing test user
  await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => {});

  // Pre-seed registration OTPs so signup passes
  await prisma.otp.create({
    data: { identifier: testEmail, otpHash: 'test', purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() }
  });
  await prisma.otp.create({
    data: { identifier: testPhone, otpHash: 'test', purpose: 'PHONE_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() }
  });

  // Step A: Register a new patient
  const regRes = await makeRequest('/auth/register', 'POST', {
    name: 'Doc Verify Patient',
    email: testEmail,
    password: testPassword,
    phone: testPhone,
    role: 'PATIENT',
    age: 28,
    gender: 'Female',
  });

  if (regRes.status !== 201 || !regRes.body.token) {
    console.error(`❌ REGISTRATION FAILED:`, regRes.body);
    process.exit(1);
  }

  const token = regRes.body.token;
  const userId = regRes.body.user.id;
  console.log(`[SETUP] Patient account created (id: ${userId}, token: JWT) ✅\n`);

  // TEST 1: Check Verification Status
  try {
    const statusRes = await makeRequest('/auth/document-verification/status', 'GET', null, token);
    if (
      statusRes.status === 200 &&
      statusRes.body.success === true &&
      statusRes.body.isVerified === false &&
      statusRes.body.role === 'PATIENT' &&
      statusRes.body.hasAllRequiredDocs === false &&
      statusRes.body.requiredDocuments.length === 1 &&
      statusRes.body.requiredDocuments[0].type === 'ID_PROOF'
    ) {
      console.log(`[TEST 1] Initial document verification status retrieved (PATIENT: isVerified=false, missing ID_PROOF) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 1] FAILED:`, statusRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 1] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 2: Upload invalid file signature
  try {
    const fakeExeBuffer = Buffer.from('MZ...fake executable content');
    const { boundary, buffer } = createMultipartBody('bad.exe', 'application/x-msdownload', fakeExeBuffer, { documentType: 'ID_PROOF' });
    const uploadRes = await makeRequest('/auth/document-verification/upload', 'POST', buffer, token, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    if (uploadRes.status === 400 && uploadRes.body.error.includes('format')) {
      console.log(`[TEST 2] Rejection of invalid file format (.exe signature) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 2] FAILED:`, uploadRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 2] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 3: Upload oversized file (> 10MB)
  try {
    const largePdfHeader = Buffer.from('%PDF-1.4 header contents\n');
    const dummyPadding = Buffer.alloc(10.5 * 1024 * 1024); // 10.5 MB
    const largeBuffer = Buffer.concat([largePdfHeader, dummyPadding]);
    const { boundary, buffer } = createMultipartBody('large.pdf', 'application/pdf', largeBuffer, { documentType: 'ID_PROOF' });
    const uploadRes = await makeRequest('/auth/document-verification/upload', 'POST', buffer, token, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    if (uploadRes.status === 400 && uploadRes.body.error.includes('10MB')) {
      console.log(`[TEST 3] Rejection of oversized file (> 10MB limit) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 3] FAILED:`, uploadRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 3] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 4: Upload valid PDF document signature (%PDF)
  let uploadedDocId = null;
  try {
    const pdfBuffer = Buffer.from('%PDF-1.4 Valid Aadhaar Card Document Payload Content');
    const { boundary, buffer } = createMultipartBody('aadhaar_card.pdf', 'application/pdf', pdfBuffer, { documentType: 'ID_PROOF' });
    const uploadRes = await makeRequest('/auth/document-verification/upload', 'POST', buffer, token, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    if (uploadRes.status === 201 && uploadRes.body.success === true && uploadRes.body.document?.id) {
      uploadedDocId = uploadRes.body.document.id;
      console.log(`[TEST 4] Successful upload of valid PDF document (ID_PROOF) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 4] FAILED:`, uploadRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 4] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 5: Request OTP without confirming checklist
  try {
    const otpReq = await makeRequest('/auth/document-verification/request-otp', 'POST', { method: 'EMAIL', confirmChecklist: false }, token);
    if (otpReq.status === 400 && (otpReq.body.error.includes('checklist') || otpReq.body.error.includes('genuine'))) {
      console.log(`[TEST 5] Rejection of OTP request without checklist confirmation ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 5] FAILED:`, otpReq.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 5] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 6: Request Email OTP with checklist confirmed
  try {
    const otpReq = await makeRequest('/auth/document-verification/request-otp', 'POST', { method: 'EMAIL', confirmChecklist: true }, token);
    if (otpReq.status === 200 && otpReq.body.success === true && otpReq.body.maskedDestination.includes('@')) {
      console.log(`[TEST 6] Email OTP requested successfully (masked: ${otpReq.body.maskedDestination}) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 6] FAILED:`, otpReq.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 6] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 7: Attempt verifying invalid OTP
  try {
    const verifyRes = await makeRequest('/auth/document-verification/verify-otp', 'POST', { otp: '000000', method: 'EMAIL' }, token);
    if (verifyRes.status === 400 && verifyRes.body.error.includes('Invalid')) {
      console.log(`[TEST 7] Rejection of invalid verification code ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 7] FAILED:`, verifyRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 7] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 8: Cancel pending OTP via Back button action
  try {
    const cancelRes = await makeRequest('/auth/document-verification/cancel', 'POST', {}, token);
    if (cancelRes.status === 200 && cancelRes.body.success === true) {
      console.log(`[TEST 8] Back button cancellation of pending verification OTP ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 8] FAILED:`, cancelRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 8] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 9: Request SMS OTP via TextBee channel
  let smsDevOtp = null;
  try {
    const otpReq = await makeRequest('/auth/document-verification/request-otp', 'POST', { method: 'SMS', confirmChecklist: true }, token);
    if (otpReq.status === 200 && otpReq.body.success === true && otpReq.body.method === 'SMS') {
      smsDevOtp = otpReq.body.devOtp;
      console.log(`[TEST 9] SMS OTP requested successfully (masked: ${otpReq.body.maskedDestination}) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 9] FAILED:`, otpReq.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 9] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 10: Successful verification of SMS OTP
  try {
    // If devOtp was returned, use it; otherwise fetch latest from DB directly
    let otpToUse = smsDevOtp;
    if (!otpToUse) {
      const otpRecord = await prisma.otp.findFirst({
        where: { identifier: testPhone, purpose: 'DOCUMENT_VERIFICATION_PHONE' },
        orderBy: { createdAt: 'desc' },
      });
      // Set hash as test code in test mode
      if (otpRecord) {
        await prisma.otp.update({ where: { id: otpRecord.id }, data: { otpHash: await require('bcrypt').hash('123456', 10) } });
        otpToUse = '123456';
      }
    }

    const verifyRes = await makeRequest('/auth/document-verification/verify-otp', 'POST', { otp: otpToUse || '123456', method: 'SMS' }, token);
    if (verifyRes.status === 200 && verifyRes.body.success === true && verifyRes.body.isVerified === true && verifyRes.body.redirectUrl.includes('/patient/dashboard')) {
      console.log(`[TEST 10] Successful Document Verification via OTP (redirectUrl: ${verifyRes.body.redirectUrl}) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 10] FAILED:`, verifyRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 10] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 11: Single-use OTP replay prevention
  try {
    const replayRes = await makeRequest('/auth/document-verification/verify-otp', 'POST', { otp: '123456', method: 'SMS' }, token);
    if (replayRes.status === 400) {
      console.log(`[TEST 11] Single-use OTP replay attempt blocked ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 11] FAILED:`, replayRes.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 11] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 12: Database persistence check
  try {
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (dbUser && dbUser.isVerified === true) {
      console.log(`[TEST 12] Database persistence confirmed (User.isVerified === true in Prisma DB) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 12] FAILED: dbUser.isVerified is false`);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 12] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 13: Doctor Role Checklist & Verification Test
  const docEmail = `doctor_doc_verify_${Date.now()}@example.com`;
  const docPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;

  await prisma.otp.create({ data: { identifier: docEmail, otpHash: 'test', purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() } });
  await prisma.otp.create({ data: { identifier: docPhone, otpHash: 'test', purpose: 'PHONE_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() } });

  const docRegRes = await makeRequest('/auth/register', 'POST', {
    name: 'Dr. Verify Specialist',
    email: docEmail,
    password: testPassword,
    phone: docPhone,
    role: 'DOCTOR',
  });

  const docToken = docRegRes.body.token;
  const docUserId = docRegRes.body.user.id;

  try {
    const docStatus = await makeRequest('/auth/document-verification/status', 'GET', null, docToken);
    if (
      docStatus.status === 200 &&
      docStatus.body.role === 'DOCTOR' &&
      docStatus.body.missingDocTypes.includes('MEDICAL_LICENSE') &&
      docStatus.body.missingDocTypes.includes('GOVT_ID')
    ) {
      console.log(`[TEST 13] Doctor multi-document requirement check (requires MEDICAL_LICENSE & GOVT_ID) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 13] FAILED:`, docStatus.body);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 13] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 14: Hospital Role Verification & Dual Persistence (User.isVerified & Hospital.isVerified)
  const hospEmail = `hospital_doc_verify_${Date.now()}@example.com`;
  const hospPhone = `96${Math.floor(10000000 + Math.random() * 90000000)}`;

  await prisma.otp.create({ data: { identifier: hospEmail, otpHash: 'test', purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() } });
  await prisma.otp.create({ data: { identifier: hospPhone, otpHash: 'test', purpose: 'PHONE_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() } });

  const hospRegRes = await makeRequest('/auth/register', 'POST', {
    name: 'CareSetu City Hospital',
    email: hospEmail,
    password: testPassword,
    phone: hospPhone,
    role: 'HOSPITAL',
    address: '100 Medical Center Drive',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    latitude: 19.076,
    longitude: 72.8777,
  });

  const hospToken = hospRegRes.body.token;
  const hospUserId = hospRegRes.body.user.id;

  try {
    // Upload required hospital documents
    const pdfBuf = Buffer.from('%PDF-1.4 Hospital Reg Certificate Content');
    const { boundary: b1, buffer: buf1 } = createMultipartBody('hosp_reg.pdf', 'application/pdf', pdfBuf, { documentType: 'REGISTRATION_CERTIFICATE' });
    await makeRequest('/auth/document-verification/upload', 'POST', buf1, hospToken, { 'Content-Type': `multipart/form-data; boundary=${b1}` });

    const { boundary: b2, buffer: buf2 } = createMultipartBody('hosp_op.pdf', 'application/pdf', pdfBuf, { documentType: 'OPERATIONAL_LICENSE' });
    await makeRequest('/auth/document-verification/upload', 'POST', buf2, hospToken, { 'Content-Type': `multipart/form-data; boundary=${b2}` });

    // Request & verify OTP
    const reqOtpRes = await makeRequest('/auth/document-verification/request-otp', 'POST', { method: 'EMAIL', confirmChecklist: true }, hospToken);
    const devOtp = reqOtpRes.body.devOtp || '123456';

    if (!reqOtpRes.body.devOtp) {
      const dbOtp = await prisma.otp.findFirst({ where: { identifier: hospEmail, purpose: 'DOCUMENT_VERIFICATION_EMAIL' } });
      if (dbOtp) {
        await prisma.otp.update({ where: { id: dbOtp.id }, data: { otpHash: await require('bcrypt').hash('123456', 10) } });
      }
    }

    const verifyHosp = await makeRequest('/auth/document-verification/verify-otp', 'POST', { otp: devOtp, method: 'EMAIL' }, hospToken);

    const dbUserHosp = await prisma.user.findUnique({ where: { id: hospUserId }, include: { hospital: true } });

    if (
      verifyHosp.status === 200 &&
      verifyHosp.body.redirectUrl === '/hospital/dashboard' &&
      dbUserHosp?.isVerified === true &&
      dbUserHosp?.hospital?.isVerified === true
    ) {
      console.log(`[TEST 14] Hospital verification & dual DB persistence (User.isVerified & Hospital.isVerified) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 14] FAILED:`, verifyHosp.body, dbUserHosp);
      failCount++;
    }
  } catch (err) {
    console.error(`[TEST 14] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 15: Skip Document Verification Flow
  const skipUserEmail = `skip_test_${Date.now()}@example.com`;
  try {
    const skipRegRes = await makeRequest('/auth/register', 'POST', {
      name: 'Skip Verification User',
      email: skipUserEmail,
      password: testPassword,
      confirmPassword: testPassword,
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      role: 'PATIENT',
      age: 29,
      gender: 'Male',
    });

    const skipToken = skipRegRes.body.token;
    const skipUserId = skipRegRes.body.user.id;

    const skipRes = await makeRequest('/auth/document-verification/skip', 'POST', {}, skipToken);
    const dbUserSkip = await prisma.user.findUnique({ where: { id: skipUserId } });

    if (
      skipRes.status === 200 &&
      skipRes.body.success === true &&
      skipRes.body.isVerified === false &&
      skipRes.body.redirectUrl === '/patient/dashboard' &&
      dbUserSkip?.isVerified === false
    ) {
      console.log(`[TEST 15] Skip Document Verification Flow (User remains isVerified=false, redirectUrl: /patient/dashboard) ... PASSED ✅`);
      passCount++;
    } else {
      console.error(`[TEST 15] FAILED:`, skipRes.body, dbUserSkip);
      failCount++;
    }

    await prisma.user.delete({ where: { id: skipUserId } }).catch(() => {});
  } catch (err) {
    console.error(`[TEST 15] EXCEPTION:`, err.message);
    failCount++;
  }

  // TEST 16: Clean up test documents & records
  try {
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail, docEmail, hospEmail] } },
    });
    console.log(`[TEST 16] Test data teardown & cleanup ... PASSED ✅`);
    passCount++;
  } catch (err) {
    console.error(`[TEST 16] EXCEPTION:`, err.message);
    failCount++;
  }

  console.log(`\n==================================================`);
  console.log(`TEST RESULTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`==================================================\n`);


  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
