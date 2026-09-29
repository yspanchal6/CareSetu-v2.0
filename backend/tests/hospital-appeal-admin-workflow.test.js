const assert = require('assert');
const prisma = require('../src/config/prisma');
const hospitalSecurityService = require('../src/services/hospital-security.service');
const jwt = require('jsonwebtoken');

async function runAppealAdminWorkflowTests() {
  console.log(`==================================================`);
  console.log(`CARESETU APPEAL & ADMIN WORKFLOW VERIFICATION`);
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
        email: `appeal_hosp_${timestamp}@caresetu.in`,
        password: 'hashed_password_123',
        role: 'HOSPITAL',
        status: 'BLOCKED'
      }
    });

    testHospital = await prisma.hospital.create({
      data: {
        userId: testUser.id,
        name: `Test Hospital ${timestamp}`,
        email: testUser.email,
        phone: '+919876543210',
        address: '123 Health Ave',
        location: { latitude: 21.1702, longitude: 72.8311 }
      }
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin_reviewer_${timestamp}@caresetu.in`,
        password: 'admin_password_123',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    // Create initial blocked security status
    await prisma.hospitalSecurityStatus.create({
      data: {
        hospitalId: testHospital.id,
        status: 'TEMPORARILY_BLOCKED',
        violationCount: 3,
        currentViolationCount: 3,
        historicalViolationCount: 3,
        securityEpoch: 1,
        blockReason: 'Screen capture violation limit reached (3 of 3)'
      }
    });

    // TEST 1: Blocked hospital can submit appeal & explanation is persisted
    const appeal = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId: testUser.id,
      reason: 'Accidental screen recording software background process',
      description: 'Our emergency staff was running standard software update recorder which triggered capture warning. We have terminated the application.'
    });

    assert(appeal.id, 'TEST 1: Appeal ID generated');
    assert(appeal.status === 'PENDING', 'TEST 1: Appeal status is PENDING');
    assert(appeal.description.includes('standard software update'), 'TEST 1: Appeal explanation is persisted in DB');
    assert(appeal.reviewReference.startsWith('REF-APP-'), 'TEST 1: Review reference ID generated (REF-APP-XXXX)');
    pass('TEST 1: Blocked hospital can submit appeal & explanation is persisted');

    // TEST 2: Hospital remains blocked after appeal submission
    const statusAfterAppeal = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusAfterAppeal.status === 'UNDER_REVIEW', 'TEST 2: Status updated to UNDER_REVIEW');
    assert(statusAfterAppeal.currentViolationCount === 3, 'TEST 2: Violation count remains 3/3');
    pass('TEST 2: Hospital is NOT automatically unblocked after submitting appeal');

    // TEST 3: Appeal appears in Admin Dashboard API
    const adminData = await hospitalSecurityService.getAdminViolationsAndAppeals({});
    const foundAppeal = adminData.appeals.find(a => a.id === appeal.id);
    assert(foundAppeal, 'TEST 3: Appeal returned in Admin Appeals list');
    assert(foundAppeal.reviewReference === appeal.reviewReference, 'TEST 3: Review reference matches');
    assert(foundAppeal.description.includes('standard software update'), 'TEST 3: Admin dashboard API returns complete explanation');
    pass('TEST 3: Appeal appears in Admin Dashboard with full explanation & review reference');

    // TEST 4: Admin: Keep Blocked (Reject Appeal)
    const keepBlockedRes = await hospitalSecurityService.keepBlockedHospital({
      adminUserId: adminUser.id,
      hospitalId: testHospital.id,
      appealId: appeal.id,
      adminNotes: 'Insufficient explanation for automated recording software.'
    });

    assert(keepBlockedRes.status === 'TEMPORARILY_BLOCKED', 'TEST 4: Status remains TEMPORARILY_BLOCKED');
    
    const rejectedAppeal = await prisma.hospitalSecurityAppeal.findUnique({ where: { id: appeal.id } });
    assert(rejectedAppeal.status === 'REJECTED', 'TEST 4: Appeal status set to REJECTED');
    assert(rejectedAppeal.reviewedBy === adminUser.id, 'TEST 4: reviewedBy records admin user ID');
    pass('TEST 4: Admin can review & keep hospital blocked (Reject appeal)');

    // TEST 5: Admin Unlock & Epoch Increment
    const unlockRes = await hospitalSecurityService.unlockHospital({
      adminUserId: adminUser.id,
      hospitalId: testHospital.id,
      decision: 'APPROVED',
      adminNotes: 'Reviewed second appeal and reinstated access.'
    });

    assert(unlockRes.status === 'ACTIVE', 'TEST 5: Security status updated to ACTIVE');
    assert(unlockRes.securityEpoch === 2, 'TEST 5: securityEpoch incremented (1 -> 2)');
    assert(unlockRes.currentViolationCount === 0, 'TEST 5: currentViolationCount reset to 0');
    assert(unlockRes.historicalViolationCount === 3, 'TEST 5: historicalViolationCount preserved at 3');
    
    const dbUserAfterUnlock = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert(dbUserAfterUnlock.status === 'ACTIVE', 'TEST 5: User status restored to ACTIVE in DB');
    pass('TEST 5: Admin unlock restores portal access, increments epoch & preserves history');

    // TEST 6: Old capture session rejected after unlock
    const oldSessionAttempt = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      secureViewerSessionId: 'invalid-old-session-id'
    });
    assert(oldSessionAttempt.code === 'SECURITY_SESSION_INVALID', 'TEST 6: Invalid/old session rejected with SECURITY_SESSION_INVALID');
    
    const statusAfterOldSession = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    assert(statusAfterOldSession.currentViolationCount === 0, 'TEST 6: Old session DOES NOT re-block unlocked hospital');
    pass('TEST 6: Old capture session cannot immediately re-block unlocked hospital');

    // TEST 7: RBAC Middleware Enforcement (Non-admin rejection)
    const { requireRole } = require('../src/middleware/auth.middleware');
    const mockReqHospital = { user: { role: 'HOSPITAL', id: testUser.id } };
    const mockRes = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    let nextCalled = false;
    await requireRole('ADMIN')(mockReqHospital, mockRes, () => { nextCalled = true; });

    assert(mockRes.statusCode === 403, 'TEST 7: Non-admin request rejected with 403 Forbidden');
    assert(nextCalled === false, 'TEST 7: requireRole middleware does NOT proceed for non-admin');
    pass('TEST 7: Non-admin role strictly forbidden from admin security & unlock endpoints');

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

runAppealAdminWorkflowTests();
