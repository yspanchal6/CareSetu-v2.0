const assert = require('assert');
const http = require('http');

const BASE_URL = process.env.API_BASE || 'http://localhost:3000';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runGuestSecurityTests() {
  console.log('==================================================');
  console.log('CARESETU GUEST ACCOUNT SECURITY & ACCESS CONTROL TESTS');
  console.log('==================================================\n');

  let guestToken = null;
  let guestUser = null;
  let emergencyCaseId = null;

  // 1. Guest Session Creation
  try {
    console.log('[Test 1] Creating Guest Session via POST /api/auth/guest-session...');
    const res = await makeRequest('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status !== 200) {
      console.error('Response details:', res.status, res.body);
    }

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert.ok(res.body.token, 'Expected token in guest session response');
    assert.strictEqual(res.body.user.role, 'GUEST', 'Expected role GUEST');
    assert.strictEqual(res.body.user.isGuest, true, 'Expected isGuest true');

    guestToken = res.body.token;
    guestUser = res.body.user;
    console.log(`  ✓ SUCCESS: Guest Session created. ID: ${guestUser.id}, Token: ${guestToken.substring(0, 20)}...`);
  } catch (err) {
    console.error('  ✗ FAILED Test 1:', err);
    process.exit(1);
  }

  // 2. Verify getMe for Guest User
  try {
    console.log('\n[Test 2] Verifying GET /api/auth/me for Guest Session...');
    const res = await makeRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert.strictEqual(res.body.isGuest, true, 'Expected isGuest true in me payload');
    assert.strictEqual(res.body.role, 'GUEST', 'Expected role GUEST in me payload');
    console.log('  ✓ SUCCESS: getMe correctly identifies Guest User.');
  } catch (err) {
    console.error('  ✗ FAILED Test 2:', err.message);
    process.exit(1);
  }

  // 3. Guest Doctor AI Normal Chat
  try {
    console.log('\n[Test 3] Testing Guest Doctor AI Chat (POST /api/chat/send)...');
    const res = await makeRequest('/api/chat/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: { message: 'I have a mild headache and fever. What should I do?' },
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert.ok(res.body.reply, 'Expected reply in AI chat response');
    assert.strictEqual(res.body.isEmergency, false, 'Expected isEmergency false');
    console.log(`  ✓ SUCCESS: Guest AI text chat response received: "${res.body.reply.substring(0, 60)}..."`);
  } catch (err) {
    console.error('  ✗ FAILED Test 3:', err.message);
    process.exit(1);
  }

  // 4. Guest Doctor AI Red-Flag Emergency Detection
  try {
    console.log('\n[Test 4] Testing Guest Doctor AI Emergency Red-Flag Detection...');
    const res = await makeRequest('/api/chat/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: { message: 'Severe chest pain radiating to left arm and sweating profusely' },
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert.strictEqual(res.body.isEmergency, true, 'Expected red-flag emergency detection');
    assert.ok(res.body.detectedWords, 'Expected detected emergency words');
    console.log(`  ✓ SUCCESS: Emergency red flags triggered correctly for Guest AI. Severity: ${res.body.severity}`);
  } catch (err) {
    console.error('  ✗ FAILED Test 4:', err.message);
    process.exit(1);
  }

  // 5. Guest Emergency SOS Trigger
  try {
    console.log('\n[Test 5] Testing Guest Emergency SOS (POST /api/emergency/sos)...');
    const res = await makeRequest('/api/emergency/sos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: {
        symptoms: 'Guest Emergency Test - Chest discomfort',
        emergencyType: 'CARDIAC',
        severity: 'CRITICAL',
        location: { latitude: 19.0760, longitude: 72.8777, source: 'GPS' },
        idempotencyKey: `guest-test-${Date.now()}`,
      },
    });

    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}`);
    assert.ok(res.body.publicCaseId || res.body.caseId, 'Expected case ID in emergency response');
    emergencyCaseId = res.body.publicCaseId || res.body.caseId;
    console.log(`  ✓ SUCCESS: Guest Emergency SOS created. Case ID: ${emergencyCaseId}`);
  } catch (err) {
    console.error('  ✗ FAILED Test 5:', err.message);
    process.exit(1);
  }

  // 6. Guest Document Upload Denial (Chat OCR / Document Upload)
  try {
    console.log('\n[Test 6] Testing Backend Guest Denial on Document Upload (POST /api/chat/upload-document)...');
    const res = await makeRequest('/api/chat/upload-document', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: {},
    });

    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden, got ${res.status}`);
    assert.strictEqual(res.body.code, 'GUEST_RESTRICTED', 'Expected code GUEST_RESTRICTED');
    console.log(`  ✓ SUCCESS: Backend rejected Guest document upload (403 Forbidden). Message: "${res.body.message}"`);
  } catch (err) {
    console.error('  ✗ FAILED Test 6:', err.message);
    process.exit(1);
  }

  // 7. Guest Document Verification Route Denial
  try {
    console.log('\n[Test 7] Testing Backend Guest Denial on Document Verification (POST /api/auth/document-verification/upload)...');
    const res = await makeRequest('/api/auth/document-verification/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: {},
    });

    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden, got ${res.status}`);
    assert.strictEqual(res.body.code, 'GUEST_RESTRICTED');
    console.log('  ✓ SUCCESS: Backend rejected Guest document verification (403 Forbidden).');
  } catch (err) {
    console.error('  ✗ FAILED Test 7:', err.message);
    process.exit(1);
  }

  // 8. Guest HealthPack & Medical Document Retrieval Denial
  try {
    console.log('\n[Test 8] Testing Backend Guest Denial on HealthPack/Medical Document Access (GET /api/documents/patient/my-documents)...');
    const res = await makeRequest('/api/documents/patient/my-documents', {
      headers: {
        Authorization: `Bearer ${guestToken}`,
      },
    });

    assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden, got ${res.status}`);
    assert.strictEqual(res.body.code, 'GUEST_RESTRICTED');
    console.log('  ✓ SUCCESS: Backend rejected Guest HealthPack/Medical document access (403 Forbidden).');
  } catch (err) {
    console.error('  ✗ FAILED Test 8:', err.message);
    process.exit(1);
  }

  // 9. Guest Privileged Portals Denial (Doctor / Hospital / Admin)
  try {
    console.log('\n[Test 9] Testing Backend Guest Denial on Doctor/Hospital/Admin routes...');
    const docRes = await makeRequest('/api/doctors/profile', {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    assert.strictEqual(docRes.status, 403, `Doctor route should return 403, got ${docRes.status}`);
    assert.strictEqual(docRes.body.code, 'GUEST_RESTRICTED');

    const hospRes = await makeRequest('/api/hospitals/capacity', {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    assert.strictEqual(hospRes.status, 403, `Hospital route should return 403, got ${hospRes.status}`);
    assert.strictEqual(hospRes.body.code, 'GUEST_RESTRICTED');

    const adminRes = await makeRequest('/api/admin/users', {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    assert.strictEqual(adminRes.status, 403, `Admin route should return 403, got ${adminRes.status}`);
    assert.strictEqual(adminRes.body.code, 'GUEST_RESTRICTED');

    console.log('  ✓ SUCCESS: All privileged portals (Doctor, Hospital, Admin) rejected Guest Session (403 Forbidden).');
  } catch (err) {
    console.error('  ✗ FAILED Test 9:', err.message);
    process.exit(1);
  }

  // 10. Registered User Retention Verification
  try {
    console.log('\n[Test 10] Verifying Registered User functionality is preserved...');

    // Perform registration to get a registered user token
    const testEmail = `registered_test_${Date.now()}@example.com`;
    const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    const prisma = require('../src/config/prisma');
    await prisma.otp.create({
      data: { identifier: testEmail.toLowerCase(), otpHash: 'test', purpose: 'EMAIL_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() }
    });
    await prisma.otp.create({
      data: { identifier: testPhone, otpHash: 'test', purpose: 'PHONE_VERIFICATION', expiresAt: new Date(Date.now() + 300000), verifiedAt: new Date() }
    });

    const regRes = await makeRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Test Registered Patient',
        email: testEmail,
        phone: testPhone,
        password: 'Password123!',
        role: 'PATIENT',
        age: 30,
        gender: 'MALE',
      },
    });

    if (regRes.status !== 201) {
      console.error('Registration failure details:', regRes.status, regRes.body);
    }
    assert.strictEqual(regRes.status, 201, `Registration expected 201, got ${regRes.status}`);
    const regToken = regRes.body.token;

    // Verify registered user can access settings profile GET
    const profileRes = await makeRequest('/api/settings/profile', {
      headers: { Authorization: `Bearer ${regToken}` },
    });
    assert.strictEqual(profileRes.status, 200, `Registered profile expected 200, got ${profileRes.status}`);

    console.log('  ✓ SUCCESS: Registered users maintain full functionality and pass permissions.');
  } catch (err) {
    console.error('  ✗ FAILED Test 10:', err.message);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('ALL GUEST SECURITY & ACCESS CONTROL TESTS PASSED (10/10) [GREEN]');
  console.log('==================================================\n');
}

runGuestSecurityTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
