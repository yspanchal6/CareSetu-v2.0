const prisma = require('../src/config/prisma');
const hospitalSecurityService = require('../src/services/hospital-security.service');

async function runStateMachineTests() {
  console.log('==================================================');
  console.log('CARESETU CAPTURE COUNTER & STATE MACHINE VERIFICATION');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Setup Test Fixture
    const testEmail = `sec.counter.${Date.now()}@caresetu.in`;
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'HashedPassword123!',
        role: 'HOSPITAL',
        status: 'ACTIVE',
        isVerified: true
      }
    });

    const testHospital = await prisma.hospital.create({
      data: {
        userId: testUser.id,
        name: 'CareSetu Counter Test Hospital',
        address: '456 Security Blvd, Surat',
        phone: '+919876500000',
        email: testEmail,
        location: { latitude: 21.1702, longitude: 72.8311 }
      }
    });

    console.log(`[Fixture Created] Hospital ID: ${testHospital.id}`);

    // TEST 1: Initial state 0/3
    const initialStatus = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(initialStatus.currentViolationCount === 0, 'TEST 1: Initial currentViolationCount is 0');
    assert(initialStatus.status === 'ACTIVE', 'TEST 1: Initial status is ACTIVE');

    // TEST 2: Attempt 1 -> 1/3
    const res1 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });
    assert(res1.allowed === true, 'TEST 2: Attempt 1 allows continued access');
    assert(res1.currentViolationCount === 1, 'TEST 2: Attempt 1 sets currentViolationCount to 1');
    assert(res1.remainingAttempts === 2, 'TEST 2: Attempt 1 leaves 2 remaining attempts');
    assert(res1.status === 'WARNING', 'TEST 2: Attempt 1 status is WARNING');

    // TEST 3: Debouncing within 5s
    const resDedup = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });
    assert(resDedup.deduplicated === true, 'TEST 3: Rapid duplicate capture within 5s is debounced');
    assert(resDedup.currentViolationCount === 1, 'TEST 3: Debounced event does NOT increment counter');

    // Bypass 5s timestamp for next test
    await prisma.captureViolation.updateMany({
      where: { hospitalId: testHospital.id },
      data: { detectedAt: new Date(Date.now() - 6000) }
    });

    // TEST 4: Attempt 2 -> 2/3
    const res2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREEN_RECORDING_DETECTED',
      platform: 'WEB'
    });
    assert(res2.allowed === true, 'TEST 4: Attempt 2 allows access with final warning');
    assert(res2.currentViolationCount === 2, 'TEST 4: Attempt 2 sets currentViolationCount to 2');
    assert(res2.action === 'FINAL_WARNING', 'TEST 4: Attempt 2 action is FINAL_WARNING');

    // Bypass 5s timestamp for next test
    await prisma.captureViolation.updateMany({
      where: { hospitalId: testHospital.id },
      data: { detectedAt: new Date(Date.now() - 6000) }
    });

    // TEST 5: Attempt 3 -> 3/3 -> TEMPORARILY_BLOCKED
    const res3 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });
    assert(res3.allowed === false, 'TEST 5: Attempt 3 blocks hospital access');
    assert(res3.currentViolationCount === 3, 'TEST 5: Attempt 3 sets currentViolationCount to 3');
    assert(res3.status === 'TEMPORARILY_BLOCKED', 'TEST 5: Attempt 3 status is TEMPORARILY_BLOCKED');

    const blockedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(blockedUser.status === 'BLOCKED', 'TEST 5: User status set to BLOCKED in DB');

    // TEST 6: Attempt 4 -> MUST REMAIN 3/3 (NEVER 4/3!)
    await prisma.captureViolation.updateMany({
      where: { hospitalId: testHospital.id },
      data: { detectedAt: new Date(Date.now() - 6000) }
    });

    const res4 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });
    assert(res4.allowed === false, 'TEST 6: Attempt 4 returns allowed = false');
    assert(res4.currentViolationCount === 3, 'TEST 6: Attempt 4 currentViolationCount STAYS 3 (NEVER 4/3)');
    assert(res4.status === 'TEMPORARILY_BLOCKED', 'TEST 6: Attempt 4 status remains TEMPORARILY_BLOCKED');

    // TEST 7: Appeal Submission while Blocked
    const appealRes = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId: testUser.id,
      reason: 'Accidental shortcut pressed',
      description: 'Accidental screen capture attempt while viewing ECG report.'
    });
    assert(appealRes.id !== undefined, 'TEST 7: Appeal submission allowed for blocked hospital');
    assert(appealRes.status === 'PENDING', 'TEST 7: Appeal created with PENDING status');

    // TEST 8: Admin Unlock & Security Epoch Increment
    const secBeforeUnlock = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: testHospital.id } });
    const oldEpoch = secBeforeUnlock.securityEpoch;

    const unlockRes = await hospitalSecurityService.unlockHospital({
      adminUserId: testUser.id,
      hospitalId: testHospital.id,
      decision: 'APPROVED',
      adminNotes: 'Restored after security review'
    });

    assert(unlockRes.success === true, 'TEST 8: Admin unlock succeeded');
    assert(unlockRes.status === 'ACTIVE', 'TEST 8: Status updated to ACTIVE');
    assert(unlockRes.currentViolationCount === 0, 'TEST 8: currentViolationCount reset to 0');
    assert(unlockRes.historicalViolationCount === 3, 'TEST 8: historicalViolationCount preserved at 3');
    assert(unlockRes.securityEpoch === oldEpoch + 1, 'TEST 8: securityEpoch incremented (epoch 1 -> 2)');

    const restoredUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(restoredUser.status === 'ACTIVE', 'TEST 8: User status restored to ACTIVE');

    // TEST 9: Old Session Callback Rejection (Stale Epoch Protection)
    const oldSession = await prisma.secureViewSession.create({
      data: {
        hospitalId: testHospital.id,
        caseId: 'CASE-OLD-EPOCH',
        securityEpoch: oldEpoch, // Epoch 1 (stale!)
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 3600000)
      }
    });

    const resStale = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      secureViewerSessionId: oldSession.id
    });
    assert(resStale.allowed === false, 'TEST 9: Stale epoch callback rejected');
    assert(resStale.code === 'SECURITY_SESSION_INVALID', 'TEST 9: Code is SECURITY_SESSION_INVALID');

    const statusAfterStale = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusAfterStale.currentViolationCount === 0, 'TEST 9: Stale callback DOES NOT re-block hospital or increment counter');

    // TEST 10: Post-Unlock New Enforcement Window
    const newSession = await hospitalSecurityService.createSecureViewSession({
      hospitalUserId: testUser.id,
      caseId: 'CASE-NEW-EPOCH'
    });
    assert(newSession.securityEpoch === oldEpoch + 1, 'TEST 10: New view session uses new securityEpoch 2');

    const resNewEpochCap = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      secureViewerSessionId: newSession.secureViewSessionId
    });
    assert(resNewEpochCap.allowed === true, 'TEST 10: Post-unlock capture starts allowed = true');
    assert(resNewEpochCap.currentViolationCount === 1, 'TEST 10: Post-unlock capture counter starts cleanly at 1/3 (NOT 4/3)');

    // TEST 11: Concurrent Capture Event Safety (Atomic Counter)
    const concurrentPromises = Array.from({ length: 5 }).map((_, i) =>
      hospitalSecurityService.recordCaptureViolation({
        hospitalUserId: testUser.id,
        eventType: 'SCREENSHOT_ATTEMPT',
        clientGeneratedEventId: `evt_concurrent_${i}_${Date.now()}`
      })
    );
    await Promise.all(concurrentPromises);
    const finalSecStatus = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: testHospital.id } });

    assert(finalSecStatus.currentViolationCount <= 3, 'TEST 11: Concurrent requests NEVER push currentViolationCount above 3');
    assert(finalSecStatus.status === 'TEMPORARILY_BLOCKED', 'TEST 11: Concurrent requests result in TEMPORARILY_BLOCKED');

    // Cleanup Fixtures
    await prisma.captureViolation.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.secureViewSession.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospitalSecurityAppeal.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospitalSecurityStatus.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospital.delete({ where: { id: testHospital.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    console.log(`\n==================================================`);
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`==================================================`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test Execution Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStateMachineTests();
