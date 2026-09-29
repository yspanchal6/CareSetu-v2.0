const prisma = require('../config/prisma');
const brevoProvider = require('./providers/brevo.provider');
const emailTemplates = require('./templates/hospital-security-email.templates');

const WARNING_MESSAGES = [
  "Protected medical content must not be captured or recorded. This event has been logged.",
  "CareSetu detected a protected-screen capture event. Please stop capturing sensitive HealthPack information.",
  "Patient medical information is protected. Screen capture is not permitted in the Secure HealthPack viewer.",
  "Security notice: protected HealthPack content must remain within the authorized CareSetu viewing session.",
  "Capture protection was triggered. Please stop screen recording or screenshot activity to continue."
];

function getRandomWarningMessage() {
  const index = Math.floor(Math.random() * WARNING_MESSAGES.length);
  return WARNING_MESSAGES[index];
}

/**
 * Idempotent email dispatcher with outbox audit tracking.
 * Server-side determination of authenticated hospital user recipient email.
 */
async function sendIdempotentSecurityEmail({
  idempotencyKey,
  hospitalId,
  hospitalUserId,
  recipientEmail,
  eventType,
  subject,
  html
}) {
  if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
    return;
  }

  // 1. Idempotency Check
  if (idempotencyKey) {
    const existingLog = await prisma.auditLog.findFirst({
      where: {
        action: 'CAPTURE_VIOLATION',
        endpoint: '/api/security/email-notification',
        details: { path: ['idempotencyKey'], equals: idempotencyKey }
      }
    });
    if (existingLog) {
      console.log(`[HospitalSecurityService] Idempotency check: Email already sent for key ${idempotencyKey}`);
      return;
    }
  }

  // 2. Dispatch via Brevo Provider
  let emailStatus = 'FAILED';
  let providerMessageId = null;
  let lastError = null;

  try {
    const result = await brevoProvider.sendEmail({
      to: recipientEmail,
      subject,
      html
    });

    if (result && result.success) {
      emailStatus = 'SENT';
      providerMessageId = result.messageId || `msg-${Date.now()}`;
    } else {
      emailStatus = 'FAILED';
      lastError = result?.error || 'Email provider rejected request or unverified API key';
    }
  } catch (err) {
    emailStatus = 'FAILED';
    lastError = err.message;
  }

  // 3. Persist Delivery Audit Record (Outbox)
  try {
    await prisma.auditLog.create({
      data: {
        userId: hospitalUserId || null,
        action: 'CAPTURE_VIOLATION',
        entity: 'HospitalSecurityStatus',
        entityId: hospitalId,
        endpoint: '/api/security/email-notification',
        details: {
          action: 'SECURITY_EMAIL_DISPATCH',
          idempotencyKey: idempotencyKey || null,
          hospitalId,
          recipientEmail,
          eventType,
          subject,
          status: emailStatus,
          providerMessageId,
          attempts: 1,
          sentAt: new Date(),
          lastError
        }
      }
    });
  } catch (auditErr) {
    console.warn('[HospitalSecurityService] Outbox audit write failure:', auditErr.message);
  }
}

/**
 * Create a server-backed Secure Viewing Session bound to the hospital's securityEpoch.
 */
async function createSecureViewSession({ hospitalUserId, caseId, documentId = null, healthPackId = null }) {
  const hospital = await prisma.hospital.findUnique({
    where: { userId: hospitalUserId },
    include: { securityStatus: true }
  });

  if (!hospital) {
    const err = new Error('Hospital profile not found');
    err.status = 404;
    throw err;
  }

  const secStatus = hospital.securityStatus;
  if (secStatus && secStatus.status === 'TEMPORARILY_BLOCKED') {
    const err = new Error('Hospital portal access is temporarily restricted due to security violations');
    err.status = 403;
    err.code = 'HOSPITAL_PORTAL_BLOCKED';
    throw err;
  }

  const currentEpoch = secStatus ? secStatus.securityEpoch : 1;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h view session limit

  const session = await prisma.secureViewSession.create({
    data: {
      hospitalId: hospital.id,
      caseId,
      documentId: documentId || null,
      healthPackId: healthPackId || null,
      securityEpoch: currentEpoch,
      status: 'ACTIVE',
      expiresAt
    }
  });

  return {
    secureViewSessionId: session.id,
    securityEpoch: currentEpoch,
    expiresAt: session.expiresAt
  };
}

/**
 * Record a capture violation event for a hospital user.
 * Atomic transaction + securityEpoch verification + max 3 capping + idempotency.
 */
