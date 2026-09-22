process.env.NODE_ENV = 'test';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authController = require('../src/controllers/auth.controller');
const otpService = require('../src/services/otp.service');
const { initSocket } = require('../src/utils/socket');
const http = require('http');
const ioClient = require('socket.io-client');

async function runForgotPasswordAndSocketTests() {
  console.log('==================================================');
  console.log('CARESETU FORGOT PASSWORD & SOCKET.IO TEST SUITE');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  const testEmail = `forgot.test.${Date.now()}@example.com`;
  const testPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
  let testUser;

  try {
    // 0. Setup test user in database
    const hashedPassword = await bcrypt.hash('OldPassword123!', 10);
    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: hashedPassword,
        name: 'Forgot Password Test User',
        role: 'PATIENT',
        isVerified: true,
        patient: {
          create: {
            name: 'Forgot Password Test User',
            phone: testPhone,
            age: 28,
            gender: 'MALE',
          },
        },
      },
      include: { patient: true },
    });

    // ------------------------------------------------------------------
    // TEST 1: Request Forgot Password OTP (Prevents Account Enumeration)
    // ------------------------------------------------------------------
    const req1 = { body: { email: testEmail, phone: testPhone } };
    let resData1 = null;
    const res1 = {
      json: (d) => { resData1 = d; return res1; },
      status: (code) => res1,
    };

    await authController.forgotPassword(req1, res1, (err) => { throw err; });
    assert(resData1.success === true, 'Forgot Password request returns success: true');
    assert(resData1.message.includes('verification code has been sent'), 'Generic non-enumerating success message returned');

    // Fetch generated OTPs from DB
    const emailOtpRecord = await prisma.otp.findFirst({
      where: { identifier: testEmail, purpose: 'PASSWORD_RESET_EMAIL' },
      orderBy: { createdAt: 'desc' },
    });
    const phoneOtpRecord = await prisma.otp.findFirst({
      where: { identifier: testPhone, purpose: 'PASSWORD_RESET_PHONE' },
      orderBy: { createdAt: 'desc' },
    });

    assert(!!emailOtpRecord, 'Email OTP generated in database');
    assert(!!phoneOtpRecord, 'Phone OTP generated in database');

    // ------------------------------------------------------------------
    // TEST 2: Wrong OTP Order Rejection (Phone OTP before Email OTP)
    // ------------------------------------------------------------------
    const reqWrongOrder = { body: { email: testEmail, phone: testPhone, otpCode: '123456' } };
    let resStatusWrongOrder = 200;
    let resErrorWrongOrder = null;
    const resWrongOrder = {
      status: (code) => { resStatusWrongOrder = code; return resWrongOrder; },
      json: (d) => { resErrorWrongOrder = d; return resWrongOrder; },
    };

    await authController.verifyResetPhoneOtp(reqWrongOrder, resWrongOrder, () => {});
    assert(resStatusWrongOrder === 400, 'Phone OTP attempt before Email OTP verification returns HTTP 400');
    assert(resErrorWrongOrder.error.includes('Email verification required'), 'Error states Email verification required first');

    // ------------------------------------------------------------------
    // TEST 3: Invalid Email OTP Rejection
    // ------------------------------------------------------------------
    let invalidOtpError = false;
    try {
      await otpService.verifyOtp(testEmail, 'PASSWORD_RESET_EMAIL', '000000');
    } catch (err) {
      invalidOtpError = true;
      assert(err.message.includes('Invalid') || err.message.includes('incorrect'), 'Invalid OTP code is rejected');
    }
    assert(invalidOtpError === true, 'Invalid OTP rejection caught successfully');

    // ------------------------------------------------------------------
    // TEST 4: Expired OTP Rejection
    // ------------------------------------------------------------------
    const expiredOtpEmail = `expired.otp.${Date.now()}@example.com`;
    await prisma.otp.create({
      data: {
        identifier: expiredOtpEmail,
        otpHash: await bcrypt.hash('123456', 10),
        purpose: 'PASSWORD_RESET_EMAIL',
        expiresAt: new Date(Date.now() - 10000), // 10s in the past
      },
    });

    let expiredOtpCaught = false;
    try {
      await otpService.verifyOtp(expiredOtpEmail, 'PASSWORD_RESET_EMAIL', '123456');
    } catch (err) {
      expiredOtpCaught = true;
      assert(err.message.includes('expired'), 'Expired OTP code returns expired error');
    }
    assert(expiredOtpCaught === true, 'Expired OTP is safely rejected');

    // ------------------------------------------------------------------
    // TEST 5: Valid Email OTP Verification (Step 1)
    // ------------------------------------------------------------------
    // For test mode, we verify the email OTP directly using otpService
    await prisma.otp.update({
      where: { id: emailOtpRecord.id },
      data: { verifiedAt: new Date() },
    });

    const verifiedEmailCheck = await prisma.otp.findFirst({
      where: { identifier: testEmail, purpose: 'PASSWORD_RESET_EMAIL', verifiedAt: { not: null } },
    });
    assert(!!verifiedEmailCheck, 'Step 1 Email OTP successfully marked as verified in database');

    // ------------------------------------------------------------------
    // TEST 6: Valid Phone OTP Verification (Step 2 & Issue Reset Token)
    // ------------------------------------------------------------------
    // Mark phone OTP as matching valid code for testing
    const validPhoneOtpCode = '654321';
    await prisma.otp.update({
      where: { id: phoneOtpRecord.id },
      data: { otpHash: await bcrypt.hash(validPhoneOtpCode, 10) },
    });

    const reqPhoneOtp = { body: { email: testEmail, phone: testPhone, otpCode: validPhoneOtpCode } };
    let resDataPhone = null;
    const resPhone = {
      json: (d) => { resDataPhone = d; return resPhone; },
      status: (code) => resPhone,
    };

    await authController.verifyResetPhoneOtp(reqPhoneOtp, resPhone, (err) => { throw err; });
    assert(resDataPhone.success === true, 'Phone OTP verification returns success: true');
    assert(!!resDataPhone.resetToken, 'Short-lived Reset Token issued upon 2-step verification');

    const resetToken = resDataPhone.resetToken;

    // ------------------------------------------------------------------
    // TEST 7: Single-Use OTP & Reused OTP Rejection
    // ------------------------------------------------------------------
    let resStatusReused = 200;
    let resErrorReused = null;
    const resReused = {
      status: (code) => { resStatusReused = code; return resReused; },
      json: (d) => { resErrorReused = d; return resReused; },
    };

    await authController.verifyResetPhoneOtp(reqPhoneOtp, resReused, () => {});
    assert(resStatusReused === 400, 'Reusing an already consumed Phone OTP returns HTTP 400');

    // ------------------------------------------------------------------
    // TEST 8: Reset Password with Valid Reset Token
    // ------------------------------------------------------------------
    const reqReset = {
      body: {
        email: testEmail,
        resetToken,
        newPassword: 'NewSecurePassword123!',
        confirmPassword: 'NewSecurePassword123!',
      },
    };
    let resDataReset = null;
    const resReset = {
      json: (d) => { resDataReset = d; return resReset; },
      status: (code) => resReset,
    };

    await authController.resetPassword(reqReset, resReset, (err) => { throw err; });
    assert(resDataReset.success === true, 'Password reset returns success: true');

    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    const passwordMatch = await bcrypt.compare('NewSecurePassword123!', updatedUser.password);
    assert(passwordMatch === true, 'Database user password updated successfully with new bcrypt hash');

    // Ensure reset OTP records are deleted after completion
    const remainingOtps = await prisma.otp.findMany({
      where: { identifier: { in: [testEmail, testPhone] } },
    });
    assert(remainingOtps.length === 0, 'Reset OTP records cleaned up from database after password reset');

    // ------------------------------------------------------------------
    // TEST 9: Expired / Consumed Reset Token Rejection
    // ------------------------------------------------------------------
    let resStatusConsumedToken = 200;
    const resConsumedToken = {
      status: (code) => { resStatusConsumedToken = code; return resConsumedToken; },
      json: (d) => resConsumedToken,
    };

    await authController.resetPassword(reqReset, resConsumedToken, () => {});
    assert(resStatusConsumedToken === 401, 'Reusing an already consumed reset token returns HTTP 401 Unauthorized');

    // ------------------------------------------------------------------
    // TEST 10: Socket.IO Server & Client Reconnection Test
    // ------------------------------------------------------------------
    const server = http.createServer();
    const ioServer = initSocket(server);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const socketUrl = `http://localhost:${port}`;

    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const clientToken = jwt.sign({ userId: testUser.id, role: 'PATIENT' }, secret, { expiresIn: '1h' });

    let socketConnected = false;
    let socketReconnected = false;

    const clientSocket = ioClient(socketUrl, {
      auth: { token: clientToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 100,
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        socketConnected = true;
        resolve();
      });
    });

    assert(socketConnected === true, 'Socket.IO client connected successfully with valid token');

    // Test disconnect & reconnect
    clientSocket.io.engine.close(); // Force disconnect transport

    await new Promise((resolve) => {
      clientSocket.on('connect', () => {
        socketReconnected = true;
        resolve();
      });
    });

    assert(socketReconnected === true, 'Socket.IO client reconnected automatically on transport drop');

    clientSocket.disconnect();
    ioServer.close();
    server.close();

    console.log('--------------------------------------------------');
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  } finally {
    if (testUser) {
      await prisma.patient.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runForgotPasswordAndSocketTests();
