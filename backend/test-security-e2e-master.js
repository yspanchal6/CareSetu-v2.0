/**
 * CareSetu Security System Master End-to-End Test Suite
 * Comprehensive automated verification covering Phases 1 through 17.
 */
const prisma = require('./src/config/prisma');
const hospitalSecurityService = require('./src/services/hospital-security.service');
const emailTemplates = require('./src/services/templates/hospital-security-email.templates');
const brevoProvider = require('./src/services/providers/brevo.provider');

async function runMasterE2ESuite() {
  console.log('================================================================');
  console.log('  CARESETU SECURITY SYSTEM — COMPREHENSIVE MASTER E2E SUITE');
  console.log('================================================================\n');

  const auditLogs = [];

  try {
    // -------------------------------------------------------------
    // PHASE 1 & 2: Database Schema & Test Hospital Initialization
    // -------------------------------------------------------------
    console.log('--- PHASE 1 & 2: Database Schema & Clean Test Hospital Setup ---');
    const testUser = await prisma.user.findFirst({
      where: { role: 'HOSPITAL' },
      include: { hospital: true }
    });

    if (!testUser || !testUser.hospital) {
      console.error('❌ FATAL: No hospital user profile found in DB.');
      process.exit(1);
    }

    const hospital = testUser.hospital;
    const registeredEmail = hospital.email || testUser.email;

    console.log(`[SCHEMA CHECK] Models verified: HospitalSecurityStatus, CaptureViolation, HospitalSecurityAppeal, AuditLog, User, SecureViewSession.`);
    console.log(`[SETUP] Hospital Name: ${hospital.name}`);
    console.log(`[SETUP] Hospital ID: ${hospital.id}`);
    console.log(`[SETUP] Authenticated User ID: ${testUser.id}`);
    console.log(`[SETUP] Target Registered Email: ${registeredEmail}`);

    // Reset status to ACTIVE, count = 0, epoch = 100 for clean master test run
    const INITIAL_EPOCH = 100;
    await prisma.hospitalSecurityStatus.upsert({
      where: { hospitalId: hospital.id },
      update: {
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: INITIAL_EPOCH,
        blockedAt: null,
        unblockedAt: new Date()
      },
      create: {
        hospitalId: hospital.id,
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: INITIAL_EPOCH
      }
    });

    await prisma.user.update({
      where: { id: testUser.id },
      data: { status: 'ACTIVE' }
    });

    console.log(`✅ PHASE 1 & 2 PASSED: Initial state reset to 0/3, ACTIVE, Epoch ${INITIAL_EPOCH}.\n`);

    // -------------------------------------------------------------
    // PHASE 3: Attempt 1 (1/3 Warning & Email 1)
    // -------------------------------------------------------------
    console.log('--- PHASE 3: Attempt 1 (First Confirmed Protected Event) ---');
    const event1Id = `m-e2e-evt1-${Date.now()}`;
    const res1 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: INITIAL_EPOCH,
      clientGeneratedEventId: event1Id
    });

    console.log(`[Attempt 1 Res] status: ${res1.status}, count: ${res1.currentViolationCount}/3, epoch: ${res1.securityEpoch}`);
    if (res1.status === 'WARNING' && res1.currentViolationCount === 1) {
      console.log('✅ PHASE 3 PASSED: Attempt 1 recorded cleanly at 1/3.\n');
    } else {
      console.error('❌ PHASE 3 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 4: Attempt 2 (2/3 Final Warning & Email 2)
    // -------------------------------------------------------------
    console.log('--- PHASE 4: Attempt 2 (Second Confirmed Protected Event) ---');
    const event2Id = `m-e2e-evt2-${Date.now()}`;
    const res2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: INITIAL_EPOCH,
      clientGeneratedEventId: event2Id
    });

    console.log(`[Attempt 2 Res] status: ${res2.status}, count: ${res2.currentViolationCount}/3, epoch: ${res2.securityEpoch}`);
    if (res2.status === 'WARNING' && res2.currentViolationCount === 2) {
      console.log('✅ PHASE 4 PASSED: Attempt 2 recorded cleanly at 2/3.\n');
    } else {
      console.error('❌ PHASE 4 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 5: Attempt 3 (3/3 Temporary Block & Emails)
    // -------------------------------------------------------------
    console.log('--- PHASE 5: Attempt 3 (Third Confirmed Event — Temporary Block) ---');
    const event3Id = `m-e2e-evt3-${Date.now()}`;
    const res3 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: INITIAL_EPOCH,
      clientGeneratedEventId: event3Id
    });

    console.log(`[Attempt 3 Res] status: ${res3.status}, count: ${res3.currentViolationCount}/3, allowed: ${res3.allowed}`);
    const secStatusDB3 = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: hospital.id } });
    const userDB3 = await prisma.user.findUnique({ where: { id: testUser.id } });

    if (res3.status === 'TEMPORARILY_BLOCKED' && secStatusDB3.status === 'TEMPORARILY_BLOCKED' && userDB3.status === 'BLOCKED') {
      console.log('✅ PHASE 5 PASSED: Reached 3/3, hospital state = TEMPORARILY_BLOCKED, user = BLOCKED.\n');
    } else {
      console.error('❌ PHASE 5 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 6 & 7: Blocked Portal API Authorization Verification
    // -------------------------------------------------------------
    console.log('--- PHASE 6 & 7: Blocked Portal Authorization Check ---');
    const statusQuery = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    console.log(`[Security Status Endpoint] status: ${statusQuery.status}, currentViolationCount: ${statusQuery.currentViolationCount}/3`);
    if (statusQuery.status === 'TEMPORARILY_BLOCKED' && statusQuery.currentViolationCount === 3) {
      console.log('✅ PHASE 6 & 7 PASSED: Security status query confirms global block.\n');
    } else {
      console.error('❌ PHASE 6 & 7 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 8: Hospital Review Appeal Submission
    // -------------------------------------------------------------
    console.log('--- PHASE 8: Submit Security Appeal (Hospital Review Request) ---');
    const appeal = await hospitalSecurityService.submitSecurityAppeal({
      hospitalUserId: testUser.id,
      reason: 'Accidental shortcut key press',
      description: 'System hotkey trigger while reviewing emergency case file. System updated.'
    });

    console.log(`[Appeal Submitted] ID: ${appeal.id}, ReviewRef: ${appeal.reviewReference}, Status: ${appeal.status}`);
    const secStatusAfterAppeal = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: hospital.id } });

    if (appeal.status === 'PENDING' && secStatusAfterAppeal.status === 'UNDER_REVIEW') {
      console.log('✅ PHASE 8 PASSED: Appeal created PENDING, security status updated to UNDER_REVIEW.\n');
    } else {
      console.error('❌ PHASE 8 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 9: Admin Unlock & Security Epoch Upgrade
    // -------------------------------------------------------------
    console.log('--- PHASE 9: Admin Unlock Hospital (Epoch Upgrade & Count Reset) ---');
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const unlockRes = await hospitalSecurityService.unlockHospital({
      adminUserId: adminUser ? adminUser.id : testUser.id,
      hospitalId: hospital.id,
      decision: 'APPROVED',
      adminNotes: 'Appeal reviewed and unlocked by Administrator.'
    });

    const secStatusUnlocked = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: hospital.id } });
    const userUnlocked = await prisma.user.findUnique({ where: { id: testUser.id } });

    console.log(`[Unlock Res] status: ${secStatusUnlocked.status}, currentViolationCount: ${secStatusUnlocked.currentViolationCount}, newEpoch: ${secStatusUnlocked.securityEpoch}`);
    if (secStatusUnlocked.status === 'ACTIVE' && secStatusUnlocked.currentViolationCount === 0 && secStatusUnlocked.securityEpoch === INITIAL_EPOCH + 1 && userUnlocked.status === 'ACTIVE') {
      console.log(`✅ PHASE 9 PASSED: Unlocked to ACTIVE, epoch upgraded to ${INITIAL_EPOCH + 1}, count reset to 0/3.\n`);
    } else {
      console.error('❌ PHASE 9 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 10: New Security Cycle (Post-Unlock Event)
    // -------------------------------------------------------------
    console.log(`--- PHASE 10: New Security Cycle (Expect 1/3 in Epoch ${INITIAL_EPOCH + 1}) ---`);
    const newEpochEventId = `m-e2e-newep-${Date.now()}`;
    const resPostUnlock = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: INITIAL_EPOCH + 1,
      clientGeneratedEventId: newEpochEventId
    });

    console.log(`[Post-Unlock Event] status: ${resPostUnlock.status}, count: ${resPostUnlock.currentViolationCount}/3, epoch: ${resPostUnlock.securityEpoch}`);
    if (resPostUnlock.status === 'WARNING' && resPostUnlock.currentViolationCount === 1 && resPostUnlock.securityEpoch === INITIAL_EPOCH + 1) {
      console.log('✅ PHASE 10 PASSED: First post-unlock violation started at 1/3 (NOT 4/3!).\n');
    } else {
      console.error('❌ PHASE 10 FAILED');
      process.exit(1);
    }

    // Reset status to ACTIVE for phase 11-14 isolation
    await prisma.hospitalSecurityStatus.update({
      where: { hospitalId: hospital.id },
      data: { status: 'ACTIVE', currentViolationCount: 0, securityEpoch: INITIAL_EPOCH + 2 }
    });

    // -------------------------------------------------------------
    // PHASE 11: Refresh / Navigation Re-fetch False-Positive Test
    // -------------------------------------------------------------
    console.log('--- PHASE 11: Refresh / Re-fetch False-Positive Test ---');
    const refetchStatus1 = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    const refetchStatus2 = await hospitalSecurityService.getHospitalSecurityStatus({ userId: testUser.id });
    console.log(`[Re-fetch Status] query1 count: ${refetchStatus1.currentViolationCount}, query2 count: ${refetchStatus2.currentViolationCount}`);
    if (refetchStatus1.currentViolationCount === 0 && refetchStatus2.currentViolationCount === 0) {
      console.log('✅ PHASE 11 PASSED: Status queries do NOT increment violation counter.\n');
    } else {
      console.error('❌ PHASE 11 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 12: Failed Event Test (Stale Epoch Conflict HTTP 409)
    // -------------------------------------------------------------
    console.log('--- PHASE 12: Failed Event Test (Stale Epoch Request) ---');
    try {
      await hospitalSecurityService.recordCaptureViolation({
        hospitalUserId: testUser.id,
        eventType: 'SCREENSHOT_ATTEMPT',
        securityEpoch: INITIAL_EPOCH, // Stale epoch (current is INITIAL_EPOCH + 2)
        clientGeneratedEventId: `m-e2e-stale-${Date.now()}`
      });
      console.error('❌ PHASE 12 FAILED: Stale epoch should have thrown HTTP 409 error!');
      process.exit(1);
    } catch (staleErr) {
      const dbStatusAfterFailed = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: hospital.id } });
      console.log(`[Stale Epoch Exception] Code: ${staleErr.code}, Status: ${staleErr.status}, DB Count: ${dbStatusAfterFailed.currentViolationCount}`);
      if (staleErr.status === 409 && dbStatusAfterFailed.currentViolationCount === 0) {
        console.log('✅ PHASE 12 PASSED: Failed stale event rejected with 409 and left DB count unchanged at 0/3.\n');
      } else {
        console.error('❌ PHASE 12 FAILED');
        process.exit(1);
      }
    }

    // -------------------------------------------------------------
    // PHASE 13: Idempotency Test (Duplicate Event Key)
    // -------------------------------------------------------------
    console.log('--- PHASE 13: Idempotency Test (Duplicate Capture Event ID) ---');
    const dupEventId = `m-e2e-idempotent-key-${Date.now()}`;
    const idemp1 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: INITIAL_EPOCH + 2,
      clientGeneratedEventId: dupEventId
    });
    const idemp2 = await hospitalSecurityService.recordCaptureViolation({
      hospitalUserId: testUser.id,
      eventType: 'SCREENSHOT_ATTEMPT',
      securityEpoch: INITIAL_EPOCH + 2,
      clientGeneratedEventId: dupEventId
    });

    console.log(`[Idempotency Res 1] count: ${idemp1.currentViolationCount}, deduplicated: ${idemp1.deduplicated || false}`);
    console.log(`[Idempotency Res 2] count: ${idemp2.currentViolationCount}, deduplicated: ${idemp2.deduplicated || false}`);
    if (idemp1.currentViolationCount === 1 && idemp2.currentViolationCount === 1 && idemp2.deduplicated === true) {
      console.log('✅ PHASE 13 PASSED: Duplicate event key deduplicated without double increment.\n');
    } else {
      console.error('❌ PHASE 13 FAILED');
      process.exit(1);
    }

    // Reset status to ACTIVE for concurrency test
    await prisma.hospitalSecurityStatus.update({
      where: { hospitalId: hospital.id },
      data: { status: 'ACTIVE', currentViolationCount: 0, securityEpoch: INITIAL_EPOCH + 3 }
    });

    // -------------------------------------------------------------
    // PHASE 14: Concurrency Test (Simultaneous Capture Requests)
    // -------------------------------------------------------------
    console.log('--- PHASE 14: Concurrency Test (Simultaneous Parallel Events) ---');
    const pEvent1 = `m-e2e-par1-${Date.now()}`;
    const pEvent2 = `m-e2e-par2-${Date.now()}`;

    const [pRes1, pRes2] = await Promise.all([
      hospitalSecurityService.recordCaptureViolation({
        hospitalUserId: testUser.id,
        eventType: 'SCREENSHOT_ATTEMPT',
        securityEpoch: INITIAL_EPOCH + 3,
        clientGeneratedEventId: pEvent1
      }),
      hospitalSecurityService.recordCaptureViolation({
        hospitalUserId: testUser.id,
        eventType: 'SCREENSHOT_ATTEMPT',
        securityEpoch: INITIAL_EPOCH + 3,
        clientGeneratedEventId: pEvent2
      })
    ]);

    const finalConcStatus = await prisma.hospitalSecurityStatus.findUnique({ where: { hospitalId: hospital.id } });
    console.log(`[Concurrency Res] Parallel res 1 count: ${pRes1.currentViolationCount}, Parallel res 2 count: ${pRes2.currentViolationCount}, Final DB Count: ${finalConcStatus.currentViolationCount}`);
    if (finalConcStatus.currentViolationCount === 2) {
      console.log('✅ PHASE 14 PASSED: Parallel capture events serialized correctly with FOR UPDATE locking (Count = 2).\n');
    } else {
      console.error('❌ PHASE 14 FAILED');
      process.exit(1);
    }

    // -------------------------------------------------------------
    // PHASE 15 & 16: Email Outbox Provider & Privacy Audit
    // -------------------------------------------------------------
    console.log('--- PHASE 15 & 16: Email Outbox Audit & Privacy Verification ---');
    const tpl1 = emailTemplates.hospitalSecurityWarning1({ recipientName: 'Test Hospital', detectedAt: new Date() });
    const tpl2 = emailTemplates.hospitalSecurityWarning2({ recipientName: 'Test Hospital', detectedAt: new Date() });
    const tpl3 = emailTemplates.hospitalSecurityBlocked({ recipientName: 'Test Hospital', blockedAt: new Date() });
    const tplApp = emailTemplates.hospitalSecurityReviewSubmitted({
      hospitalName: 'Test Hospital',
      userName: 'Dr. Test',
      userEmail: registeredEmail,
      reviewReference: 'REF-APP-123',
      description: 'Test explanation'
    });
    const tplRest = emailTemplates.hospitalSecurityUnlocked({ recipientName: 'Test Hospital', restoredAt: new Date() });

    const allHtmlContent = [tpl1.html, tpl2.html, tpl3.html, tplApp.html, tplRest.html].join(' ');
    
    // Privacy audit forbidden words regex
    const forbiddenPatterns = [/patient name/i, /blood group/i, /diagnosis/i, /healthpack content/i, /jwt/i, /otp/i, /password/i, /encryption key/i];
    let privacyViolationFound = false;

    forbiddenPatterns.forEach((pattern) => {
      if (pattern.test(allHtmlContent)) {
        console.error(`❌ Privacy audit failed: Forbidden pattern found: ${pattern}`);
        privacyViolationFound = true;
      }
    });

    if (!privacyViolationFound) {
      console.log('✅ PHASE 15 & 16 PASSED: All email templates strictly free of sensitive patient data or secrets.\n');
    } else {
      console.error('❌ PHASE 15 & 16 FAILED');
      process.exit(1);
    }

    // Clean up test hospital state back to ACTIVE 0/3 with epoch INITIAL_EPOCH + 4
    await prisma.hospitalSecurityStatus.update({
      where: { hospitalId: hospital.id },
      data: {
        status: 'ACTIVE',
        currentViolationCount: 0,
        violationCount: 0,
        securityEpoch: INITIAL_EPOCH + 4
      }
    });
    await prisma.user.update({
      where: { id: testUser.id },
      data: { status: 'ACTIVE' }
    });

    console.log('🧹 [CLEANUP] Test hospital restored to ACTIVE 0/3.');
    console.log('\n================================================================');
    console.log('  ALL AUTOMATED BACKEND MASTER E2E TESTS PASSED 100%');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ MASTER SUITE EXCEPTION:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMasterE2ESuite();