async function recordCaptureViolation({
  hospitalUserId,
  eventType = 'SCREENSHOT_ATTEMPT',
  platform = 'WEB',
  caseId = null,
  documentId = null,
  healthPackId = null,
  secureViewerSessionId = null,
  securityEpoch = null,
  clientGeneratedEventId = null,
  metadata = {}
}) {
  if (!hospitalUserId) {
    const err = new Error('Authenticated hospital user ID is required');
    err.status = 401;
    throw err;
  }

  // Sanitize secureViewerSessionId (ignore "undefined", "null", or blank strings to prevent Prisma P2023 UUID errors)
  let cleanSessionId = secureViewerSessionId;
  if (cleanSessionId === 'undefined' || cleanSessionId === 'null' || cleanSessionId === '') {
    cleanSessionId = null;
  }

  const effectiveMetadata = {
    ...metadata,
    ...(clientGeneratedEventId ? { clientGeneratedEventId } : {})
  };

  const requestEpoch = securityEpoch !== undefined && securityEpoch !== null ? securityEpoch : metadata?.securityEpoch;

  // 1. Resolve Hospital from User ID
  const hospital = await prisma.hospital.findUnique({
    where: { userId: hospitalUserId },
    include: {
      user: { select: { id: true, email: true, status: true, role: true } }
    }
  });

  if (!hospital) {
    // Non-hospital role (e.g. PATIENT or DOCTOR) viewing protected content. Return 200 without hospital violation tracking.
    return {
      success: true,
      allowed: true,
      status: 'ACTIVE',
      currentViolationCount: 0,
      historicalViolationCount: 0,
      maxAttempts: 3,
      remainingAttempts: 3,
      securityEpoch: 1,
      action: 'WARNING',
      message: 'Protected event acknowledged for authorized non-hospital viewer.'
    };
  }

  const hospitalId = hospital.id;

  // 2. Perform Atomic Processing inside DB Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Acquire PostgreSQL pessimistic row lock on HospitalSecurityStatus
    try {
      await tx.$queryRaw`SELECT id FROM hospital_security_statuses WHERE "hospitalId" = ${hospitalId} FOR UPDATE`;
    } catch (lockErr) {
      // Row might not exist yet before first creation
    }

    // Lock / Fetch HospitalSecurityStatus
    let secStatus = await tx.hospitalSecurityStatus.findUnique({
      where: { hospitalId }
    });

    if (!secStatus) {
      secStatus = await tx.hospitalSecurityStatus.create({
        data: {
          hospitalId,
          status: 'ACTIVE',
          violationCount: 0,
          currentViolationCount: 0,
          historicalViolationCount: 0,
          securityEpoch: 1
        }
      });
    }

    // CHECK 1: Stale Security Epoch Check (HTTP 409 Conflict)
    if (requestEpoch !== undefined && requestEpoch !== null && Number(requestEpoch) !== secStatus.securityEpoch) {
      const err = new Error('Security event belongs to a stale security epoch.');
      err.status = 409;
      err.code = 'SESSION_STALE';
      err.currentViolationCount = secStatus.currentViolationCount;
      err.securityEpoch = secStatus.securityEpoch;
      throw err;
    }

    // CHECK 2: If ALREADY BLOCKED or current count >= 3
    if (secStatus.status === 'TEMPORARILY_BLOCKED' || secStatus.currentViolationCount >= 3) {
      // Audit blocked attempt (without incrementing count! Stays at 3, never 4!)
      await tx.auditLog.create({
        data: {
          userId: hospitalUserId,
          action: 'CAPTURE_VIOLATION',
          entity: 'HospitalSecurityStatus',
          entityId: hospitalId,
          endpoint: '/api/security/capture-violation',
          details: {
            action: 'CAPTURE_ATTEMPT_WHILE_BLOCKED',
            eventType,
            platform,
            currentViolationCount: 3,
            historicalViolationCount: secStatus.historicalViolationCount,
            securityEpoch: secStatus.securityEpoch
          }
        }
      });

      return {
        success: true,
        allowed: false,
        status: 'TEMPORARILY_BLOCKED',
        currentViolationCount: 3,
        historicalViolationCount: secStatus.historicalViolationCount,
        securityEpoch: secStatus.securityEpoch,
        maxAttempts: 3,
        remainingAttempts: 0,
        action: 'TEMPORARY_BLOCK',
        message: 'Your hospital portal has been temporarily restricted because protected CareSetu medical content was captured or a protected-screen capture event was detected. This activity violates the CareSetu HealthPack terms and conditions.'
      };
    }

    // CHECK 3: If cleanSessionId is provided, verify securityEpoch matches!
    if (cleanSessionId) {
      const viewSession = await tx.secureViewSession.findUnique({
        where: { id: cleanSessionId }
      });

      if (!viewSession || viewSession.status !== 'ACTIVE' || viewSession.securityEpoch !== secStatus.securityEpoch) {
        const err = new Error('Secure viewing session is invalid or belongs to a previous security epoch.');
        err.status = 409;
        err.code = 'SESSION_STALE';
        err.currentViolationCount = secStatus.currentViolationCount;
        err.securityEpoch = secStatus.securityEpoch;
        throw err;
      }
    }

    // CHECK 4: Deduplication & Server-backed Idempotency
    const idempotencyKey = effectiveMetadata?.clientGeneratedEventId || effectiveMetadata?.captureEventId || effectiveMetadata?.idempotencyKey;
    
    let isDuplicate = false;
    if (idempotencyKey) {
      const existingKeyMatch = await tx.captureViolation.findFirst({
        where: {
          hospitalId,
          metadata: {
            path: ['clientGeneratedEventId'],
            equals: idempotencyKey
          }
        }
      });
      if (existingKeyMatch) isDuplicate = true;
    } else {
      // Short 1.5s window for identical event bursts from native OS hooks without an explicit ID
      const oneAndHalfSecAgo = new Date(Date.now() - 1500);
      const burstDuplicate = await tx.captureViolation.findFirst({
        where: {
          hospitalId,
          eventType,
          secureViewerSessionId: cleanSessionId || undefined,
          detectedAt: { gte: oneAndHalfSecAgo }
        }
      });
      if (burstDuplicate) isDuplicate = true;
    }

    if (isDuplicate) {
      const remaining = Math.max(3 - secStatus.currentViolationCount, 0);
      return {
        success: true,
        allowed: secStatus.status !== 'TEMPORARILY_BLOCKED',
        status: secStatus.status,
        currentViolationCount: secStatus.currentViolationCount,
        violationCount: secStatus.currentViolationCount,
        attemptNumber: secStatus.currentViolationCount,
        historicalViolationCount: secStatus.historicalViolationCount,
        securityEpoch: secStatus.securityEpoch,
        maxAttempts: 3,
        remainingAttempts: remaining,
        action: secStatus.currentViolationCount >= 2 ? 'FINAL_WARNING' : 'WARNING',
        message: getRandomWarningMessage(),
        deduplicated: true
      };
    }

    // 3. Atomically Increment Violation Counts
    const rawNewCurrent = secStatus.currentViolationCount + 1;
    const newCurrentCount = Math.min(rawNewCurrent, 3);
    const newHistoricalCount = secStatus.historicalViolationCount + 1;
    const isBlockingAttempt = newCurrentCount >= 3;
    const newStatusType = isBlockingAttempt ? 'TEMPORARILY_BLOCKED' : 'WARNING';

    // Update HospitalSecurityStatus
    const updatedSecStatus = await tx.hospitalSecurityStatus.update({
      where: { hospitalId },
      data: {
        currentViolationCount: newCurrentCount,
        violationCount: newCurrentCount, // Sync for legacy queries
        historicalViolationCount: newHistoricalCount,
        status: newStatusType,
        lastViolationAt: new Date(),
        blockedAt: isBlockingAttempt ? new Date() : secStatus.blockedAt,
        blockReason: isBlockingAttempt ? 'Protected medical content capture violation (3 attempts detected)' : secStatus.blockReason
      }
    });

    // Create CaptureViolation Record
    const violationRecord = await tx.captureViolation.create({
      data: {
        hospitalId,
        hospitalUserId,
        caseId: caseId || null,
        documentId: documentId || null,
        healthPackId: healthPackId || null,
        secureViewerSessionId: cleanSessionId || null,
        securityEpoch: secStatus.securityEpoch,
        eventType,
        platform,
        attemptNumber: newCurrentCount,
        severity: isBlockingAttempt ? 'CRITICAL' : 'HIGH',
        status: 'RECORDED',
        metadata: effectiveMetadata
      }
    });

    // If blocking attempt, update User status to BLOCKED and revoke sessions
    if (isBlockingAttempt) {
      await tx.user.update({
        where: { id: hospitalUserId },
        data: { status: 'BLOCKED' }
      });

      if (hospitalId) {
        await tx.healthPackShare.updateMany({
          where: {
            sharedWithHospitalId: hospitalId,
            status: 'ACTIVE'
          },
          data: {
            status: 'REVOKED',
            revokedAt: new Date()
          }
        });
      }

      await tx.secureViewSession.updateMany({
        where: { hospitalId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() }
      });
    }

    // Audit Log Entry
    await tx.auditLog.create({
      data: {
        userId: hospitalUserId,
        action: isBlockingAttempt ? 'HOSPITAL_TEMPORARILY_BLOCKED' : 'CAPTURE_VIOLATION',
        entity: 'HospitalSecurityStatus',
        entityId: hospitalId,
        endpoint: '/api/security/capture-violation',
        details: {
          eventType,
          platform,
          attemptNumber: newCurrentCount,
          currentViolationCount: newCurrentCount,
          historicalViolationCount: newHistoricalCount,
          securityEpoch: secStatus.securityEpoch,
          action: isBlockingAttempt ? 'TEMPORARY_BLOCK' : (newCurrentCount === 2 ? 'FINAL_WARNING' : 'WARNING')
        }
      }
    });

    return {
      success: true,
      allowed: !isBlockingAttempt,
      status: newStatusType,
      currentViolationCount: newCurrentCount,
      violationCount: newCurrentCount,
      attemptNumber: newCurrentCount,
      historicalViolationCount: newHistoricalCount,
      securityEpoch: secStatus.securityEpoch,
      maxAttempts: 3,
      remainingAttempts: Math.max(3 - newCurrentCount, 0),
      action: isBlockingAttempt ? 'TEMPORARY_BLOCK' : (newCurrentCount === 2 ? 'FINAL_WARNING' : 'WARNING'),
      message: isBlockingAttempt
        ? 'Your hospital portal has been temporarily restricted because protected CareSetu medical content was captured or a protected-screen capture event was detected. This activity violates the CareSetu HealthPack terms and conditions.'
        : (newCurrentCount === 2 ? 'One more protected-content capture violation may temporarily restrict hospital portal access.' : getRandomWarningMessage()),
      violationRecordId: violationRecord.id
    };
  });

  // 4. Asynchronous Failure-Isolated Email & Socket Dispatch
  const recipientEmail = hospital.user?.email || hospital.email;
  const userName = hospital.user?.name || hospital.name;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'admin@caresetu.in';

  setTimeout(async () => {
    try {
      // Emit Socket.IO real-time event to connected Admin dashboards & Hospital viewers
      try {
        const { getIo } = require('../utils/socket');
        const io = getIo();
        if (io) {
          if (!result.allowed) {
            io.emit('HOSPITAL_SECURITY_BLOCKED', {
              hospitalId,
              hospitalName: hospital.name,
              reviewReference: `REF-SEC-${hospitalId.substring(0, 8).toUpperCase()}`,
              violationCount: result.currentViolationCount || 3,
              currentViolationCount: result.currentViolationCount || 3,
              status: 'TEMPORARILY_BLOCKED',
              securityEpoch: result.securityEpoch || 1,
              blockedAt: new Date()
            });
          } else {
            io.emit('HOSPITAL_SECURITY_UPDATED', {
              hospitalId,
              hospitalName: hospital.name,
              currentViolationCount: result.currentViolationCount || 1,
              status: result.status || 'WARNING',
              securityEpoch: result.securityEpoch || 1
            });
          }
        }
      } catch (sErr) {}

      if (!result.allowed) {
        // Attempt 3: Final Hospital Block Email
        const tplBlock = emailTemplates.hospitalSecurityBlocked({
          recipientName: userName,
          blockedAt: new Date(),
          securityEpoch: result.securityEpoch
        });

        await sendIdempotentSecurityEmail({
          idempotencyKey: `HOSPITAL_SECURITY_BLOCKED:${hospitalId}:${result.securityEpoch}`,
          hospitalId,
          hospitalUserId,
          recipientEmail,
          eventType: 'HOSPITAL_SECURITY_BLOCKED',
          subject: tplBlock.subject,
          html: tplBlock.html
        });

        // Separate Admin Notification Email
        await sendIdempotentSecurityEmail({
          idempotencyKey: `ADMIN_HOSPITAL_SECURITY_BLOCKED:${hospitalId}:${result.securityEpoch}`,
          hospitalId,
          hospitalUserId,
          recipientEmail: adminEmail,
          eventType: 'ADMIN_SECURITY_NOTIFICATION',
          subject: `CareSetu — Hospital Security Violation / Portal Restricted (${hospital.name})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dc2626; border-radius: 8px;">
              <h2 style="color: #dc2626;">🚨 Hospital Security Portal Restricted</h2>
              <p>A hospital portal has reached 3 protected-content capture violations and has been temporarily restricted.</p>
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 16px 0;">
                <p style="margin: 0 0 6px 0;"><strong>Hospital Name:</strong> ${hospital.name}</p>
                <p style="margin: 0 0 6px 0;"><strong>Hospital User:</strong> ${userName}</p>
                <p style="margin: 0 0 6px 0;"><strong>Registered Email:</strong> ${recipientEmail}</p>
                <p style="margin: 0 0 6px 0;"><strong>Hospital ID:</strong> ${hospitalId}</p>
                <p style="margin: 0 0 6px 0;"><strong>Security Status:</strong> TEMPORARILY BLOCKED</p>
                <p style="margin: 0 0 6px 0;"><strong>Violations:</strong> 3 / 3</p>
                <p style="margin: 0 0 6px 0;"><strong>Security Epoch:</strong> ${result.securityEpoch}</p>
                <p style="margin: 0;"><strong>Review Status:</strong> Review Request Not Submitted</p>
              </div>
              <p style="font-size: 13px; color: #475569;">
                Inspect the full security timeline in the Admin Console at <code>/admin/security-violations</code>.
              </p>
            </div>
          `
        });
      } else if (result.currentViolationCount === 1) {
        // Attempt 1: Security Warning 1 of 3
        const tplWarn1 = emailTemplates.hospitalSecurityWarning1({
          recipientName: userName,
          detectedAt: new Date(),
          securityEpoch: result.securityEpoch
        });

        await sendIdempotentSecurityEmail({
          idempotencyKey: `HOSPITAL_SECURITY_WARNING_1:${hospitalId}:${result.securityEpoch}`,
          hospitalId,
          hospitalUserId,
          recipientEmail,
          eventType: 'HOSPITAL_SECURITY_WARNING_1',
          subject: tplWarn1.subject,
          html: tplWarn1.html
        });
      } else if (result.currentViolationCount === 2) {
        // Attempt 2: Final Security Warning 2 of 3
        const tplWarn2 = emailTemplates.hospitalSecurityWarning2({
          recipientName: userName,
          detectedAt: new Date(),
          securityEpoch: result.securityEpoch
        });

        await sendIdempotentSecurityEmail({
          idempotencyKey: `HOSPITAL_SECURITY_WARNING_2:${hospitalId}:${result.securityEpoch}`,
          hospitalId,
          hospitalUserId,
          recipientEmail,
          eventType: 'HOSPITAL_SECURITY_WARNING_2',
          subject: tplWarn2.subject,
          html: tplWarn2.html
        });
      }
    } catch (mailErr) {
      console.error('[HospitalSecurityService] Email dispatch error ignored:', mailErr.message);
    }
  }, 0);

  return result;
}

