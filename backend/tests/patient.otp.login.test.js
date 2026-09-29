// Set test environment before loading application modules
process.env.NODE_ENV = 'test';
process.env.ALLOW_DEV_OTP = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const http = require('http');
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

async function runPatientOtpLoginTests() {
  console.log('\n==================================================');
  console.log('  RUNNING PATIENT LOGIN OTP INTEGRATION TESTS      ');
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
    const testEmail = 'patient_otp_test@caresetu.org';

    // 1. Create test patient user if not exists
    let user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          password: '$2b$10$abcdefghijklmnopqrstuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
          role: 'PATIENT',
          name: 'OTP Test Patient',
          isVerified: true,
          patient: {
            create: {
              name: 'OTP Test Patient',
              age: 30,
              gender: 'Male',
              phone: '9876543210',
            },
          },
        },
      });
    }

    // Test 1: Unauthenticated request to POST /api/auth/request-otp (Email)
    const requestRes = await request('POST', '/api/auth/request-otp', {
      identifier: testEmail,
      type: 'email',
    });

    assert(
      requestRes.status === 200 && requestRes.body.success === true,
      'POST /api/auth/request-otp accepts unauthenticated email request and returns 200 OK (Not 401)',
      `Status: ${requestRes.status}, Body: ${JSON.stringify(requestRes.body)}`
    );

    const devOtp = requestRes.body.devOtp;
    assert(
      !!devOtp,
      'Dev OTP is generated and returned in test environment for mock verification',
      `DevOtp: ${devOtp}`
    );

    // Test 2: Unauthenticated request to POST /api/auth/verify-otp
    const verifyRes = await request('POST', '/api/auth/verify-otp', {
      identifier: testEmail,
      otpCode: devOtp,
      purpose: 'LOGIN',
    });

    assert(
      verifyRes.status === 200 && verifyRes.body.success === true && !!verifyRes.body.token,
      'POST /api/auth/verify-otp verifies OTP and returns JWT auth token for patient',
      `Status: ${verifyRes.status}, Body: ${JSON.stringify(verifyRes.body)}`
    );

    // Test 3: Unauthenticated request to POST /api/auth/request-otp (Phone)
    const phoneRes = await request('POST', '/api/auth/request-otp', {
      identifier: '9876543210',
      type: 'phone',
    });

    assert(
      phoneRes.status === 200 && phoneRes.body.success === true,
      'POST /api/auth/request-otp accepts unauthenticated phone request and returns 200 OK (Not 401)',
      `Status: ${phoneRes.status}, Body: ${JSON.stringify(phoneRes.body)}`
    );

  } catch (err) {
    console.error('Test execution error:', err);
    failedTests++;
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log(`  PATIENT OTP TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPatientOtpLoginTests();
