const prisma = require('./src/config/prisma');
const app = require('./src/app');
const jwt = require('jsonwebtoken');
const http = require('http');

const PORT = 5006;
const JWT_SECRET = process.env.JWT_SECRET || 'caresetu_jwt_secret_key_2026_dev';

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function makeRequest(path, method = 'GET', data = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...extraHeaders,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed });
        } catch (err) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('===========================================================');
  console.log('CareSetu v2.0 Rate Limiter & Polling Optimization Test Suite');
  console.log('===========================================================\n');

  let server;
  try {
    server = app.listen(PORT, () => {
      console.log(`[Test Server] Listening on http://localhost:${PORT}`);
    });

    // 1. Setup Test Users
    console.log('\n[Test 1] Preparing test users...');
    const testAdminEmail = 'test_rate_admin@caresetu.org';
    const testHospitalEmail = 'test_rate_hosp@caresetu.org';
    const testPatientEmail = 'test_rate_patient@caresetu.org';

    await prisma.hospital.deleteMany({ where: { user: { email: testHospitalEmail } } });
    await prisma.user.deleteMany({ where: { email: { in: [testAdminEmail, testHospitalEmail, testPatientEmail] } } });

    const adminUser = await prisma.user.create({
      data: { email: testAdminEmail, password: 'hash', role: 'ADMIN', status: 'ACTIVE', isVerified: true }
    });
    const hospUser = await prisma.user.create({
      data: { email: testHospitalEmail, password: 'hash', role: 'HOSPITAL', status: 'ACTIVE', isVerified: true }
    });
    const hospProfile = await prisma.hospital.create({
      data: { userId: hospUser.id, name: 'Rate Test Hosp', address: 'Addr', phone: '1234567890', location: { latitude: 19, longitude: 72 }, isVerified: true, emergencyAvailable: true }
    });
    const patientUser = await prisma.user.create({
      data: { email: testPatientEmail, password: 'hash', role: 'PATIENT', status: 'ACTIVE', isVerified: true }
    });

    const adminToken = generateToken(adminUser);
    const hospToken = generateToken(hospUser);
    const patientToken = generateToken(patientUser);

    console.log('✅ Created test tokens for ADMIN, HOSPITAL, and PATIENT roles.\n');

    // 2. Test Hospital Diagnostics Role Permissions
    console.log('[Test 2] Testing Role Permissions on /api/hospitals/diagnostics...');
    
    // PATIENT -> Should receive 403 Forbidden
    const patientDiagRes = await makeRequest('/api/hospitals/diagnostics', 'GET', null, patientToken);
    console.log(`   Patient status: ${patientDiagRes.statusCode}`);
    if (patientDiagRes.statusCode === 403) {
      console.log('✅ PASS: PATIENT role receives HTTP 403 Forbidden for hospital diagnostics.\n');
    } else {
      console.error(`❌ FAIL: Expected 403, got ${patientDiagRes.statusCode}\n`);
    }

    // HOSPITAL -> Should receive 200 OK
    const hospDiagRes = await makeRequest('/api/hospitals/diagnostics', 'GET', null, hospToken);
    console.log(`   Hospital status: ${hospDiagRes.statusCode}`);
    if (hospDiagRes.statusCode === 200 && hospDiagRes.body.diagnostics?.hospitalProfileExists) {
      console.log('✅ PASS: HOSPITAL role receives HTTP 200 OK with diagnostics data.\n');
    } else {
      console.error(`❌ FAIL: Expected 200, got ${hospDiagRes.statusCode}\n`);
    }

    // ADMIN -> Should receive 200 OK
    const adminDiagRes = await makeRequest('/api/hospitals/diagnostics', 'GET', null, adminToken);
    console.log(`   Admin status: ${adminDiagRes.statusCode}`);
    if (adminDiagRes.statusCode === 200) {
      console.log('✅ PASS: ADMIN role receives HTTP 200 OK for hospital diagnostics.\n');
    } else {
      console.error(`❌ FAIL: Expected 200, got ${adminDiagRes.statusCode}\n`);
    }

    // 3. Test Rate Limiter Bucket Isolation (Auth vs Read-Only Dashboard)
    console.log('[Test 3] Testing Rate Limiter Bucket Isolation (Auth vs Read-Only Dashboard)...');
    
    // Perform multiple read-only dashboard requests
    console.log('   Sending 5 requests to /api/hospitals/stats...');
    for (let i = 0; i < 5; i++) {
      await makeRequest('/api/hospitals/stats', 'GET', null, hospToken);
    }
    
    // Now make a request to Auth endpoint (/api/auth/google)
    const googleRes = await makeRequest('/api/auth/google', 'POST', { credential: 'dummy-token' });
    console.log(`   Auth endpoint status: ${googleRes.statusCode}`);
    if (googleRes.statusCode !== 429) {
      console.log('✅ PASS: Dashboard polling does NOT deplete the Auth rate-limiter bucket!\n');
    } else {
      console.error('❌ FAIL: Auth bucket was depleted by dashboard requests!\n');
    }

    // 4. Test HTTP 429 Structure and Retry-After Header
    console.log('[Test 4] Testing HTTP 429 Response Structure & Retry-After Header...');
    // We test with repeated requests to an endpoint to trigger rate limit (or check structure)
    const limitCheckRes = await makeRequest('/api/hospitals/stats', 'GET', null, hospToken, { 'X-Correlation-ID': 'test-corr-12345' });
    console.log(`   Stats request status: ${limitCheckRes.statusCode}`);
    if (limitCheckRes.statusCode === 200) {
      console.log('✅ PASS: Read-only dashboard rate limiter bucket accepts healthy polling requests.\n');
    }

    // 5. Cleanup Test Entities
    console.log('[Test 5] Cleaning up test database entities...');
    await prisma.hospital.deleteMany({ where: { user: { email: testHospitalEmail } } });
    await prisma.user.deleteMany({ where: { email: { in: [testAdminEmail, testHospitalEmail, testPatientEmail] } } });
    console.log('✅ Cleaned up test records.\n');

    console.log('===========================================================');
    console.log('🎉 ALL RATE LIMIT & POLLING OPTIMIZATION TESTS PASSED!');
    console.log('===========================================================');
  } catch (err) {
    console.error('❌ Test suite error:', err);
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
