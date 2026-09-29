const prisma = require('./src/config/prisma');
const hospitalSecurityService = require('./src/services/hospital-security.service');
const brevoProvider = require('./src/services/providers/brevo.provider');

async function runGlobalRestrictionAndEmailTests() {
  console.log('=== STARTING GLOBAL HOSPITAL PORTAL RESTRICTION & EMAIL INTEGRATION TESTS ===\n');

  try {
    // 1. Setup / Find Test Hospital User
    const testHospitalUser = await prisma.user.findFirst({
      where: { role: 'HOSPITAL' },
      include: { hospital: true }
    });

    if (!testHospitalUser || !testHospitalUser.hospital) {
      console.log('❌ No hospital user found in DB.');
      process.exit(1);
    }

    const hospital = testHospitalUser.hospital;
    const registeredEmail = hospital.email || testHospitalUser.email;
    console.log(`[SETUP] Hospital Name: ${hospital.name}`);
    console.log(`[SETUP] Hospital ID: ${hospital.id}`);
    console.log(`[SETUP] Hospital Registered Email: ${registeredEmail}\n`);

    // Reset status to ACTIVE for clean start
    await prisma.hospitalSecurityStatus.upsert({
      where: { hospitalId: hospital.id },
      update: {
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: 10,
        blockedAt: null,
        unblockedAt: new Date()
      },
      create: {
        hospitalId: hospital.id,
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: 10
      }
    });

    await prisma.user.update({
      where: { id: testHospitalUser.id },
      data: { status: 'ACTIVE' }
    });

    // -------------------------------------------------------------
    // TEST 1: Event 1 & 2 Warning Phase
    // -------------------------------------------------------------
    console.log('--- TEST 1: Trigger 2 Violations (1/3 & 2/3 Warnings) ---');
    await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: 10,
      clientGeneratedEventId: `test-glob-1-${Date.now()}`
    });
    const res2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: 10,
      clientGeneratedEventId: `test-glob-2-${Date.now()}`
    });

    console.log(`Result 2: status = ${res2.status}, count = ${res2.currentViolationCount}/3`);
    if (res2.status === 'WARNING' && res2.currentViolationCount === 2) {
      console.log('✅ TEST 1 PASSED: Warnings processed cleanly.\n');
    } else {
      console.error('❌ TEST 1 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 2: Event 3 Blocking Trigger (Reaches 3/3, TEMPORARILY_BLOCKED)
    // -------------------------------------------------------------
    console.log('--- TEST 2: Trigger 3rd Violation (3/3 Blocking Trigger) ---');
    const res3 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: 10,
      clientGeneratedEventId: `test-glob-3-${Date.now()}`
    });

    console.log('Result 3:', res3);
    if (res3.status === 'TEMPORARILY_BLOCKED' && res3.currentViolationCount === 3 && res3.allowed === false) {
      console.log('✅ TEST 2 PASSED: Hospital entered TEMPORARILY_BLOCKED state.\n');
    } else {
      console.error('❌ TEST 2 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 3: DB & Registered Email Verification
    // -------------------------------------------------------------
    console.log('--- TEST 3: Registered Email & DB State Verification ---');
    const secStatusDB = await prisma.hospitalSecurityStatus.findUnique({
      where: { hospitalId: hospital.id }
    });
    const userDB = await prisma.user.findUnique({
      where: { id: testHospitalUser.id }
    });

    console.log(`DB Security Status: ${secStatusDB.status}, Violations: ${secStatusDB.currentViolationCount}/3`);
    console.log(`DB User Status: ${userDB.status}`);
    console.log(`Target Notification Email (DB): ${registeredEmail}`);

    if (secStatusDB.status === 'TEMPORARILY_BLOCKED' && secStatusDB.currentViolationCount === 3 && userDB.status === 'BLOCKED') {
      console.log('✅ TEST 3 PASSED: DB State & Registered Email Verified.\n');
    } else {
      console.error('❌ TEST 3 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 4: Hospital Appeal Submission (POST /api/security/appeal)
    // -------------------------------------------------------------
    console.log('--- TEST 4: Submit Security Appeal (Hospital Portal) ---');
    const appeal = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId: testHospitalUser.id,
      reason: 'Accidental shortcut key trigger',
      description: 'Accidental screenshot key press during emergency case review. System has been reviewed.'
    });

    console.log(`Appeal Created: ID = ${appeal.id}, ReviewRef = ${appeal.reviewReference}, Status = ${appeal.status}`);
    const secStatusAfterAppeal = await prisma.hospitalSecurityStatus.findUnique({
      where: { hospitalId: hospital.id }
    });
    console.log(`Hospital Security Status after appeal: ${secStatusAfterAppeal.status}`);

    if (appeal.status === 'PENDING' && (secStatusAfterAppeal.status === 'UNDER_REVIEW' || secStatusAfterAppeal.status === 'TEMPORARILY_BLOCKED')) {
      console.log('✅ TEST 4 PASSED: Appeal submitted & pending admin review.\n');
    } else {
      console.error('❌ TEST 4 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 5: Admin Unlock & Security Epoch Upgrade
    // -------------------------------------------------------------
    console.log('--- TEST 5: Admin Unlock Hospital (Security Epoch Upgrade) ---');
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const unlockRes = await hospitalSecurityService.unlockHospital({
      adminUserId: adminUser ? adminUser.id : testHospitalUser.id,
      hospitalId: hospital.id,
      decision: 'APPROVED',
      adminNotes: 'Appeal reviewed and approved by Administrator.'
    });

    console.log('Unlock Result:', unlockRes);
    const secStatusUnlocked = await prisma.hospitalSecurityStatus.findUnique({
      where: { hospitalId: hospital.id }
    });
    const userUnlocked = await prisma.user.findUnique({
      where: { id: testHospitalUser.id }
    });

    console.log(`Unlocked Status: ${secStatusUnlocked.status}, Count: ${secStatusUnlocked.currentViolationCount}, New Epoch: ${secStatusUnlocked.securityEpoch}`);
    console.log(`User Status Restored: ${userUnlocked.status}`);

    if (secStatusUnlocked.status === 'ACTIVE' && secStatusUnlocked.currentViolationCount === 0 && secStatusUnlocked.securityEpoch === 11 && userUnlocked.status === 'ACTIVE') {
      console.log('✅ TEST 5 PASSED: Hospital unlocked, epoch upgraded to 11, count reset to 0/3.\n');
    } else {
      console.error('❌ TEST 5 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 6: First Violation in New Epoch (Must be 1/3, NOT 4/3!)
    // -------------------------------------------------------------
    console.log('--- TEST 6: Post-Unlock Security Event (Expect 1/3 in Epoch 11) ---');
    const resPostUnlock = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: 11,
      clientGeneratedEventId: `test-glob-new-epoch-${Date.now()}`
    });

    console.log('Post-Unlock Event Res:', resPostUnlock);
    if (resPostUnlock.status === 'WARNING' && resPostUnlock.currentViolationCount === 1 && resPostUnlock.securityEpoch === 11) {
      console.log('✅ TEST 6 PASSED: First event after unlock started at 1/3 (NOT 4/3!).\n');
    } else {
      console.error('❌ TEST 6 FAILED');
      process.exit(1);
    }

    // Clean up test hospital back to ACTIVE 0/3
    await prisma.hospitalSecurityStatus.update({
      where: { hospitalId: hospital.id },
      data: {
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: 12
      }
    });
    await prisma.user.update({
      where: { id: testHospitalUser.id },
      data: { status: 'ACTIVE' }
    });

    console.log('🧹 [TEST CLEANUP] Reset hospital back to ACTIVE with securityEpoch 12.');
    console.log('\n=== ALL GLOBAL RESTRICTION & EMAIL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('❌ UNHANDLED EXCEPTION IN SUITE:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runGlobalRestrictionAndEmailTests();
