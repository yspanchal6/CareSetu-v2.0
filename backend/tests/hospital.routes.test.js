// Set test environment before loading application modules
process.env.NODE_ENV = 'test';
process.env.ALLOW_DEV_OTP = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const http = require('http');
const jwt = require('jsonwebtoken');
const prisma = require('../src/config/prisma');
const app = require('../src/app');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
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
        let parsedPayload;
        try {
          parsedPayload = JSON.parse(data);
        } catch {
          parsedPayload = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsedPayload,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body !== null) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runHospitalRoutesTests() {
  console.log('\n==================================================');
  console.log('  RUNNING CARESETU HOSPITAL ROUTES TESTS          ');
  console.log('==================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, failureDetail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (failureDetail) console.error(`     Detail: ${failureDetail}`);
      failedTests++;
    }
  }

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  try {
    // 1. Create or find test hospital user in database
    const testEmail = 'hospital_test_routes@caresetu.org';
    let user = await prisma.user.findUnique({ where: { email: testEmail }, include: { hospital: true } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          password: '$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
          role: 'HOSPITAL',
          name: 'Route Test Hospital User',
          isVerified: true,
          hospital: {
            create: {
              name: 'Route Test Hospital',
              address: '123 Test St',
              phone: '9876543210',
              email: testEmail,
              city: 'New Delhi',
              state: 'Delhi',
              isVerified: true,
              emergencyAvailable: true,
              location: { latitude: 28.6139, longitude: 77.209 },
            },
          },
        },
        include: { hospital: true },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: 'HOSPITAL' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const authHeaders = { Authorization: `Bearer ${token}` };

    // Test 1: GET /api/hospitals/stats
    const statsRes = await request('GET', '/api/hospitals/stats', null, authHeaders);
    assert(
      statsRes.status === 200 && statsRes.body.success === true && statsRes.body.stats !== undefined,
      'GET /api/hospitals/stats returns 200 with stats object (not 404)',
      `Status: ${statsRes.status}, Body: ${JSON.stringify(statsRes.body)}`
    );

    // Test 2: GET /api/hospitals/profile
    const profileRes = await request('GET', '/api/hospitals/profile', null, authHeaders);
    assert(
      profileRes.status === 200 && profileRes.body.success === true && profileRes.body.hospital !== undefined,
      'GET /api/hospitals/profile returns 200 with hospital profile (not 404)',
      `Status: ${profileRes.status}, Body: ${JSON.stringify(profileRes.body)}`
    );

    // Test 3: GET /api/hospitals/approval-event
    const approvalRes = await request('GET', '/api/hospitals/approval-event', null, authHeaders);
    assert(
      approvalRes.status === 200 && approvalRes.body.success === true && approvalRes.body.hasUnseenApproval !== undefined,
      'GET /api/hospitals/approval-event returns 200 with approval event data (not 404)',
      `Status: ${approvalRes.status}, Body: ${JSON.stringify(approvalRes.body)}`
    );

    // Test 4: GET /api/hospitals/:id with valid hospital ID
    const hospitalId = user.hospital.id;
    const detailRes = await request('GET', `/api/hospitals/${hospitalId}`);
    assert(
      detailRes.status === 200 && detailRes.body.success === true && detailRes.body.hospital.id === hospitalId,
      'GET /api/hospitals/:id returns 200 for valid hospital UUID',
      `Status: ${detailRes.status}, Body: ${JSON.stringify(detailRes.body)}`
    );

    // Test 5: GET /api/hospitals/details/:id with valid hospital ID
    const detailPrefixRes = await request('GET', `/api/hospitals/details/${hospitalId}`);
    assert(
      detailPrefixRes.status === 200 && detailPrefixRes.body.success === true && detailPrefixRes.body.hospital.id === hospitalId,
      'GET /api/hospitals/details/:id returns 200 for valid hospital UUID',
      `Status: ${detailPrefixRes.status}, Body: ${JSON.stringify(detailPrefixRes.body)}`
    );

    // Test 6: GET /api/hospitals/non-existent-uuid-999 (invalid ID)
    const invalidRes = await request('GET', '/api/hospitals/non-existent-uuid-999');
    assert(
      invalidRes.status === 404 && invalidRes.body.error === 'Hospital not found.',
      'GET /api/hospitals/non-existent-uuid-999 returns 404 Hospital not found',
      `Status: ${invalidRes.status}, Body: ${JSON.stringify(invalidRes.body)}`
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failedTests++;
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log(`  HOSPITAL TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runHospitalRoutesTests();
