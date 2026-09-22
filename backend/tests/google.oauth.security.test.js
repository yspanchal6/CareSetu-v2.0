const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const googleAuthService = require('../src/services/google-auth.service');
const prisma = require('../src/config/prisma');

async function runGoogleOAuthSecurityTests() {
  console.log('==================================================');
  console.log('CARESETU GOOGLE OAUTH SECURITY TEST SUITE');
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
    // TEST 1: Missing Token Rejection
    // ------------------------------------------------------------------
    let missingTokenError = false;
    try {
      await googleAuthService.verifyGoogleToken('');
    } catch (err) {
      missingTokenError = true;
      assert(err.status === 400, 'Empty Google ID token returns HTTP 400 Bad Request');
    }
    assert(missingTokenError === true, 'Empty token is rejected');

    // ------------------------------------------------------------------
    // TEST 2: Expired Google ID Token Rejection
    // ------------------------------------------------------------------
    let expiredTokenError = false;
    try {
      await googleAuthService.verifyGoogleToken('synthetic-google-token-test:user@example.com:Name:sub-123:aud-ok:expired');
    } catch (err) {
      expiredTokenError = true;
      assert(err.status === 401, 'Expired Google ID token returns HTTP 401 Unauthorized');
      assert(err.message.includes('expired'), 'Error message states token expired');
    }
    assert(expiredTokenError === true, 'Expired Google ID token is rejected');

    // ------------------------------------------------------------------
    // TEST 3: Wrong Audience (aud Claim) Rejection
    // ------------------------------------------------------------------
    let wrongAudError = false;
    try {
      await googleAuthService.verifyGoogleToken('synthetic-google-token-test:user@example.com:Name:sub-123:wrong-aud');
    } catch (err) {
      wrongAudError = true;
      assert(err.status === 401, 'Wrong audience token returns HTTP 401 Unauthorized');
      assert(err.message.includes('audience mismatch'), 'Error message states audience mismatch');
    }
    assert(wrongAudError === true, 'Token with wrong audience is rejected');

    // ------------------------------------------------------------------
    // TEST 4: Wrong Issuer (iss Claim) Rejection
    // ------------------------------------------------------------------
    let wrongIssError = false;
    try {
      await googleAuthService.verifyGoogleToken('synthetic-google-token-test:user@example.com:Name:sub-123:aud-ok:wrong-iss');
    } catch (err) {
      wrongIssError = true;
      assert(err.status === 401, 'Wrong issuer token returns HTTP 401 Unauthorized');
      assert(err.message.includes('issuer mismatch'), 'Error message states issuer mismatch');
    }
    assert(wrongIssError === true, 'Token with untrusted issuer is rejected');

    // ------------------------------------------------------------------
    // TEST 5: Unregistered Google Account Rejection on Login
    // ------------------------------------------------------------------
    const unregisteredEmail = `unregistered.google.${Date.now()}@example.com`;
    const unregisteredToken = `synthetic-google-token-test:${unregisteredEmail}:Unregistered User:google-sub-unregistered`;
    let unregisteredError = false;

    try {
      await googleAuthService.authenticateGoogleLogin({ idToken: unregisteredToken });
    } catch (err) {
      unregisteredError = true;
      assert(err.status === 404, 'Unregistered Google login attempt returns HTTP 404 Not Found');
      assert(err.code === 'ACCOUNT_NOT_REGISTERED', 'Returns code ACCOUNT_NOT_REGISTERED');
      assert(err.message.includes('register first'), 'Error message instructs user to register first');
    }
    assert(unregisteredError === true, 'Unregistered Google login attempt is safely rejected');

    // ------------------------------------------------------------------
    // TEST 6: Role Escalation Prevention on Registration
    // ------------------------------------------------------------------
    const escalationEmail = `escalation.${Date.now()}@example.com`;
    const escalationToken = `synthetic-google-token-test:${escalationEmail}:Escalation User:sub-${Date.now()}`;
    
    // User requests ADMIN role via OAuth payload during registration
    const { user: escalationUser } = await googleAuthService.registerGoogleUser({
      idToken: escalationToken,
      requestedRole: 'ADMIN', // Untrusted request
    });

    assert(escalationUser.role === 'PATIENT', 'Untrusted ADMIN role escalation request is sanitized to PATIENT');
    assert(escalationUser.role !== 'ADMIN', 'Role escalation to ADMIN is strictly FORBIDDEN');

    // Clean up created test user
    await prisma.patient.deleteMany({ where: { userId: escalationUser.id } });
    await prisma.user.delete({ where: { id: escalationUser.id } });

    // ------------------------------------------------------------------
    // TEST 7: Login with Existing Registered Google Account and Role Immutability
    // ------------------------------------------------------------------
    const registeredDoctorEmail = `doctor.existing.${Date.now()}@example.com`;
    
    // Create existing DOCTOR account in database
    const doctorUser = await prisma.user.create({
      data: {
        email: registeredDoctorEmail,
        password: 'hashed-password-123',
        role: 'DOCTOR',
        status: 'ACTIVE',
        isVerified: true,
      },
    });

    // Login with Google OAuth trying to request role='PATIENT'
    const doctorToken = `synthetic-google-token-test:${registeredDoctorEmail}:Doctor User:google-sub-doctor`;
    const loginResult = await googleAuthService.authenticateGoogleLogin({
      idToken: doctorToken,
    });

    assert(loginResult.isNewUser === false, 'Existing user login returns isNewUser=false');
    assert(loginResult.user.id === doctorUser.id, 'Finds exact registered user account');
    assert(loginResult.user.role === 'DOCTOR', 'Authoritative database role DOCTOR is preserved and immutable');

    // Clean up
    await prisma.user.delete({ where: { id: doctorUser.id } });

    // ------------------------------------------------------------------
    // TEST 8: Blocked Account Rejection
    // ------------------------------------------------------------------
    const blockedEmail = `google.blocked.${Date.now()}@example.com`;
    const blockedUser = await prisma.user.create({
      data: {
        email: blockedEmail,
        password: 'hashed-password-123',
        role: 'PATIENT',
        status: 'BLOCKED',
        isVerified: true,
      },
    });

    let blockedAuthError = false;
    try {
      const blockedToken = `synthetic-google-token-test:${blockedEmail}:Blocked User:google-sub-blocked`;
      await googleAuthService.authenticateGoogleLogin({ idToken: blockedToken });
    } catch (err) {
      blockedAuthError = true;
      assert(err.status === 403, 'Suspended/Blocked account returns HTTP 403 Forbidden');
      assert(err.message.includes('suspended'), 'Error message states account is suspended');
    }
    assert(blockedAuthError === true, 'Blocked account Google OAuth login is rejected');

    // Clean up
    await prisma.user.delete({ where: { id: blockedUser.id } });

    // ------------------------------------------------------------------
    // TEST 9: Register New HOSPITAL User via Google OAuth
    // ------------------------------------------------------------------
    const hospitalRegEmail = `hospital.google.${Date.now()}@example.com`;
    const hospitalRegToken = `synthetic-google-token-test:${hospitalRegEmail}:City Hospital:sub-hosp-${Date.now()}`;
    const { user: newHospUser, isNewUser: isNewHosp } = await googleAuthService.registerGoogleUser({
      idToken: hospitalRegToken,
      requestedRole: 'HOSPITAL',
      profileData: {
        phone: '9876543210',
        address: '123 Health Way',
        city: 'Ahmedabad',
        state: 'Gujarat',
        latitude: 23.0225,
        longitude: 72.5714,
      },
    });

    assert(isNewHosp === true, 'HOSPITAL Google registration returns isNewUser=true');
    assert(newHospUser.role === 'HOSPITAL', 'HOSPITAL role is properly assigned in DB');
    assert(newHospUser.hospital !== null, 'Hospital record is created in DB');
    assert(newHospUser.hospital.city === 'Ahmedabad', 'Hospital city stored correctly in DB');
    assert(newHospUser.hospital.location.latitude === 23.0225, 'Hospital location latitude stored correctly in DB');

    // Clean up
    await prisma.hospital.deleteMany({ where: { userId: newHospUser.id } });
    await prisma.user.delete({ where: { id: newHospUser.id } });

    // ------------------------------------------------------------------
    // TEST 10: Register New DOCTOR User via Google OAuth
    // ------------------------------------------------------------------
    const doctorRegEmail = `doc.google.${Date.now()}@example.com`;
    const doctorRegToken = `synthetic-google-token-test:${doctorRegEmail}:Dr. Smith:sub-doc-${Date.now()}`;
    const { user: newDocUser, isNewUser: isNewDoc } = await googleAuthService.registerGoogleUser({
      idToken: doctorRegToken,
      requestedRole: 'DOCTOR',
    });

    assert(isNewDoc === true, 'DOCTOR Google registration returns isNewUser=true');
    assert(newDocUser.role === 'DOCTOR', 'DOCTOR role is properly assigned in DB');

    // Clean up
    await prisma.user.delete({ where: { id: newDocUser.id } });

    // ------------------------------------------------------------------
    // TEST 11: Register New PATIENT User via Google OAuth with profileData
    // ------------------------------------------------------------------
    const patientRegEmail = `patient.google.${Date.now()}@example.com`;
    const patientRegToken = `synthetic-google-token-test:${patientRegEmail}:Jane Doe:sub-pat-${Date.now()}`;
    const { user: newPatUser, isNewUser: isNewPat } = await googleAuthService.registerGoogleUser({
      idToken: patientRegToken,
      requestedRole: 'PATIENT',
      profileData: {
        phone: '9123456789',
        age: 28,
        gender: 'Female',
      },
    });

    assert(isNewPat === true, 'PATIENT Google registration returns isNewUser=true');
    assert(newPatUser.role === 'PATIENT', 'PATIENT role is properly assigned in DB');
    assert(newPatUser.patient !== null, 'Patient record is created in DB');
    assert(newPatUser.patient.age === 28, 'Patient age stored correctly in DB');
    assert(newPatUser.patient.gender === 'Female', 'Patient gender stored correctly in DB');

    // Clean up
    await prisma.patient.deleteMany({ where: { userId: newPatUser.id } });
    await prisma.user.delete({ where: { id: newPatUser.id } });

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

runGoogleOAuthSecurityTests();