/**
 * Get Hospital Security Status & Appeals.
 */
async function getHospitalSecurityStatus({ userId, hospitalId }) {
  let targetHospitalId = hospitalId;

  if (!targetHospitalId && userId) {
    const hosp = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true }
    });
    if (hosp) targetHospitalId = hosp.id;
  }

  if (!targetHospitalId) {
    return {
      status: 'ACTIVE',
      currentViolationCount: 0,
      historicalViolationCount: 0,
      securityEpoch: 1,
      maxAttempts: 3,
      remainingAttempts: 3,
      blockedAt: null,
      appeals: []
    };
  }

  const secStatus = await prisma.hospitalSecurityStatus.findUnique({
    where: { hospitalId: targetHospitalId }
  });

  const appeals = await prisma.hospitalSecurityAppeal.findMany({
    where: { hospitalId: targetHospitalId },
    orderBy: { createdAt: 'desc' }
  });

  const currentCount = secStatus ? secStatus.currentViolationCount : 0;
  const status = secStatus ? secStatus.status : 'ACTIVE';

  return {
    hospitalId: targetHospitalId,
    status,
    currentViolationCount: Math.min(currentCount, 3),
    violationCount: Math.min(currentCount, 3),
    historicalViolationCount: secStatus ? secStatus.historicalViolationCount : 0,
    securityEpoch: secStatus ? secStatus.securityEpoch : 1,
    maxAttempts: 3,
    remainingAttempts: Math.max(3 - currentCount, 0),
    blockedAt: secStatus ? secStatus.blockedAt : null,
    blockReason: secStatus ? secStatus.blockReason : null,
    appeals: appeals || []
  };
}

