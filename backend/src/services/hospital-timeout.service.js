/**
 * Hospital response timeout & sequential emergency reassignment service — §24.
 *
 * PENDING hospital requests that have not received a response within the
 * configured window are marked EXPIRED and the case is automatically advanced
 * to the next suitable candidate hospital.
 *
 * Backend-controlled; state persisted in PostgreSQL database.
 */
const prisma = require('../config/prisma');
const { emitToUser, emitToHospital } = require('../utils/emergency.events');
const notificationService = require('./notification.service');
const emergencyRepository = require('../repositories/emergency.repository');
const textbeeProvider = require('./providers/textbee.provider');
const brevoProvider = require('./providers/brevo.provider');
const fcmProvider = require('./providers/fcm.provider');

const TIMEOUT_SECONDS = Number(process.env.HOSPITAL_RESPONSE_TIMEOUT_SECONDS || 20);
const SWEEP_INTERVAL_MS = Number(process.env.HOSPITAL_TIMEOUT_SWEEP_MS || 3000);

let timer = null;

/**
 * Advance an emergency case to the next queued candidate hospital
 */
async function advanceCaseToNextHospital(caseRow) {
  // Concurrency check: Ensure case is still PENDING and unassigned
  const currentCase = await prisma.emergencyCase.findUnique({
    where: { id: caseRow.id },
  });

  if (!currentCase || currentCase.status !== 'PENDING' || currentCase.hospitalId) {
    console.log(`[HospitalTimeout] Case ${caseRow.caseId} already accepted/assigned. Skipping advance.`);
    return;
  }

  // Find the next queued/pending request that has not yet been requested (requestedAt: null)
  // or next available pending request
  let nextRequest = await prisma.hospitalRequest.findFirst({
    where: {
      emergencyCaseId: caseRow.id,
      status: 'PENDING',
      requestedAt: null,
    },
    orderBy: { matchScore: 'desc' },
    include: { hospital: true },
  });

  // Fallback: If all pending requests have non-null requestedAt, pick the first non-expired PENDING
  if (!nextRequest) {
    nextRequest = await prisma.hospitalRequest.findFirst({
      where: {
        emergencyCaseId: caseRow.id,
        status: 'PENDING',
      },
      orderBy: { matchScore: 'desc' },
      include: { hospital: true },
    });
  }

  if (nextRequest && nextRequest.hospital) {
    const now = new Date();

    // Activate this request with fresh requestedAt timestamp
    await prisma.hospitalRequest.update({
      where: { id: nextRequest.id },
      data: {
        status: 'PENDING',
        requestedAt: now,
      },
    });

    const isRedFlag = caseRow.severity === 'RED' || caseRow.severity === 'ORANGE';
    const hospital = nextRequest.hospital;
    const distanceStr = nextRequest.distanceKm != null ? nextRequest.distanceKm.toFixed(1) : 'N/A';

    // In-app notification
    await notificationService.notifyHospital(
      hospital.userId,
      `Emergency SOS routed to you (Case: ${caseRow.caseId}). Type: ${caseRow.emergencyType}, Severity: ${caseRow.severity}`,
      { emergencyCaseId: caseRow.id, caseId: caseRow.caseId, isRedFlag },
      hospital.phone
    ).catch(err => console.warn('[HospitalTimeout] Notify hospital error:', err.message));

    const patientInfo = await prisma.patient.findUnique({
      where: { id: caseRow.patientId },
      select: { name: true, age: true, gender: true, bloodGroup: true, medicalConditions: true, phone: true },
    });

    const nextPayload = {
      caseId: caseRow.caseId,
      publicCaseId: caseRow.caseId,
      emergencyType: caseRow.emergencyType,
      severity: caseRow.severity,
      isRedFlag,
      symptoms: caseRow.symptoms,
      distanceKm: nextRequest.distanceKm,
      hospitalRequestId: nextRequest.id,
      source: caseRow.source || 'PATIENT_APP',
      patientInfo: patientInfo || undefined,
      patientLocation: caseRow.location,
      createdAt: caseRow.createdAt,
      requestedAt: now.toISOString(),
      timeoutSeconds: TIMEOUT_SECONDS,
    };

    if (hospital.userId) {
      emitToHospital(hospital.userId, 'emergency:new-case', nextPayload);
      emitToHospital(hospital.userId, 'emergency:request-created', nextPayload);
    }

    // RED FLAG CASES ONLY: Send SMS and High-Priority Push Alerts
    if (isRedFlag) {
      if (hospital.phone) {
        textbeeProvider.sendSMS(
          hospital.phone,
          `🚨 CARESETU EMERGENCY REASSIGNMENT\n\nCase: ${caseRow.caseId}\nSeverity: ${caseRow.severity}\nDistance: ${distanceStr} km\nSymptoms: ${caseRow.symptoms || 'Not provided'}\n\nOpen dashboard to ACCEPT.`
        ).catch(err => console.error('[HospitalTimeout] SMS failed:', err.message));
      }

      if (hospital.userId) {
        prisma.fcmToken.findMany({ where: { userId: hospital.userId, isActive: true } })
          .then(tokens => {
            tokens.forEach(t => {
              fcmProvider.sendPush({
                token: t.token,
                title: `🚨 Emergency Reassigned: ${caseRow.caseId}`,
                body: `${caseRow.severity} - ${caseRow.symptoms || 'Emergency'}`,
                data: { caseId: caseRow.caseId, isRedFlag: 'true' },
              }).catch(() => {});
            });
          }).catch(() => {});
      }
    }

    // Notify patient of reassignment
    emitToUser(caseRow.patient.userId, 'case:next-hospital', {
      caseId: caseRow.caseId,
      searching: true,
      hospital: {
        id: hospital.id,
        name: hospital.name,
        address: hospital.address,
        distanceKm: nextRequest.distanceKm,
        capabilities: hospital.capabilities || [],
      },
    });

    emitToUser(caseRow.patient.userId, 'hospital:found', {
      caseId: caseRow.caseId,
      hospital: {
        id: hospital.id,
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        distanceKm: nextRequest.distanceKm,
        capabilities: hospital.capabilities || [],
      },
    });

    console.log(`[HospitalTimeout] Case ${caseRow.caseId} reassigned to next hospital ${hospital.name} (id: ${hospital.id})`);
  } else {
    // No more candidate hospitals remain
    console.log(`[HospitalTimeout] No remaining candidate hospitals for case ${caseRow.caseId}`);
    emitToUser(caseRow.patient.userId, 'emergency:no-hospital', {
      caseId: caseRow.caseId,
      message: 'No suitable hospital responded within the timeout window.',
    });
  }
}

