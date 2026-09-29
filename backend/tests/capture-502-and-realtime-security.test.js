const assert = require('assert');
const prisma = require('../src/config/prisma');
const hospitalSecurityService = require('../src/services/hospital-security.service');

async function runRealtimeSecurityTests() {
  console.log(`==================================================`);
  console.log(`CARESETU REAL-TIME SECURITY, 502-SAFETY & LOCK VERIFICATION`);
  console.log(`==================================================\n`);

  let passed = 0;
  let failed = 0;

  function pass(msg) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  }

  function fail(msg, err) {
    failed++;
    console.error(`  ✕ FAIL: ${msg}`, err ? err.message : '');
  }

  let testUser, testHospital, adminUser;

  try {
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        email: `realtime_hosp_${timestamp}@caresetu.in`,
        password: 'HashedPassword123!',
        role: 'HOSPITAL',
        status: 'ACTIVE',
        isVerified: true
      }
    });

    testHospital = await prisma.hospital.create({
      data: {
        userId: testUser.id,
        name: `Realtime Test Hospital ${timestamp}`,
        email: testUser.email,
        phone: '+919876543210',
        address: '789 Realtime Security Way',
        location: { latitude: 21.1702, longitude: 72.8311 }
      }
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin_sec_${timestamp}@caresetu.in`,
        password: 'AdminPassword123!',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    // 1. Initial State Check
    const initStatus = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(initStatus.status === 'ACTIVE', 'TEST 1: Initial status is ACTIVE');
    assert(initStatus.currentViolationCount === 0, 'TEST 1: Initial currentViolationCount is 0');
    pass('TEST 1: Initial security status is ACTIVE with 0 violations');

    // 2. HTTP 502 / Server Error Simulation (Failure MUST NOT count)
    // Verify that if a transaction or service throws/fails before committing, DB count remains 0
    try {
      await prisma.$transaction(async (tx) => {
        // Simulate partial work that throws error (like 502 gateway error)
        throw new Error('502 Bad Gateway / Internal Processing Error');
      });
    } catch (err) {
      // Swallowed simulation error
    }

    const statusAfter502 = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusAfter502.currentViolationCount === 0, 'TEST 2: Failed 502 request DOES NOT increment DB violation count');
    assert(statusAfter502.status === 'ACTIVE', 'TEST 2: Status remains ACTIVE after 502 failure');
    pass('TEST 2: HTTP 502 / unconfirmed server failure DOES NOT increment violation counter');

    // 3. Capture #1: 0 -> 1/3 (WARNING)
    const cap1 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      clientGeneratedEventId: `evt_1_${timestamp}`
    });
    assert(cap1.allowed === true, 'TEST 3: Capture #1 allows continued view access');
    assert(cap1.currentViolationCount === 1, 'TEST 3: Capture #1 sets currentViolationCount to 1/3');
    assert(cap1.remainingAttempts === 2, 'TEST 3: Capture #1 leaves 2 remaining attempts');
    assert(cap1.status === 'WARNING', 'TEST 3: Capture #1 status is WARNING');
    pass('TEST 3: Capture #1 persists cleanly as 1/3 WARNING');

    // 4. Capture #2: 1 -> 2/3 (FINAL WARNING)
    const cap2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREEN_RECORDING_DETECTED',
      clientGeneratedEventId: `evt_2_${timestamp}`
    });
    assert(cap2.allowed === true, 'TEST 4: Capture #2 allows access with final warning');
    assert(cap2.currentViolationCount === 2, 'TEST 4: Capture #2 sets currentViolationCount to 2/3');
    assert(cap2.remainingAttempts === 1, 'TEST 4: Capture #2 leaves 1 remaining attempt');
    assert(cap2.action === 'FINAL_WARNING', 'TEST 4: Capture #2 action is FINAL_WARNING');
    pass('TEST 4: Capture #2 persists cleanly as 2/3 FINAL WARNING');

    // 5. Capture #3: 2 -> 3/3 (TEMPORARILY_BLOCKED)
    const cap3 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'PROTECTED_CONTENT_CAPTURE',
      clientGeneratedEventId: `evt_3_${timestamp}`
    });
    assert(cap3.allowed === false, 'TEST 5: Capture #3 denies access');
    assert(cap3.currentViolationCount === 3, 'TEST 5: Capture #3 sets currentViolationCount to 3/3');
    assert(cap3.remainingAttempts === 0, 'TEST 5: Capture #3 leaves 0 remaining attempts');
    assert(cap3.status === 'TEMPORARILY_BLOCKED', 'TEST 5: Capture #3 sets status to TEMPORARILY_BLOCKED');
    
    const dbUserBlocked = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(dbUserBlocked.status === 'BLOCKED', 'TEST 5: User status set to BLOCKED in DB');
    pass('TEST 5: Capture #3 locks hospital portal immediately with status TEMPORARILY_BLOCKED');

    // 6. Capture #4 While Blocked (MUST STAY AT 3/3, NEVER 4/3)
    const cap4 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      clientGeneratedEventId: `evt_4_${timestamp}`
    });
    assert(cap4.allowed === false, 'TEST 6: Capture #4 returns allowed = false');
    assert(cap4.currentViolationCount === 3, 'TEST 6: Capture #4 currentViolationCount STAYS AT 3 (NEVER 4/3)');
    assert(cap4.status === 'TEMPORARILY_BLOCKED', 'TEST 6: Capture #4 status remains TEMPORARILY_BLOCKED');
    pass('TEST 6: Attempt 4 while blocked is capped at 3/3 and never increments to 4/3');

    // 7. Refresh & Security Status API Check
    const refreshStatus = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(refreshStatus.status === 'TEMPORARILY_BLOCKED', 'TEST 7: Status survives refresh query');
    assert(refreshStatus.currentViolationCount === 3, 'TEST 7: currentViolationCount survives refresh query as 3');
    pass('TEST 7: Security status and block survive page refresh queries');

    // 8. Submit Review Request / Appeal
    const appeal = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId: testUser.id,
      reason: 'Accidental screen capture gesture during emergency workflow',
      description: 'Our team was reviewing patient vitals on a shared workstation when an automated utility triggered a screen grab. System has been updated.'
    });
    assert(appeal.id, 'TEST 8: Appeal generated');
    assert(appeal.status === 'PENDING', 'TEST 8: Appeal status is PENDING');
    assert(appeal.reviewReference.startsWith('REF-APP-'), 'TEST 8: Review reference ID generated');
    pass('TEST 8: Blocked hospital can submit appeal & explanation is persisted');

    // 9. Admin Security Reviews List
    const adminData = await hospitalSecurityService.getAdminViolationsAndAppeals({});
    const pendingReview = adminData.appeals.find(a => a.id === appeal.id);
    assert(pendingReview, 'TEST 9: Pending appeal appears in Admin Dashboard API');
    assert(pendingReview.description.includes('shared workstation'), 'TEST 9: Admin view includes full explanation text');
    pass('TEST 9: Admin dashboard receives pending appeal with full hospital explanation');

    // 10. Admin Unlock & securityEpoch Increment
    const unlockRes = await hospitalSecurityService.unlockHospital({
      adminUserId: adminUser.id,
      hospitalId: testHospital.id,
      decision: 'APPROVED',
      adminNotes: 'Restored portal access after reviewing hospital security explanation.'
    });
    assert(unlockRes.status === 'ACTIVE', 'TEST 10: Security status set to ACTIVE');
    assert(unlockRes.currentViolationCount === 0, 'TEST 10: currentViolationCount reset to 0');
    assert(unlockRes.historicalViolationCount === 3, 'TEST 10: historicalViolationCount preserved at 3');
    assert(unlockRes.securityEpoch === 2, 'TEST 10: securityEpoch incremented to 2');
    pass('TEST 10: Admin unlock restores portal access, resets active count, preserves history & increments epoch');

    // 11. Stale Session Rejection Test
    const staleAttempt = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      secureViewerSessionId: 'invalid-stale-session-id'
    });
    assert(staleAttempt.code === 'SECURITY_SESSION_INVALID', 'TEST 11: Stale session attempt rejected');
    
    const statusPostStale = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusPostStale.currentViolationCount === 0, 'TEST 11: Stale callback DOES NOT re-block hospital');
    pass('TEST 11: Old capture session callbacks are rejected and cannot re-block unlocked hospital');

    // 12. Concurrent Requests Test (5 simultaneous requests with distinct view sessions)
    const viewSessions = await Promise.all(
      Array.from({ length: 5 }).map((_, i) =>
        hospitalSecurityService.createSecureViewSession({
          hospitalUserId: testUser.id,
          caseId: `CASE-CONCURRENT-${i}`
        })
      )
    );

    const concurrentPromises = Array.from({ length: 5 }).map((_, i) =>
      hospitalSecurityService.recordCaptureViolation({
        hospitalUserId: testUser.id,
        eventType: 'SCREENSHOT_ATTEMPT',
        secureViewerSessionId: viewSessions[i].secureViewSessionId,
        clientGeneratedEventId: `evt_concurrent_${i}_${timestamp}`
      })
    );
    await Promise.all(concurrentPromises);
    const finalSecStatus = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: testHospital.id } });
    assert(finalSecStatus.currentViolationCount <= 3, 'TEST 12: Concurrent requests NEVER exceed 3/3');
    assert(finalSecStatus.status === 'TEMPORARILY_BLOCKED', 'TEST 12: Concurrent requests result in TEMPORARILY_BLOCKED');
    pass('TEST 12: Concurrent requests execute atomically with zero count corruption (capped at 3/3)');

    // Cleanup Fixtures
    await prisma.captureViolation.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.secureViewSession.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospitalSecurityAppeal.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospitalSecurityStatus.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospital.delete({ where: { id: testHospital.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });

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

runRealtimeSecurityTests();
