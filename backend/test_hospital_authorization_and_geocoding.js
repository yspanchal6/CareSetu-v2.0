const http = require('http');
const prisma = require('./src/config/prisma');
const app = require('./src/app');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

let server;
let baseUrl;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method: method.toUpperCase(),
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runRoleAuthAndGeocodingTests() {
  console.log('=== STARTING HOSPITAL AUTHORIZATION, ROLE ROUTING & GEOCODING TESTS ===\n');
  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }

  // Start HTTP server on dynamic port
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  try {
    const timestamp = Date.now();
    const patientEmail = `test_patient_${timestamp}@caresetu.local`;
    const hospitalEmail = `test_hosp_auth_${timestamp}@caresetu.local`;
    const adminEmail = `test_admin_auth_${timestamp}@caresetu.local`;

    // 1. Create Patient User in DB
    const patientUser = await prisma.user.create({
      data: {
        email: patientEmail,
        password: 'hash_patient_pass',
        role: 'PATIENT',
        status: 'ACTIVE',
      },
    });

    // 2. Create Hospital User & Profile in DB
    const hospitalUser = await prisma.user.create({
      data: {
        email: hospitalEmail,
        password: 'hash_hosp_pass',
        role: 'HOSPITAL',
        status: 'ACTIVE',
      },
    });

    const hospitalProfile = await prisma.hospital.create({
      data: {
        userId: hospitalUser.id,
        name: 'Auth Test Hospital',
        address: '456 Emergency Way',
        phone: '9876543210',
        city: 'Delhi',
        state: 'Delhi',
        location: { latitude: 28.6139, longitude: 77.2090 },
        isVerified: true,
        emergencyAvailable: true,
      },
    });

    // 3. Create Admin User in DB
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: 'hash_admin_pass',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    // Generate Tokens using jwt
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';
    const patientToken = jwt.sign({ userId: patientUser.id, email: patientUser.email, role: patientUser.role }, secret, { expiresIn: '1h' });
    const hospitalToken = jwt.sign({ userId: hospitalUser.id, email: hospitalUser.email, role: hospitalUser.role, hospitalId: hospitalProfile.id }, secret, { expiresIn: '1h' });
    const adminToken = jwt.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, secret, { expiresIn: '1h' });

    console.log('--- Test Case 1: Authorization Rejection for PATIENT accessing Hospital APIs ---');
    const resPatientHospProfile = await makeRequest('GET', '/api/hospitals/profile', null, { Authorization: `Bearer ${patientToken}` });

    assert(resPatientHospProfile.status === 403, 'PATIENT requesting GET /api/hospitals/profile returns HTTP 403 Forbidden');
    assert(resPatientHospProfile.body?.error?.includes('Insufficient permissions'), 'Returns clear permission error message');

    const resPatientSubmitOnboarding = await makeRequest('POST', '/api/hospitals/submit-onboarding', { name: 'Fake Hospital' }, { Authorization: `Bearer ${patientToken}` });

    assert(resPatientSubmitOnboarding.status === 403, 'PATIENT requesting POST /api/hospitals/submit-onboarding returns HTTP 403 Forbidden');

    const resPatientStats = await makeRequest('GET', '/api/hospitals/stats', null, { Authorization: `Bearer ${patientToken}` });

    assert(resPatientStats.status === 403, 'PATIENT requesting GET /api/hospitals/stats returns HTTP 403 Forbidden');

    console.log('\n--- Test Case 2: Authorized Access for HOSPITAL user ---');
    const resHospProfile = await makeRequest('GET', '/api/hospitals/profile', null, { Authorization: `Bearer ${hospitalToken}` });

    assert(resHospProfile.status === 200, 'HOSPITAL requesting GET /api/hospitals/profile returns HTTP 200 OK');
    assert(resHospProfile.body?.hospital?.id === hospitalProfile.id, 'Returns own hospital profile details');

    const resHospDiag = await makeRequest('GET', '/api/hospitals/diagnostics', null, { Authorization: `Bearer ${hospitalToken}` });

    assert(resHospDiag.status === 200, 'HOSPITAL requesting GET /api/hospitals/diagnostics returns HTTP 200 OK');
    assert(resHospDiag.body?.diagnostics?.databaseRole === 'HOSPITAL', 'Diagnostics reports databaseRole as HOSPITAL');
    assert(resHospDiag.body?.diagnostics?.hospitalProfileExists === true, 'Diagnostics confirms hospitalProfileExists');

    console.log('\n--- Test Case 3: Reverse Geocoding Parameter & Range Validation ---');
    const resValidGeocode = await makeRequest('GET', '/api/geocoding/reverse?lat=28.6139&lng=77.2090');

    assert(resValidGeocode.status === 200, 'Reverse geocoding with valid lat/lng returns HTTP 200 OK');
    assert(resValidGeocode.body?.success === true, 'Response payload has success: true');
    assert(resValidGeocode.body?.latitude === 28.6139, 'Response returns requested numeric latitude');

    const resInvalidLat = await makeRequest('GET', '/api/geocoding/reverse?lat=195.0&lng=77.2090');

    assert(resInvalidLat.status === 400, 'Reverse geocoding with lat > 90 returns HTTP 400 Bad Request');
    assert(resInvalidLat.body?.error?.includes('latitude'), 'Returns descriptive latitude error message');

    const resMissingParams = await makeRequest('GET', '/api/geocoding/reverse');

    assert(resMissingParams.status === 400, 'Reverse geocoding with missing parameters returns HTTP 400 Bad Request');
    assert(resMissingParams.body?.error?.includes('required'), 'Returns missing parameters error message');

    console.log('\n--- Test Case 4: Google Registration Role Persistence ---');
    const googleAuthService = require('./src/services/google-auth.service');
    const syntheticToken = `synthetic-google-token-${timestamp}:google.hosp.${timestamp}@example.com:Google Hosp User:sub-hosp-${timestamp}`;

    const { user: regUser, isNewUser } = await googleAuthService.registerGoogleUser({
      idToken: syntheticToken,
      requestedRole: 'HOSPITAL',
      profileData: { phone: '9998887776', city: 'Mumbai' },
    });

    assert(isNewUser === true, 'Google registration flags user as new user');
    assert(regUser.role === 'HOSPITAL', 'Google registration persists requestedRole = HOSPITAL in database');
    assert(!!regUser.hospital, 'Google registration automatically creates linked Hospital model');

    // Subsequent login check
    const { user: loginUser } = await googleAuthService.authenticateGoogleLogin({
      idToken: syntheticToken,
    });
    assert(loginUser.role === 'HOSPITAL', 'Subsequent Google login preserves existing HOSPITAL role');

    console.log('\n--- Test Case 5: Admin Role Correction Workflow ---');
    const resRoleChange = await makeRequest('POST', `/api/admin/users/${patientUser.id}/change-role`, { newRole: 'HOSPITAL', reason: 'User requested hospital onboarding fix' }, { Authorization: `Bearer ${adminToken}` });

    assert(resRoleChange.status === 200, 'Admin role correction endpoint returns HTTP 200 OK');
    assert(resRoleChange.body?.user?.role === 'HOSPITAL', 'User role updated to HOSPITAL in database');

    const recheckUser = await prisma.user.findUnique({ where: { id: patientUser.id } });
    assert(recheckUser.role === 'HOSPITAL', 'Database record confirmed role = HOSPITAL');

    // Cleanup
    await prisma.auditLog.deleteMany({ where: { userId: { in: [patientUser.id, hospitalUser.id, adminUser.id, regUser.id] } } });
    await prisma.hospital.deleteMany({ where: { userId: { in: [hospitalUser.id, patientUser.id, regUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [patientUser.id, hospitalUser.id, adminUser.id, regUser.id] } } });
    console.log('\nCleaned up test data.');

  } catch (err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    console.log(`\n=== SUMMARY: Passed: ${passCount}, Failed: ${failCount} ===`);
  }
}

runRoleAuthAndGeocodingTests();