/**
 * Submit an Appeal for a Blocked Hospital.
 * Resource-level authorization: Hospital user can submit an appeal for their own hospital even when status = TEMPORARILY_BLOCKED.
 */
async function submitSecurityAppeal({ hospitalUserId, reason, description, caseId = null }) {
  if (!reason || !reason.trim() || !description || !description.trim()) {
    const err = new Error('Appeal reason and detailed description are required');
    err.status = 400;
    throw err;
  }

  const hospital = await prisma.hospital.findUnique({
    where: { userId: hospitalUserId },
    include: { user: { select: { id: true, email: true } } }
  });

  if (!hospital) {
    const err = new Error('Hospital profile not found');
    err.status = 404;
    throw err;
  }

  const secStatus = await prisma.hospitalSecurityStatus.findUnique({
    where: { hospitalId: hospital.id }
  });

  // Check if there is already a PENDING appeal
  const existingPending = await prisma.hospitalSecurityAppeal.findFirst({
    where: {
      hospitalId: hospital.id,
      status: 'PENDING'
    }
  });

  if (existingPending) {
    return existingPending;
  }

  const tempRef = `REF-APP-${Date.now().toString(36).toUpperCase()}`;

  const appeal = await prisma.hospitalSecurityAppeal.create({
    data: {
      hospitalId: hospital.id,
      submittedBy: hospitalUserId,
      reason: reason.trim(),
      description: description.trim(),
      reviewReference: tempRef,
      status: 'PENDING'
    }
  });

  const reviewRef = `REF-APP-${appeal.id.substring(0, 8).toUpperCase()}`;
  await prisma.hospitalSecurityAppeal.update({
    where: { id: appeal.id },
    data: { reviewReference: reviewRef }
  });
  appeal.reviewReference = reviewRef;

  // Update status to UNDER_REVIEW
  await prisma.hospitalSecurityStatus.upsert({
    where: { hospitalId: hospital.id },
    create: {
      hospitalId: hospital.id,
      status: 'UNDER_REVIEW',
      currentViolationCount: secStatus ? secStatus.currentViolationCount : 3
    },
    update: {
      status: 'UNDER_REVIEW'
    }
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: hospitalUserId,
      action: 'HOSPITAL_APPEAL_SUBMITTED',
      entity: 'HospitalSecurityAppeal',
      entityId: appeal.id,
      details: { reason: reason.trim(), description: description.trim(), reviewReference: reviewRef, appealId: appeal.id }
    }
  });

  // Asynchronous Email Dispatch to CareSetu Administration
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'admin@caresetu.in';
  setTimeout(async () => {
    try {
      const userName = hospital.name || 'Hospital User';
      const userEmail = hospital.email || hospital.user?.email || 'N/A';

      const tplReview = emailTemplates.hospitalSecurityReviewSubmitted({
        hospitalName: hospital.name,
        userName,
        userEmail,
        reviewReference: reviewRef,
        description: description.trim(),
        submittedAt: appeal.createdAt || new Date()
      });

      await sendIdempotentSecurityEmail({
        idempotencyKey: `ADMIN_APPEAL_NOTIFICATION:${appeal.id}`,
        hospitalId: hospital.id,
        hospitalUserId,
        recipientEmail: adminEmail,
        eventType: 'ADMIN_SECURITY_REVIEW_REQUEST',
        subject: tplReview.subject,
        html: tplReview.html
      });
    } catch (err) {
      console.error('[HospitalSecurityService] Admin appeal notification email error ignored:', err.message);
    }
  }, 0);

  // Asynchronous Socket.IO event emit
  try {
    const { getIo } = require('../utils/socket');
    const io = getIo();
    if (io) {
      io.emit('SECURITY_REVIEW_SUBMITTED', {
        reviewId: appeal.id,
        hospitalId: hospital.id,
        reviewReference: reviewRef,
        hospitalName: hospital.name,
        status: 'PENDING'
      });
    }
  } catch (socketErr) {}

  return appeal;
}

