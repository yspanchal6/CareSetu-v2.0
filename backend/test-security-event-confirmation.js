const prisma = require('./src/config/prisma');
const hospitalSecurityService = require('./src/services/hospital-security.service');

async function runTests() {
  console.log('=== STARTING SECURITY EVENT CONFIRMATION SUITE ===\n');
  let testHospitalUser = null;
  let testHospital = null;

  try {
    // 1. Setup / Find Test Hospital
    testHospitalUser = await prisma.user.findFirst({
      where: { role: 'HOSPITAL' },
      include: { hospital: true }
    });

    if (!testHospitalUser || !testHospitalUser.hospital) {
      console.log('❌ No hospital user found in DB to perform test.');
      process.exit(1);
    }

    testHospital = testHospitalUser.hospital;
    console.log(`[TEST SETUP] Using hospital: ${testHospital.name} (ID: ${testHospital.id}, UserID: ${testHospitalUser.id})`);

    // Reset hospital security status for clean test run
    await prisma.hospitalSecurityStatus.upsert({
      where: { hospitalId: testHospital.id },
      update: {
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        historicalViolationCount: 0,
        securityEpoch: 5,
        blockedAt: null,
        unblockedAt: new Date()
      },
      create: {
        hospitalId: testHospital.id,
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        historicalViolationCount: 0,
        securityEpoch: 5
      }
    });

    await prisma.user.update({
      where: { id: testHospitalUser.id },
      data: { status: 'ACTIVE' }
    });

    console.log('[TEST SETUP] Reset hospital status: ACTIVE, currentViolationCount: 0, securityEpoch: 5\n');

    // -------------------------------------------------------------
    // TEST 1: Event 1 (Expected 1/3, WARNING, HTTP 200 confirmation)
    // -------------------------------------------------------------
    console.log('--- TEST 1: First Security Event (Expect 1/3, WARNING) ---');
    const event1Id = `test-evt-1-${Date.now()}`;
    const res1 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB',
      caseId: 'CASE-TEST-001',
      documentId: 'DOC-TEST-001',
      securityEpoch: 5,
      clientGeneratedEventId: event1Id,
      metadata: { protectedResourceType: 'MEDICAL_DOCUMENT' }
    });

    console.log('Res 1:', res1);
    if (res1.success === true && res1.currentViolationCount === 1 && res1.remainingAttempts === 2 && res1.status === 'WARNING') {
      console.log('✅ TEST 1 PASSED: Correct 1/3 state and 200 payload confirmation.\n');
    } else {
      console.error('❌ TEST 1 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 2: Idempotency (Repeat Event 1 with same captureEventId)
    // -------------------------------------------------------------
    console.log('--- TEST 2: Idempotency Check (Repeat Event 1 ID) ---');
    const res2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB',
      caseId: 'CASE-TEST-001',
      documentId: 'DOC-TEST-001',
      securityEpoch: 5,
      clientGeneratedEventId: event1Id,
      metadata: { protectedResourceType: 'MEDICAL_DOCUMENT' }
    });

    console.log('Res 2:', res2);
    if (res2.success === true && res2.currentViolationCount === 1 && res2.deduplicated === true) {
      console.log('✅ TEST 2 PASSED: Idempotent repeat deduplicated cleanly without count increment.\n');
    } else {
      console.error('❌ TEST 2 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 3: Stale Epoch Check (Send event with epoch 4 when current is 5)
    // -------------------------------------------------------------
    console.log('--- TEST 3: Stale Security Epoch (Expect HTTP 409 SESSION_STALE) ---');
    try {
      await hospitalSecurityService.recordCaptureViolation({
        hospitalUserId: testHospitalUser.id,
        eventType: 'SCREENSHOT_ATTEMPT',
        platform: 'WEB',
        securityEpoch: 4, // Stale!
        clientGeneratedEventId: `test-evt-stale-${Date.now()}`
      });
      console.error('❌ TEST 3 FAILED: Stale epoch should have thrown 409 error.');
      process.exit(1);
    } catch (staleErr) {
      console.log('Stale Error Caught:', { status: staleErr.status, code: staleErr.code, message: staleErr.message });
      if (staleErr.status === 409 && staleErr.code === 'SESSION_STALE') {
        console.log('✅ TEST 3 PASSED: Returned HTTP 409 SESSION_STALE for stale epoch.\n');
      } else {
        console.error('❌ TEST 3 FAILED with wrong error type.');
        process.exit(1);
      }
    }

    // -------------------------------------------------------------
    // TEST 4: Event 2 (Expect 2/3, WARNING)
    // -------------------------------------------------------------
    console.log('--- TEST 4: Second Security Event (Expect 2/3, WARNING) ---');
    const event2Id = `test-evt-2-${Date.now()}`;
    const res4 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB',
      caseId: 'CASE-TEST-001',
      documentId: 'DOC-TEST-001',
      securityEpoch: 5,
      clientGeneratedEventId: event2Id
    });

    console.log('Res 4:', res4);
    if (res4.success === true && res4.currentViolationCount === 2 && res4.remainingAttempts === 1) {
      console.log('✅ TEST 4 PASSED: Correct 2/3 state.\n');
    } else {
      console.error('❌ TEST 4 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 5: Event 3 (Expect 3/3, TEMPORARILY_BLOCKED)
    // -------------------------------------------------------------
    console.log('--- TEST 5: Third Security Event (Expect 3/3, TEMPORARILY_BLOCKED) ---');
    const event3Id = `test-evt-3-${Date.now()}`;
    const res5 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB',
      caseId: 'CASE-TEST-001',
      documentId: 'DOC-TEST-001',
      securityEpoch: 5,
      clientGeneratedEventId: event3Id
    });

    console.log('Res 5:', res5);
    if (res5.success === true && res5.currentViolationCount === 3 && res5.status === 'TEMPORARILY_BLOCKED' && res5.remainingAttempts === 0) {
      console.log('✅ TEST 5 PASSED: Correct 3/3 TEMPORARILY_BLOCKED state.\n');
    } else {
      console.error('❌ TEST 5 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 6: Event 4 while blocked (Cap at 3/3, remains 3/3)
    // -------------------------------------------------------------
    console.log('--- TEST 6: Fourth Security Event while Blocked (Expect 3/3 cap) ---');
    const event4Id = `test-evt-4-${Date.now()}`;
    const res6 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testHospitalUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB',
      securityEpoch: 5,
      clientGeneratedEventId: event4Id
    });

    console.log('Res 6:', res6);
    if (res6.success === true && res6.currentViolationCount === 3 && res6.remainingAttempts === 0) {
      console.log('✅ TEST 6 PASSED: Remained capped at 3/3 without incrementing to 4.\n');
    } else {
      console.error('❌ TEST 6 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // TEST 7: DB Persistence Check
    // -------------------------------------------------------------
    console.log('--- TEST 7: Database Persistence Check ---');
    const dbStatus = await prisma.hospitalSecurityStatus.findUnique({
      where: { hospitalId: testHospital.id }
    });
    const violationCountDB = await prisma.captureViolation.count({
      where: { hospitalId: testHospital.id }
    });

    console.log(`DB Status: ${dbStatus.status}, Count: ${dbStatus.currentViolationCount}, Total Violation Records in DB: ${violationCountDB}`);
    if (dbStatus.status === 'TEMPORARILY_BLOCKED' && dbStatus.currentViolationCount === 3) {
      console.log('✅ TEST 7 PASSED: Database state verified cleanly.\n');
    } else {
      console.error('❌ TEST 7 FAILED');
      process.exit(1);
    }

    // Reset hospital back to ACTIVE for developer test environment
    await prisma.hospitalSecurityStatus.update({
      where: { hospitalId: testHospital.id },
      data: {
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: 6
      }
    });

    await prisma.user.update({
      where: { id: testHospitalUser.id },
      data: { status: 'ACTIVE' }
    });

    console.log('🧹 [TEST CLEANUP] Reset hospital back to ACTIVE with securityEpoch 6.');
    console.log('\n=== ALL SECURITY CONFIRMATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('❌ UNHANDLED EXCEPTION IN TEST SUITE:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
