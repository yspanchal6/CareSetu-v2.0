/**
 * CareSetu — Dev Test Patient Account & Access Control Verification Test Suite
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const authController = require('../src/controllers/auth.controller');
const { seedTestPatient, TEST_EMAIL, TEST_PASSWORD } = require('../scripts/seed-test-patient');

async function runTestPatientAccountTests() {
  console.log('==================================================');
  console.log('CARESETU DEV TEST PATIENT ACCOUNT TEST SUITE');
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

  try {
    // ------------------------------------------------------------------
    // TEST 1: Provision Test Patient Account Idempotently
    // ------------------------------------------------------------------
    await seedTestPatient();
    const seededUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      include: { patient: true },
    });

    assert(seededUser !== null, 'Test patient account exists in database');
    assert(seededUser.email === TEST_EMAIL, 'Matches exact test patient email');
    assert(seededUser.role === 'PATIENT', 'Role is strictly PATIENT');
    assert(seededUser.status === 'ACTIVE', 'Account status is ACTIVE');
    assert(seededUser.isVerified === true, 'isVerified flag is set to true');
    assert(seededUser.password !== TEST_PASSWORD, 'Password is stored as bcrypt hash, never plain text');
    assert(seededUser.patient !== null, 'Patient profile record is attached');

    // ------------------------------------------------------------------
    // TEST 2: Login via /api/auth/login with Test Credentials
    // ------------------------------------------------------------------
    let loginStatus = 200; // Express default for res.json
    let loginResponseBody = null;

    const reqMock = {
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    };
    const resMock = {
      status(code) {
        loginStatus = code;
        return this;
      },
      json(data) {
        loginResponseBody = data;
        return this;
      },
    };

    await authController.login(reqMock, resMock, (err) => {
      if (err) throw err;
    });

    assert(loginStatus === 200, 'Login returns HTTP 200 OK');
    assert(loginResponseBody?.success === true, 'Login response returns success: true');
    assert(typeof loginResponseBody?.token === 'string', 'Valid JWT token issued upon login');
    assert(loginResponseBody?.user?.role === 'PATIENT', 'Returned user role is PATIENT');

    // ------------------------------------------------------------------
    // TEST 3: Access Control — Role Boundaries (Forbidden for Doctor/Hospital/Admin)
    // ------------------------------------------------------------------
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decodedToken = jwt.verify(loginResponseBody.token, secret);

    assert(decodedToken.userId === seededUser.id, 'JWT claims match test patient user ID');
    assert(decodedToken.role === 'PATIENT', 'JWT token role claim is PATIENT');
    assert(decodedToken.hospitalId === undefined, 'Patient token contains no hospitalId claim');

    // ------------------------------------------------------------------
    // TEST 4: Google OAuth Isolation (Unregistered / Unlinked Google Account Protection)
    // ------------------------------------------------------------------
    let googleAuthStatus = 200;
    let googleAuthBody = null;

    const googleReqMock = {
      body: {
        credential: 'mock-unregistered-google-id-token',
      },
    };
    const googleResMock = {
      status(code) {
        googleAuthStatus = code;
        return this;
      },
      json(data) {
        googleAuthBody = data;
        return this;
      },
    };

    // Mock googleAuthService to simulate an unlinked Google login attempt
    const googleAuthService = require('../src/services/google-auth.service');
    const originalAuthUser = googleAuthService.authenticateGoogleUser;
    googleAuthService.authenticateGoogleUser = async () => {
      const err = new Error('Your CareSetu account does not exist. Please register first.');
      err.status = 404;
      err.code = 'ACCOUNT_NOT_REGISTERED';
      throw err;
    };

    await authController.googleAuth(googleReqMock, googleResMock, (err) => {
      if (err) throw err;
    });

    googleAuthService.authenticateGoogleUser = originalAuthUser;

    assert(googleAuthStatus === 404, 'Google login for unregistered email returns HTTP 404 Not Found');
    assert(googleAuthBody?.code === 'ACCOUNT_NOT_REGISTERED', 'Does not automatically link or login unlinked Google accounts');

    // ------------------------------------------------------------------
    // TEST 5: Production Disallow Protection
    // ------------------------------------------------------------------
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    let envBlocked = false;
    const originalExit = process.exit;
    process.exit = (code) => {
      envBlocked = true;
      throw new Error(`Process exit called with code ${code}`);
    };

    try {
      await seedTestPatient();
    } catch (e) {
      assert(envBlocked === true, 'Seeding is strictly blocked when NODE_ENV === production');
    }

    process.exit = originalExit;
    process.env.NODE_ENV = originalNodeEnv;

    // ------------------------------------------------------------------
    // TEST 6: Cleanup Script (--clean)
    // ------------------------------------------------------------------
    process.argv.push('--clean');
    await seedTestPatient();
    process.argv.pop();

    const cleanedUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
    });
    assert(cleanedUser === null, 'Cleanup command (--clean) completely purges test patient account');

    // Re-seed so local dev mode has the test account ready
    await seedTestPatient();

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
    await prisma.$disconnect();
  }
}

runTestPatientAccountTests();