/**
 * Admin: Get all violations, security statuses, appeals, and logs analysis.
 * Returns pagination, real analytics, and pre-aggregated lists.
 */
async function getAdminViolationsAndAppeals(params = {}) {
  const {
    status = null,
    search = null,
    hospitalId = null,
    userId = null,
    eventType = null,
    attemptNumber = null,
    result = null,
    platform = null,
    dateFrom = null,
    dateTo = null,
    securityEpoch = null,
    caseId = null,
    reviewStatus = null,
    emailStatus = null,
    sortBy = 'newest',
    page = 1,
    pageSize = 25
  } = params;

  // Validate pagination
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const rawPageSize = parseInt(pageSize, 10) || 25;
  const parsedPageSize = Math.min(100, Math.max(1, rawPageSize));

  // Build Prisma where clause for CaptureViolation
  const violationWhere = {};

  if (hospitalId) violationWhere.hospitalId = hospitalId;
  if (userId) violationWhere.hospitalUserId = userId;
  if (caseId) violationWhere.caseId = caseId;
  if (platform) violationWhere.platform = { contains: platform, mode: 'insensitive' };
  if (attemptNumber !== null && attemptNumber !== undefined && attemptNumber !== '' && attemptNumber !== 'ALL') {
    const att = parseInt(attemptNumber, 10);
    if (!isNaN(att)) violationWhere.attemptNumber = att;
  }
  if (securityEpoch !== null && securityEpoch !== undefined && securityEpoch !== '' && securityEpoch !== 'ALL') {
    const epoch = parseInt(securityEpoch, 10);
    if (!isNaN(epoch)) violationWhere.securityEpoch = epoch;
  }

  // Handle eventType (Enum CaptureViolationType)
  if (eventType && eventType !== 'ALL') {
    const upperEvent = String(eventType).toUpperCase();
    const validEventTypes = [
      'SCREENSHOT_ATTEMPT',
      'SCREEN_CAPTURE_DETECTED',
      'SCREEN_RECORDING_DETECTED',
      'SCREEN_MIRRORING_DETECTED',
      'PROTECTED_CONTENT_CAPTURE'
    ];
    if (validEventTypes.includes(upperEvent)) {
      violationWhere.eventType = upperEvent;
    }
  }

  // Handle Date range
  if (dateFrom || dateTo) {
    violationWhere.detectedAt = {};
    if (dateFrom) violationWhere.detectedAt.gte = new Date(dateFrom);
    if (dateTo) violationWhere.detectedAt.lte = new Date(dateTo);
  }

  // Handle Search filter across hospital name, hospital ID, user ID, user email, case ID, capture event ID
  if (search && search.trim() !== '') {
    const q = search.trim();
    violationWhere.OR = [
      { id: { contains: q, mode: 'insensitive' } },
      { hospitalId: { contains: q, mode: 'insensitive' } },
      { hospitalUserId: { contains: q, mode: 'insensitive' } },
      { caseId: { contains: q, mode: 'insensitive' } },
      { hospital: { name: { contains: q, mode: 'insensitive' } } },
      { hospital: { email: { contains: q, mode: 'insensitive' } } },
      { hospital: { user: { email: { contains: q, mode: 'insensitive' } } } },
      { hospital: { user: { name: { contains: q, mode: 'insensitive' } } } }
    ];
  }

  // Determine sorting
  let orderBy = { detectedAt: 'desc' };
  if (sortBy === 'oldest' || sortBy === 'OLDEST') {
    orderBy = { detectedAt: 'asc' };
  } else if (sortBy === 'attempt' || sortBy === 'ATTEMPT') {
    orderBy = { attemptNumber: 'desc' };
  }

  // Execute database queries safely
  const [
    totalViolations,
    rawViolations,
    allRawViolations,
    securityStatuses,
    appeals,
    auditLogs,
    blockedUsers
  ] = await Promise.all([
    prisma.captureViolation.count({ where: violationWhere }),
    prisma.captureViolation.findMany({
      where: violationWhere,
      skip: (parsedPage - 1) * parsedPageSize,
      take: parsedPageSize,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            user: { select: { id: true, name: true, email: true, status: true } }
          }
        }
      },
      orderBy
    }),
    prisma.captureViolation.findMany({
      take: 500,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            user: { select: { id: true, name: true, email: true, status: true } }
          }
        }
      },
      orderBy: { detectedAt: 'desc' }
    }),
    prisma.hospitalSecurityStatus.findMany({
      where: status && status !== 'ALL' ? { status } : {},
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            userId: true,
            user: { select: { email: true, status: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.hospitalSecurityAppeal.findMany({
      include: {
        hospital: { select: { id: true, name: true, phone: true, email: true } }
      },
      orderBy: { submittedAt: 'desc' }
    }),
    // Filter strictly by valid AuditAction enum values to prevent Prisma validation errors
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'CAPTURE_VIOLATION',
            'CAPTURE_WARNING_ISSUED',
            'HOSPITAL_TEMPORARILY_BLOCKED',
            'HOSPITAL_APPEAL_SUBMITTED',
            'HOSPITAL_BLOCK_REVIEWED',
            'HOSPITAL_UNLOCKED',
            'HOSPITAL_SESSION_REVOKED',
            'SECURITY_EVENT',
            'ADMIN_ACTION'
          ]
        }
      },
      take: 500,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.findMany({
      where: { role: 'HOSPITAL', status: 'BLOCKED' },
      select: {
        id: true,
        email: true,
        hospital: { select: { id: true, name: true, email: true, phone: true } }
      }
    })
  ]);

  // Map violations to safe structure with fallbacks for null relations
  const mapViolation = (v) => {
    const hosp = v.hospital;
    const hospUser = hosp?.user;
    return {
      id: v.id,
      captureEventId: v.id,
      hospitalId: v.hospitalId,
      hospitalUserId: v.hospitalUserId,
      patientId: v.patientId || null,
      caseId: v.caseId || null,
      documentId: v.documentId || null,
      healthPackId: v.healthPackId || null,
      secureViewerSessionId: v.secureViewerSessionId || null,
      securityEpoch: v.securityEpoch || 1,
      eventType: v.eventType,
      platform: v.platform || 'WEB',
      attemptNumber: v.attemptNumber,
      severity: v.severity || 'HIGH',
      status: v.status || 'RECORDED',
      detectedAt: v.detectedAt,
      createdAt: v.createdAt,
      metadata: v.metadata || {},
      hospitalName: hosp?.name || 'Hospital Portal',
      hospitalEmail: hosp?.email || hospUser?.email || 'N/A',
      userName: hospUser?.name || hosp?.name || 'Hospital User',
      userEmail: hospUser?.email || hosp?.email || 'N/A',
      hospital: hosp
        ? {
            id: hosp.id,
            name: hosp.name,
            email: hosp.email,
            phone: hosp.phone,
            user: hospUser
              ? {
                  id: hospUser.id,
                  name: hospUser.name,
                  email: hospUser.email,
                  status: hospUser.status
                }
              : null
          }
        : null
    };
  };

  const formattedData = rawViolations.map(mapViolation);
  const formattedAllViolations = allRawViolations.map(mapViolation);

  // Consolidate blocked hospitals map
  const hospitalMap = new Map();
  securityStatuses.forEach((sec) => {
    if (sec.status === 'TEMPORARILY_BLOCKED' || sec.status === 'UNDER_REVIEW' || sec.currentViolationCount >= 3) {
      const hId = sec.hospitalId;
      const matchingAppeal =
        appeals.find((a) => a.hospitalId === hId && (a.status === 'PENDING' || a.status === 'UNDER_REVIEW')) ||
        appeals.find((a) => a.hospitalId === hId);

      let reviewState = 'REVIEW_REQUIRED';
      if (matchingAppeal && matchingAppeal.status === 'PENDING') {
        reviewState = 'REVIEW_SUBMITTED';
      } else if (matchingAppeal && matchingAppeal.status === 'UNDER_REVIEW') {
        reviewState = 'UNDER_REVIEW';
      }

      const hospViolations = formattedAllViolations.filter((v) => v.hospitalId === hId);

      hospitalMap.set(hId, {
        id: sec.id || `sec-${hId}`,
        hospitalId: hId,
        hospitalName: sec.hospital?.name || 'Hospital Portal',
        hospitalEmail: sec.hospital?.email || sec.hospital?.user?.email || 'N/A',
        status: sec.status,
        currentViolationCount: sec.currentViolationCount || 3,
        historicalViolationCount: sec.historicalViolationCount || 3,
        blockReason: sec.blockReason || 'Protected medical-content capture violation',
        blockedAt: sec.blockedAt || sec.updatedAt,
        appeal: matchingAppeal || null,
        reviewState,
        violationHistory: hospViolations,
        hospital: sec.hospital
      });
    }
  });

  blockedUsers.forEach((u) => {
    if (u.hospital && !hospitalMap.has(u.hospital.id)) {
      const hId = u.hospital.id;
      const matchingAppeal = appeals.find((a) => a.hospitalId === hId);
      hospitalMap.set(hId, {
        id: `user-sec-${hId}`,
        hospitalId: hId,
        hospitalName: u.hospital.name,
        hospitalEmail: u.hospital.email || u.email,
        status: 'TEMPORARILY_BLOCKED',
        currentViolationCount: 3,
        historicalViolationCount: 3,
        blockReason: 'Protected medical-content capture violation',
        blockedAt: new Date(),
        appeal: matchingAppeal || null,
        reviewState: matchingAppeal ? 'REVIEW_SUBMITTED' : 'REVIEW_REQUIRED',
        violationHistory: formattedAllViolations.filter((v) => v.hospitalId === hId),
        hospital: u.hospital
      });
    }
  });

  const blockedHospitals = Array.from(hospitalMap.values());
  const pendingAppeals = appeals.filter((a) => a.status === 'PENDING');
  const pendingCount = blockedHospitals.filter(
    (h) => h.status === 'TEMPORARILY_BLOCKED' || h.status === 'UNDER_REVIEW'
  ).length;

  // Real Analytics Aggregations
  const [analyticsTotal, confirmedCount, warningsCount, blockedCount, uniqueHospAgg, uniqueUserAgg] =
    await Promise.all([
      prisma.captureViolation.count(),
      prisma.captureViolation.count({ where: { status: 'RECORDED' } }),
      prisma.captureViolation.count({ where: { attemptNumber: { in: [1, 2] } } }),
      prisma.captureViolation.count({ where: { attemptNumber: { gte: 3 } } }),
      prisma.captureViolation.groupBy({ by: ['hospitalId'] }),
      prisma.captureViolation.groupBy({ by: ['hospitalUserId'] })
    ]);

  const analytics = {
    totalEvents: analyticsTotal || 0,
    confirmedEvents: confirmedCount || 0,
    warnings: warningsCount || 0,
    blockedEvents: blockedCount || 0,
    failedEvents: 0,
    uniqueHospitals: uniqueHospAgg ? uniqueHospAgg.length : 0,
    uniqueUsers: uniqueUserAgg ? uniqueUserAgg.length : 0
  };

  const totalPages = Math.ceil(totalViolations / parsedPageSize) || 1;

  return {
    success: true,
    data: formattedData,
    pagination: {
      page: parsedPage,
      pageSize: parsedPageSize,
      total: totalViolations,
      totalPages: totalPages
    },
    analytics,
    securityStatuses,
    appeals,
    violations: formattedAllViolations,
    auditLogs,
    recentViolations: formattedAllViolations,
    blockedHospitals,
    pendingAppeals,
    pendingCount
  };
}