/**
 * Sweep for expired PENDING requests and advance emergency cases
 */
async function sweepExpiredRequests() {
  try {
    const cutoff = new Date(Date.now() - TIMEOUT_SECONDS * 1000);

    // Find active requests where status is PENDING, requestedAt is set, and requestedAt < cutoff
    const expiredRequests = await prisma.hospitalRequest.findMany({
      where: {
        status: 'PENDING',
        requestedAt: { not: null, lt: cutoff },
      },
      include: {
        emergencyCase: {
          include: { patient: { select: { userId: true, phone: true } } },
        },
        hospital: { select: { id: true, name: true, userId: true } },
      },
    });

    if (expiredRequests.length === 0) return;

    for (const req of expiredRequests) {
      const caseRow = req.emergencyCase;

      // Skip if case is already accepted, assigned, or closed
      if (!caseRow || caseRow.status !== 'PENDING' || caseRow.hospitalId) {
        continue;
      }

      // Atomically expire this request
      const updatedCount = await prisma.hospitalRequest.updateMany({
        where: { id: req.id, status: 'PENDING' },
        data: {
          status: 'EXPIRED',
          respondedAt: new Date(),
          rejectionReason: `No response within ${TIMEOUT_SECONDS}s`,
        },
      });

      if (updatedCount.count === 0) continue; // Already handled by another process

      // Audit log entry
      await emergencyRepository.createAuditLog({
        userId: caseRow.patient.userId,
        action: 'EMERGENCY_UPDATED',
        entity: 'EmergencyCase',
        entityId: caseRow.id,
        endpoint: 'system:hospital-timeout',
        details: {
          event: 'HOSPITAL_TIMEOUT',
          hospitalId: req.hospitalId,
          hospitalName: req.hospital?.name || null,
          requestId: req.id,
          timeoutSeconds: TIMEOUT_SECONDS,
        },
      }).catch(() => {});

      const timeoutPayload = {
        caseId: caseRow.caseId,
        publicCaseId: caseRow.caseId,
        hospital: { id: req.hospitalId, name: req.hospital?.name || 'Hospital' },
        reason: `No response within ${TIMEOUT_SECONDS}s`,
      };

      emitToUser(caseRow.patient.userId, 'hospital:timeout', timeoutPayload);

      if (req.hospital?.userId) {
        emitToHospital(req.hospital.userId, 'emergency:timeout', timeoutPayload);
        emitToHospital(req.hospital.userId, 'case:closed-elsewhere', {
          ...timeoutPayload,
          status: 'EXPIRED',
        });
      }

      // Advance case to next candidate
      await advanceCaseToNextHospital(caseRow);
    }
  } catch (e) {
    const isTransient =
      e?.code === 'ECONNREFUSED' ||
      e?.code === 'P1001' ||
      e?.code === 'P2039' ||
      (typeof e?.message === 'string' &&
        (e.message.includes('57P03') ||
          e.message.includes('starting up') ||
          e.message.includes('ECONNREFUSED') ||
          e.message.includes('P1001')));

    if (isTransient) {
      console.warn('[HospitalTimeout] Database temporarily unavailable. Retrying next cycle.');
    } else {
      console.error('[HospitalTimeout] Sweep error:', e.message);
    }
  }
}

function startHospitalTimeoutSweeper() {
  if (timer) return;
  timer = setInterval(() => {
    void sweepExpiredRequests();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.log(`[HospitalTimeout] Sweeper started (timeout=${TIMEOUT_SECONDS}s, sweepInterval=${SWEEP_INTERVAL_MS}ms)`);
}

function stopHospitalTimeoutSweeper() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function cleanupStaleRequests() {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const result = await prisma.hospitalRequest.updateMany({
      where: {
        status: 'PENDING',
        requestedAt: { not: null, lt: cutoff },
      },
      data: {
        status: 'EXPIRED',
        respondedAt: new Date(),
        rejectionReason: 'Auto-expired on server restart',
      },
    });
    if (result.count > 0) {
      console.log(`[Cleanup] Expired ${result.count} stale requests on startup`);
    }
  } catch (err) {
    console.error('[Cleanup] Failed:', err.message);
  }
}

module.exports = {
  startHospitalTimeoutSweeper,
  stopHospitalTimeoutSweeper,
  sweepExpiredRequests,
  cleanupStaleRequests,
  advanceCaseToNextHospital,
  TIMEOUT_SECONDS,
};