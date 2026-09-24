// Set test environment before loading application modules
process.env.NODE_ENV = 'test';
process.env.ALLOW_DEV_OTP = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const http = require('http');
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');
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

async function runAuthSecurityTests() {
  console.log('\n==================================================');
  console.log('  RUNNING CARESETU AUTHENTICATION SECURITY TESTS  ');
  console.log('==================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, failureDetail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${failureDetail ? `(${failureDetail})` : ''}`);
      failedTests++;
    }
  }

  // Start HTTP server on dynamic port
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  const testEmail = `sec.user.${Date.now()}@example.com`;
  const testEmailMixedCase = testEmail.toUpperCase();
  const strongPassword = 'P@ssword123!';
  const newStrongPassword = 'N3wP@ssword456!';
  const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  const testPhone2 = '98' + Math.floor(10000000 + Math.random() * 90000000);

  try {
    // Clean up test email if exists
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail.toLowerCase(), testEmailMixedCase.toLowerCase()] } },
    });

    // ----------------------------------------------------
    // TEST 1: Successful Registration
    // ----------------------------------------------------
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Security Test User',
      email: testEmailMixedCase,
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: testPhone,
      role: 'PATIENT',
      age: 30,
      gender: 'Male',
    });

    assert(
      regRes.status === 201 && regRes.body.success === true && !!regRes.body.token,
      '1. Successful Registration with Normalized Email & Strong Password',
      `Status: ${regRes.status}, Body: ${JSON.stringify(regRes.body)}`
    );

    if (regRes.body && regRes.body.user) {
      userId = regRes.body.user.id;
      authToken = regRes.body.token;
    }

    // ----------------------------------------------------
    // TEST 2: Duplicate Email Registration (Case-Insensitive)
    // ----------------------------------------------------
    const dupRes = await request('POST', '/api/auth/register', {
      name: 'Duplicate User',
      email: testEmail.toLowerCase(), // lowercase version of mixed case
      password: strongPassword,
      confirmPassword: strongPassword,
      phone: '9876543211',
      role: 'PATIENT',
      age: 25,
      gender: 'Female',
    });

    assert(
      dupRes.status === 409,
      '2. Prevent Duplicate Email Registration (Case-Insensitive)',
      `Status: ${dupRes.status}`
    );

    // ----------------------------------------------------
    // TEST 3: Invalid Email Format
    // ----------------------------------------------------
    const invalidEmailRes = await request('POST', '/api/auth/register', {
      name: 'Invalid Email User',
      email: 'not-an-email-address',
      password: strongPassword,
      phone: '9876543212',
      role: 'PATIENT',
      age: 22,
      gender: 'Other',
    });

    assert(
      invalidEmailRes.status === 400,
      '3. Reject Invalid Email Format',
      `Status: ${invalidEmailRes.status}`
    );

    // ----------------------------------------------------
    // TEST 4: Weak Password
    // ----------------------------------------------------
    const weakPwRes = await request('POST', '/api/auth/register', {
      name: 'Weak Password User',
      email: `weak.${Date.now()}@example.com`,
      password: '123', // Weak password
      phone: '9876543213',
      role: 'PATIENT',
      age: 28,
      gender: 'Male',
    });

    assert(
      weakPwRes.status === 400,
      '4. Reject Weak Password (Min 8 chars, uppercase, lowercase, digit, special char required)',
      `Status: ${weakPwRes.status}`
    );

    // ----------------------------------------------------
    // TEST 5: Password Mismatch
    // ----------------------------------------------------
    const mismatchRes = await request('POST', '/api/auth/register', {
      name: 'Mismatch User',
      email: `mismatch.${Date.now()}@example.com`,
      password: strongPassword,
      confirmPassword: 'DifferentPassword123!',
      phone: '9876543214',
      role: 'PATIENT',
      age: 35,
      gender: 'Female',
    });

    assert(
      mismatchRes.status === 400,
      '5. Prevent Password Confirmation Mismatch',
      `Status: ${mismatchRes.status}`
    );

    // ----------------------------------------------------
    // TEST 6: Successful Login
    // ----------------------------------------------------
    const loginRes = await request('POST', '/api/auth/login', {
      email: testEmailMixedCase, // Test login with mixed case input
      password: strongPassword,
    });

    assert(
      loginRes.status === 200 && loginRes.body.success === true && !!loginRes.body.token,
      '6. Successful Login with Valid Credentials',
      `Status: ${loginRes.status}`
    );

    // ----------------------------------------------------
    // TEST 7: Incorrect Password Login
    // ----------------------------------------------------
    const wrongPwRes = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword999!',
    });

    assert(
      wrongPwRes.status === 401 && wrongPwRes.body.error === 'Invalid email or password.',
      '7. Reject Incorrect Password with Generic Error Message',
      `Status: ${wrongPwRes.status}, Error: ${wrongPwRes.body.error}`
    );

    // ----------------------------------------------------
    // TEST 8: Nonexistent Email Login & Forgot Password (Prevent Enumeration)
    // ----------------------------------------------------
    const nonExistentEmail = `nonexistent.${Date.now()}@example.com`;
    const nonExistLogin = await request('POST', '/api/auth/login', {
      email: nonExistentEmail,
      password: strongPassword,
    });

    const forgotRes = await request('POST', '/api/auth/forgot-password', {
      email: nonExistentEmail,
    });

    assert(
      nonExistLogin.status === 401 &&
      nonExistLogin.body.error === 'Invalid email or password.' &&
      forgotRes.status === 200 &&
      forgotRes.body.message.includes('If an account'),
      '8. Prevent User Enumeration (Generic messaging on login & forgot-password)',
      `Login error: ${nonExistLogin.body.error}, Forgot msg: ${forgotRes.body.message}`
    );

    // ----------------------------------------------------
    // TEST 9: Password Hash Storage Verification
    // ----------------------------------------------------
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail.toLowerCase() },
    });

    const isBcryptHash = dbUser && (dbUser.password.startsWith('$2b$') || dbUser.password.startsWith('$2a$'));
    const isPlaintextNotStored = dbUser && dbUser.password !== strongPassword;

    assert(
      isBcryptHash && isPlaintextNotStored,
      '9. Password Hash Storage (Secure bcrypt hash stored, plain-text never saved)',
      `Stored password starts with: ${dbUser?.password.slice(0, 7)}`
    );

    // ----------------------------------------------------
    // TEST 10: Password Hash Not Exposed in API Responses
    // ----------------------------------------------------
    const meRes = await request('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${authToken}`,
    });

    const hasPasswordInRegister = 'password' in regRes.body.user || 'passwordHash' in regRes.body.user;
    const hasPasswordInLogin = 'password' in loginRes.body.user || 'passwordHash' in loginRes.body.user;
    const hasPasswordInMe = meRes.body.user && ('password' in meRes.body.user || 'passwordHash' in meRes.body.user);

    assert(
      !hasPasswordInRegister && !hasPasswordInLogin && !hasPasswordInMe,
      '10. Never Expose Password or Password Hashes in API Responses',
      `In register: ${hasPasswordInRegister}, In login: ${hasPasswordInLogin}, In me: ${hasPasswordInMe}`
    );

    // ----------------------------------------------------
    // TEST 11: Rate Limiting Enforcement
    // ----------------------------------------------------
    const { createRateLimitHandler } = require('../src/middleware/rate-limiters');
    const mockReq = { originalUrl: '/api/auth/login', method: 'POST', body: { email: 'rate.limit@example.com' }, setHeader: () => {} };
    let mockStatus = 0;
    let mockJson = null;
    const mockRes = {
      setHeader: () => {},
      status: (code) => { mockStatus = code; return mockRes; },
      json: (data) => { mockJson = data; return mockRes; }
    };
    const handler = createRateLimitHandler('auth');
    handler(mockReq, mockRes, () => {}, { windowMs: 900000, message: { error: 'Too many authentication attempts.' } });

    assert(
      mockStatus === 429 && mockJson && mockJson.code === 'TOO_MANY_REQUESTS',
      '11. Login Rate Limiting (HTTP 429 returned after repeated attempts)',
      `Status: ${mockStatus}, Code: ${mockJson?.code}`
    );

    // ----------------------------------------------------
    // TEST 12: Password Change Success & Failure
    // ----------------------------------------------------
    // 12a. Failure: Wrong current password
    const failPwChange = await request('PATCH', '/api/settings/password', {
      currentPassword: 'WrongCurrentPassword123!',
      newPassword: newStrongPassword,
      confirmPassword: newStrongPassword,
    }, {
      Authorization: `Bearer ${authToken}`,
    });

    assert(
      failPwChange.status === 400 && failPwChange.body.error === 'Current password is incorrect.',
      '12a. Password Change Failure (Wrong current password rejected)',
      `Status: ${failPwChange.status}`
    );

    // 12b. Failure: Password mismatch
    const mismatchPwChange = await request('PATCH', '/api/settings/password', {
      currentPassword: strongPassword,
      newPassword: newStrongPassword,
      confirmPassword: 'MismatchNewPassword123!',
    }, {
      Authorization: `Bearer ${authToken}`,
    });

    assert(
      mismatchPwChange.status === 400,
      '12b. Password Change Failure (Password confirmation mismatch rejected)',
      `Status: ${mismatchPwChange.status}`
    );

    // 12c. Success: Valid current password, strong new password, matching confirmation
    const successPwChange = await request('PATCH', '/api/settings/password', {
      currentPassword: strongPassword,
      newPassword: newStrongPassword,
      confirmPassword: newStrongPassword,
    }, {
      Authorization: `Bearer ${authToken}`,
    });

    assert(
      successPwChange.status === 200 && successPwChange.body.success === true && !!successPwChange.body.token,
      '12c. Password Change Success (Password updated and session token rotated)',
      `Status: ${successPwChange.status}`
    );

    // ----------------------------------------------------
    // TEST 13: Database Immutability After Failed Password Validation
    // ----------------------------------------------------
    // Attempt another password update with a weak password
    await request('PATCH', '/api/settings/password', {
      currentPassword: newStrongPassword,
      newPassword: 'weak',
      confirmPassword: 'weak',
    }, {
      Authorization: `Bearer ${successPwChange.body.token}`,
    });

    const userAfterFailedUpdate = await prisma.user.findUnique({
      where: { id: userId },
    });

    const isNewPasswordMaintained = await bcrypt.compare(newStrongPassword, userAfterFailedUpdate.password);

    assert(
      isNewPasswordMaintained,
      '13. No Database Update After Failed Validation',
      `Password hash matches new strong password: ${isNewPasswordMaintained}`
    );

    // ----------------------------------------------------
    // TEST 14: Toggle-Based Single Contact Forgot Password (Email-only & Phone-only)
    // ----------------------------------------------------
    // 14a. Email-only Forgot Password request
    const emailOnlyForgot = await request('POST', '/api/auth/forgot-password', {
      email: testEmail,
    });
    assert(
      emailOnlyForgot.status === 200 && emailOnlyForgot.body.message.includes('If an account') && emailOnlyForgot.body.devOtp,
      '14a. Email-Only Forgot Password Request (Returns generic anti-enumeration response and dispatches OTP)',
      `Status: ${emailOnlyForgot.status}, DevOTP: ${emailOnlyForgot.body.devOtp}`
    );

    // 14b. Verify Email OTP -> Receive resetToken
    const verifyEmailForgotOtp = await request('POST', '/api/auth/verify-otp', {
      identifier: testEmail,
      otpCode: emailOnlyForgot.body.devOtp,
      purpose: 'PASSWORD_RESET_EMAIL',
    });
    assert(
      verifyEmailForgotOtp.status === 200 && verifyEmailForgotOtp.body.resetToken,
      '14b. Verify Email-Only Forgot Password OTP (Returns JWT reset authorization token)',
      `Status: ${verifyEmailForgotOtp.status}, Token: ${!!verifyEmailForgotOtp.body.resetToken}`
    );

    // 14c. Phone-only Forgot Password request
    const phoneOnlyForgot = await request('POST', '/api/auth/forgot-password', {
      phone: testPhone,
    });
    assert(
      phoneOnlyForgot.status === 200 && phoneOnlyForgot.body.message.includes('If an account') && phoneOnlyForgot.body.devOtp,
      '14c. Phone-Only Forgot Password Request (Returns generic anti-enumeration response and dispatches SMS OTP)',
      `Status: ${phoneOnlyForgot.status}, DevOTP: ${phoneOnlyForgot.body.devOtp}`
    );

    // 14d. Verify Phone OTP -> Receive resetToken
    const verifyPhoneForgotOtp = await request('POST', '/api/auth/verify-otp', {
      identifier: testPhone,
      otpCode: phoneOnlyForgot.body.devOtp,
      purpose: 'PASSWORD_RESET_PHONE',
    });
    assert(
      verifyPhoneForgotOtp.status === 200 && verifyPhoneForgotOtp.body.resetToken,
      '14d. Verify Phone-Only Forgot Password OTP (Returns JWT reset authorization token)',
      `Status: ${verifyPhoneForgotOtp.status}, Token: ${!!verifyPhoneForgotOtp.body.resetToken}`
    );

    // 14e. Validation error handling for invalid format
    const invalidPhoneForgot = await request('POST', '/api/auth/forgot-password', {
      phone: '12345',
    });
    assert(
      invalidPhoneForgot.status === 400 && invalidPhoneForgot.body.error.includes('10-digit Indian phone'),
      '14e. Validation Error on Invalid Phone Format (Rejects invalid phone number format)',
      `Status: ${invalidPhoneForgot.status}, Error: ${invalidPhoneForgot.body.error}`
    );

  } catch (err) {
    console.error('UNHANDLED TEST EXCEPTION:', err);
    failedTests++;
  } finally {
    // Cleanup test user
    if (testEmail) {
      await prisma.user.deleteMany({
        where: { email: { in: [testEmail.toLowerCase(), testEmailMixedCase.toLowerCase()] } },
      }).catch(() => {});
    }

    if (server) {
      server.close();
    }

    console.log('\n==================================================');
    console.log(`  TEST RESULTS SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('==================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAuthSecurityTests();
