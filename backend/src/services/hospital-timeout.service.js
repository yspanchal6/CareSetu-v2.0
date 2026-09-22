/**
 * Hospital response timeout — §24.
 *
 * PENDING hospital requests that have not received a response within the
 * configured window are marked EXPIRED and the case is automatically advanced
 * to the next suitable hospital. Backend-controlled; never a frontend timer.
 *
 * Config:
 *   HOSPITAL_RESPONSE_TIMEOUT_SECONDS (default 20)
 *   HOSPITAL_TIMEOUT_SWEEP_MS          (default 5000)
 */
const prisma = require('../config/prisma');
const { emitToUser, emitToHospital } = require('../utils/emergency.events');
const notificationService = require('./notification.service');
const emergencyRepository = require('../repositories/emergency.repository');

const TIMEOUT_SECONDS = Number(process.env.HOSPITAL_RESPONSE_TIMEOUT_SECONDS || 120);
const SWEEP_INTERVAL_MS = Number(process.env.HOSPITAL_TIMEOUT_SWEEP_MS || 5000);

let timer = null;

async function advanceCase(caseRow) {
  const next = await prisma.hospitalRequest.findFirst({
    where: { emergencyCaseId: caseRow.id, status: 'PENDING' },
    orderBy: { matchScore: 'asc' },
    include: { hospital: true },
  });

  if (next) {
    await notificationService.notifyHospital(
      next.hospital.userId,
      `New SOS routed to you. Type: ${caseRow.emergencyType}, Severity: ${caseRow.severity}`,
      { emergencyCaseId: caseRow.id },
      next.hospital.phone
    );

    const patientInfo = await prisma.patient.findUnique({
      where: { id: caseRow.patientId },
      select: { name: true, age: true, gender: true, bloodGroup: true },
    });

    const nextPayload = {
      caseId: caseRow.caseId,
      publicCaseId: caseRow.caseId,
      emergencyType: caseRow.emergencyType,
      severity: caseRow.severity,
      symptoms: caseRow.symptoms,
      distanceKm: next.distanceKm,
      hospitalRequestId: next.id,
      source: caseRow.source || 'PATIENT_APP',
      patientInfo: patientInfo || undefined,
      patientLocation: caseRow.location,
      createdAt: caseRow.createdAt,
    };

    if (next.hospital?.userId) {
      emitToHospital(next.hospital.userId, 'emergency:new-case', nextPayload);
      emitToHospital(next.hospital.userId, 'emergency:request-created', nextPayload);
    }

    emitToUser(caseRow.patient.userId, 'case:next-hospital', {
      caseId: caseRow.caseId,
      searching: true,
      hospital: {
        id: next.hospital.id,
        name: next.hospital.name,
        address: next.hospital.address,
        distanceKm: next.distanceKm,
        capabilities: next.hospital.capabilities || [],
      },
    });
    emitToUser(caseRow.patient.userId, 'hospital:found', {
      caseId: caseRow.caseId,
      hospital: {
        id: next.hospital.id,
        name: next.hospital.name,
        address: next.hospital.address,
        phone: next.hospital.phone,
        distanceKm: next.distanceKm,
        capabilities: next.hospital.capabilities || [],
      },
    });
  } else {
    emitToUser(caseRow.patient.userId, 'emergency:no-hospital', {
      caseId: caseRow.caseId,
      message: 'No suitable hospital responded in time.',
    });
  }
}

async function sweepExpiredRequests() {
  try {
    const cutoff = new Date(Date.now() - TIMEOUT_SECONDS * 1000);
    const expiredRequests = await prisma.hospitalRequest.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true, hospitalId: true, emergencyCaseId: true },
    });
    if (expiredRequests.length === 0) return;

    const byCase = new Map();
    for (const r of expiredRequests) {
      if (!byCase.has(r.emergencyCaseId)) byCase.set(r.emergencyCaseId, []);
      byCase.get(r.emergencyCaseId).push(r);
    }

    for (const [caseId, requests] of byCase) {
      const caseRow = await prisma.emergencyCase.findUnique({
        where: { id: caseId },
        include: { patient: { select: { userId: true, phone: true } } },
      });
      if (!caseRow || caseRow.status !== 'PENDING') continue; // already accepted/cancelled

      await prisma.hospitalRequest.updateMany({
        where: { id: { in: requests.map(r => r.id) } },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      });

      for (const r of requests) {
        const hospital = await prisma.hospital.findUnique({
          where: { id: r.hospitalId },
          select: { id: true, name: true, userId: true },
        });
        await emergencyRepository.createAuditLog({
          userId: caseRow.patient.userId,
          action: 'EMERGENCY_UPDATED',
          entity: 'EmergencyCase',
          entityId: caseId,
          endpoint: 'system:hospital-timeout',
          details: {
            event: 'HOSPITAL_TIMEOUT',
            hospitalId: r.hospitalId,
            hospitalName: hospital?.name || null,
            requestId: r.id,
            timeoutSeconds: TIMEOUT_SECONDS,
          },
        });

        const timeoutPayload = {
          caseId: caseRow.caseId,
          publicCaseId: caseRow.caseId,
          hospital: { id: r.hospitalId, name: hospital?.name || 'Hospital' },
          reason: `No response within ${TIMEOUT_SECONDS}s`,
        };

        emitToUser(caseRow.patient.userId, 'hospital:timeout', timeoutPayload);

        if (hospital?.userId) {
          emitToHospital(hospital.userId, 'emergency:timeout', timeoutPayload);
          emitToHospital(hospital.userId, 'case:closed-elsewhere', {
            ...timeoutPayload,
            status: 'EXPIRED',
          });
        }
      }

      await advanceCase(caseRow);
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
      console.warn('[HospitalTimeout] Database starting up or connection unavailable. Will retry on next sweep cycle.');
    } else {
      console.error('[HospitalTimeout] sweep failed:', {
        code: e?.code,
        message: e?.message || e?.shortMessage || 'Unknown Prisma error',
        meta: e?.meta,
      });
    }
  }
}

function startHospitalTimeoutSweeper() {
  if (timer) return;
  timer = setInterval(() => {
    void sweepExpiredRequests();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.log(`[HospitalTimeout] Sweeper started (timeout=${TIMEOUT_SECONDS}s, sweep=${SWEEP_INTERVAL_MS}ms)`);
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
        requestedAt: { lt: cutoff },
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
  TIMEOUT_SECONDS,
};