/**
 * Admin: Unlock a hospital and restore portal access.
 * Atomically increments securityEpoch, resets currentViolationCount to 0, preserves historicalViolationCount.
 */
async function unlockHospital({ adminUserId, hospitalId, decision = 'APPROVED', adminNotes = '' }) {
  if (!hospitalId) {
    const err = new Error('Hospital ID is required');
    err.status = 400;
    throw err;
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { user: { select: { id: true, email: true } } }
  });

  if (!hospital) {
    const err = new Error('Hospital not found');
    err.status = 404;
    throw err;
  }

  const updatedSecStatus = await prisma.$transaction(async (tx) => {
    const currentSec = await tx.hospitalSecurityStatus.findUnique({
      where: { hospitalId }
    });

    const oldEpoch = currentSec ? currentSec.securityEpoch : 1;
    const newEpoch = oldEpoch + 1;
    const histCount = currentSec ? currentSec.historicalViolationCount : 3;

    // 1. Update HospitalSecurityStatus with NEW securityEpoch and currentViolationCount = 0
    const secStatus = await tx.hospitalSecurityStatus.upsert({
      where: { hospitalId },
      create: {
        hospitalId,
        status: 'ACTIVE',
        violationCount: 0,
        currentViolationCount: 0,
        historicalViolationCount: histCount,
        securityEpoch: newEpoch,
        unblockedAt: new Date(),
        unblockedBy: adminUserId
      },
      update: {
        status: 'ACTIVE',
        violationCount: 0,
        currentViolationCount: 0,
        securityEpoch: newEpoch,
        unblockedAt: new Date(),
        unblockedBy: adminUserId
      }
    });

    // 2. Update User status to ACTIVE
    await tx.user.update({
      where: { id: hospital.userId },
      data: { status: 'ACTIVE' }
    });

    // 3. Revoke all old secure view sessions associated with previous epoch
    await tx.secureViewSession.updateMany({
      where: { hospitalId },
      data: { status: 'REVOKED', revokedAt: new Date() }
    });

    // 4. Update pending appeals
    await tx.hospitalSecurityAppeal.updateMany({
      where: { hospitalId, status: 'PENDING' },
      data: {
        status: decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        decision,
        adminNotes: adminNotes ? adminNotes.trim() : 'Reviewed & unlocked by Administrator'
      }
    });

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'HOSPITAL_UNLOCKED',
        entity: 'HospitalSecurityStatus',
        entityId: hospitalId,
        details: {
          decision,
          adminNotes,
          unlockedHospitalId: hospitalId,
          previousEpoch: oldEpoch,
          newEpoch
        }
      }
    });

    return secStatus;
  });

  // Send Unlock Email to Authenticated Hospital User's Registered Email Address
  const recipientEmail = hospital.user?.email || hospital.email;
  const userName = hospital.name || 'Hospital User';
  const hospitalUserId = hospital.userId;

  if (recipientEmail) {
    setTimeout(async () => {
      try {
        const tplUnlock = emailTemplates.hospitalSecurityUnlocked({
          recipientName: userName,
          restoredAt: new Date(),
          securityEpoch: updatedSecStatus.securityEpoch
        });

        await sendIdempotentSecurityEmail({
          idempotencyKey: `HOSPITAL_SECURITY_UNLOCKED:${hospitalId}:${updatedSecStatus.securityEpoch}`,
          hospitalId,
          hospitalUserId,
          recipientEmail,
          eventType: 'HOSPITAL_SECURITY_UNLOCKED',
          subject: tplUnlock.subject,
          html: tplUnlock.html
        });
      } catch (err) {
        console.error('[HospitalSecurityService] Unlock email error ignored:', err.message);
      }
    }, 0);
  }

  // Socket.IO real-time unblock broadcast
  try {
    const { getIo } = require('../utils/socket');
    const io = getIo();
    if (io) {
      io.emit('HOSPITAL_SECURITY_UNLOCKED', {
        hospitalId,
        securityEpoch: updatedSecStatus.securityEpoch,
        currentViolationCount: 0,
        status: 'ACTIVE'
      });
      io.emit('HOSPITAL_SECURITY_UPDATED', {
        hospitalId,
        securityEpoch: updatedSecStatus.securityEpoch,
        currentViolationCount: 0,
        status: 'ACTIVE'
      });
    }
  } catch (socketErr) {}

  return {
    success: true,
    hospitalId,
    status: 'ACTIVE',
    securityEpoch: updatedSecStatus.securityEpoch,
    currentViolationCount: 0,
    historicalViolationCount: updatedSecStatus.historicalViolationCount
  };
}

/**
 * Admin: Reject appeal and keep hospital blocked.
 */
async function keepBlockedHospital({ adminUserId, hospitalId, appealId = null, adminNotes = '' }) {
  if (!hospitalId) {
    const err = new Error('Hospital ID is required');
    err.status = 400;
    throw err;
  }

  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { user: { select: { id: true, email: true } } }
  });

  if (!hospital) {
    const err = new Error('Hospital not found');
    err.status = 404;
    throw err;
  }

  const updatedSecStatus = await prisma.$transaction(async (tx) => {
    const secStatus = await tx.hospitalSecurityStatus.upsert({
      where: { hospitalId },
      create: {
        hospitalId,
        status: 'TEMPORARILY_BLOCKED',
        violationCount: 3,
        currentViolationCount: 3,
        blockReason: 'Security review completed: Hospital restriction maintained by Administrator.'
      },
      update: {
        status: 'TEMPORARILY_BLOCKED',
        blockReason: 'Security review completed: Hospital restriction maintained by Administrator.'
      }
    });

    const appealWhere = appealId ? { id: appealId } : { hospitalId, status: 'PENDING' };
    await tx.hospitalSecurityAppeal.updateMany({
      where: appealWhere,
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        decision: 'REJECTED',
        adminNotes: adminNotes ? adminNotes.trim() : 'Appeal reviewed and rejected by Administrator.'
      }
    });

    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'HOSPITAL_BLOCK_REVIEWED',
        entity: 'HospitalSecurityStatus',
        entityId: hospitalId,
        details: {
          decision: 'REJECTED',
          adminNotes,
          hospitalId
        }
      }
    });

    return secStatus;
  });

  const recipientEmail = hospital.email || hospital.user.email;
  if (recipientEmail) {
    setTimeout(async () => {
      try {
        await brevoProvider.sendEmail({
          to: recipientEmail,
          subject: 'CareSetu Hospital Portal — Security Review Decision',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; border-radius: 8px;">
              <h2 style="color: #dc2626;">🔒 CareSetu Security Review Decision — Restriction Maintained</h2>
              <p>Hello <strong>${hospital.name}</strong>,</p>
              <p>Your security appeal request has been <strong>reviewed</strong> by CareSetu Administration.</p>
              <p><strong>Decision Summary:</strong></p>
              <ul>
                <li>Status: TEMPORARILY_BLOCKED (Restriction Maintained)</li>
                <li>Reviewed Date: ${new Date().toLocaleString()}</li>
                <li>Administrator Notes: ${adminNotes || 'Appeal decision: Portal restriction remains active.'}</li>
              </ul>
              <p>For additional compliance information, please contact CareSetu Support.</p>
            </div>
          `
        });
      } catch (err) {
        console.error('[HospitalSecurityService] Decision email error ignored:', err.message);
      }
    }, 0);
  }

  return {
    success: true,
    hospitalId,
    status: 'TEMPORARILY_BLOCKED',
    currentViolationCount: 3,
    message: 'Hospital restriction maintained.'
  };
}

module.exports = {
  createSecureViewSession,
  recordCaptureViolation,
  getHospitalSecurityStatus,
  submitSecurityAppeal,
  getAdminViolationsAndAppeals,
  unlockHospital,
  keepBlockedHospital
};
