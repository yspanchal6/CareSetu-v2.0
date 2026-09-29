const prisma = require('../src/config/prisma');
const hospitalSecurityService = require('../src/services/hospital-security.service');

async function runCaptureViolationSecurityTests() {
  console.log('=== STARTING HOSPITAL CAPTURE VIOLATION & BLOCKING SECURITY TESTS ===');
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
    // 1. Setup Test User & Hospital
    const testEmail = `test.hospital.sec.${Date.now()}@caresetu.in`;
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
        name: 'CareSetu Test Security Hospital',
        address: '123 Security Way, Ahmedabad',
        phone: '+919876543210',
        email: testEmail,
        location: { latitude: 23.0225, longitude: 72.5714 }
      }
    });

    console.log(`\n[Fixture Created] Hospital ID: ${testHospital.id}, User ID: ${testUser.id}`);

    // Test 1: Attempt 1 -> Count 1, WARNING, Allowed
    const res1 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });

    assert(res1.allowed === true, 'Attempt 1 allows continued access');
    assert(res1.attemptNumber === 1, 'Attempt 1 count is 1');
    assert(res1.remainingAttempts === 2, 'Attempt 1 leaves 2 remaining attempts');
    assert(res1.action === 'WARNING', 'Attempt 1 action is WARNING');

    // Test 2: Deduplication (Same event within 5 seconds)
    const resDedup = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });
    assert(resDedup.deduplicated === true, 'Duplicate capture within 5 seconds is debounced');
    assert(resDedup.attemptNumber === 1, 'Debounced attempt does not increment violation count');

    // Wait 500ms and simulate Attempt 2 (force bypassing dedup timestamp by directly updating detectedAt in fixture)
    await prisma.captureViolation.updateMany({
      where: { hospitalId: testHospital.id },
      data: { detectedAt: new Date(Date.now() - 6000) }
    });

    // Test 3: Attempt 2 -> Count 2, FINAL_WARNING, Allowed
    const res2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREEN_RECORDING_DETECTED',
      platform: 'WEB'
    });

    assert(res2.allowed === true, 'Attempt 2 allows access with final warning');
    assert(res2.attemptNumber === 2, 'Attempt 2 count is 2');
    assert(res2.action === 'FINAL_WARNING', 'Attempt 2 action is FINAL_WARNING');
    assert(res2.message.includes('One more'), 'Attempt 2 contains final warning text');

    // Age second violation
    await prisma.captureViolation.updateMany({
      where: { hospitalId: testHospital.id },
      data: { detectedAt: new Date(Date.now() - 6000) }
    });

    // Test 4: Attempt 3 -> TEMPORARY_BLOCK, Allowed = false
    const res3 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      platform: 'WEB'
    });

    assert(res3.allowed === false, 'Attempt 3 blocks hospital access');
    assert(res3.attemptNumber === 3, 'Attempt 3 count is 3');
    assert(res3.remainingAttempts === 0, 'Attempt 3 leaves 0 remaining attempts');
    assert(res3.action === 'TEMPORARY_BLOCK', 'Attempt 3 action is TEMPORARY_BLOCK');
    assert(res3.status === 'TEMPORARILY_BLOCKED', 'Security status becomes TEMPORARILY_BLOCKED');

    // Test 5: User Account Status set to BLOCKED
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(updatedUser.status === 'BLOCKED', 'User status set to BLOCKED in DB');

    // Test 6: Check Status API
    const statusRes = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusRes.status === 'TEMPORARILY_BLOCKED', 'getHospitalSecurityStatus returns TEMPORARILY_BLOCKED');
    assert(statusRes.violationCount === 3, 'getHospitalSecurityStatus returns violationCount 3');

    // Test 7: Submit Security Appeal
    const appealRes = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId: testUser.id,
      reason: 'Accidental screen capture gesture',
      description: 'Accidental keyboard shortcut pressed while viewing report.'
    });
    assert(appealRes.id !== undefined, 'Appeal record created successfully');
    assert(appealRes.status === 'PENDING', 'Appeal initial status is PENDING');

    const statusPostAppeal = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusPostAppeal.status === 'UNDER_REVIEW', 'Hospital status updated to UNDER_REVIEW after appeal');

    // Test 8: Admin Unlock
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const adminUserId = adminUser ? adminUser.id : testUser.id;

    const unlockRes = await hospitalSecurityService.unlockHospital({
      adminUserId,
      hospitalId: testHospital.id,
      decision: 'APPROVED',
      adminNotes: 'Restored after reviewing appeal.'
    });

    assert(unlockRes.success === true, 'Admin unlock succeeded');
    assert(unlockRes.status === 'ACTIVE', 'Status restored to ACTIVE');

    const restoredUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(restoredUser.status === 'ACTIVE', 'User status restored to ACTIVE in DB');

    // Cleanup Test Fixture
    await prisma.captureViolation.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospitalSecurityAppeal.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospitalSecurityStatus.deleteMany({ where: { hospitalId: testHospital.id } });
    await prisma.hospital.delete({ where: { id: testHospital.id } });
    await prisma.user.delete({ where: { id: testUser.id } });

    console.log(`\n=== VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test Execution Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCaptureViolationSecurityTests();
