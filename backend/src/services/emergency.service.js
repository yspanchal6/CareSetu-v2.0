const crypto = require('crypto');
const prisma = require('../config/prisma');
const emergencyRepository = require('../repositories/emergency.repository');
const safetyRuleEngineService = require('./safety-rule-engine.service');
const hospitalMatchingService = require('./hospital-matching.service');
const healthPackService = require('./health-pack.service');
const notificationService = require('./notification.service');
const textbeeProvider = require('./providers/textbee.provider');
const brevoProvider = require('./providers/brevo.provider');
const fcmProvider = require('./providers/fcm.provider');
const { getIo } = require('../utils/socket');
const { emitToUser, emitToHospital } = require('../utils/emergency.events');

function publicCaseId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `CASE-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Compute the patient-facing stage from a real CaseStatus.
 * This is the single source of truth used by both the API and realtime events.
 */
function statusToStage(status) {
  switch (status) {
    case 'PENDING':
    case 'MATCHING':
    case 'HOSPITAL_REQUESTED':
      return 'FindingHospital';
    case 'ACCEPTED':
      return 'HospitalAssigned';
    case 'TRANSFER':
    case 'IN_PROGRESS':
      return 'Transfer';
    case 'TREATMENT':
      return 'Treatment';
    case 'CLOSED':
      return 'Completed';
    case 'CANCELLED':
      return 'Completed';
    default:
      return 'FindingHospital';
  }
}

/**
 * Build the normalized realtime/API case snapshot for patient tracking.
 * `hospitalRequests` is an optional pre-joined relation array.
 */
function buildCaseSnapshot(emergencyCase, hospitalRequests = []) {
  const attempts = (hospitalRequests || []).map(hr => ({
    hospitalId: hr.hospitalId,
    hospitalName: hr.hospital?.name,
    address: hr.hospital?.address,
    photo: hr.hospital?.phone,
    distanceKm: hr.distanceKm ?? null,
    capabilities: hr.hospital?.capabilities || [],
    status: hr.status,
    requestedAt: hr.requestedAt,
    respondedAt: hr.respondedAt,
    rejectionReason: hr.rejectionReason,
  }));

  return {
    id: emergencyCase.id,
    caseId: emergencyCase.caseId,
    status: emergencyCase.status,
    stage: statusToStage(emergencyCase.status),
    severity: emergencyCase.severity,
    emergencyType: emergencyCase.emergencyType,
    symptoms: emergencyCase.symptoms,
    location: emergencyCase.location ? {
      latitude: Number(emergencyCase.location.latitude),
      longitude: Number(emergencyCase.location.longitude),
    } : null,
    createdAt: emergencyCase.createdAt,
    acceptedAt: emergencyCase.acceptedAt,
    closedAt: emergencyCase.closedAt,
    hospital: emergencyCase.hospital
      ? {
        id: emergencyCase.hospital.id,
        name: emergencyCase.hospital.name,
        address: emergencyCase.hospital.address,
        phone: emergencyCase.hospital.phone,
      }
      : null,
    attempts,
  };
}

const createEmergencyCase = async ({ userId, emergencyType, severity, latitude, longitude, symptoms, idempotencyKey, source, patientMedicalHistory }) => {
  // 0. Idempotency Check
  if (idempotencyKey) {
    const existingCase = await emergencyRepository.getEmergencyCaseByIdempotencyKey(idempotencyKey);
    if (existingCase) {
      return {
        emergencyCase: existingCase,
        nearestHospitals: [], // For MVP, we just return empty array if returning existing case to avoid extra queries, or we can fetch them. Let's return empty array.
        isIdempotentResponse: true
      };
    }
  }

  // 1. Verify user & authorization
  if (!userId) {
    const error = new Error("User authentication is required.");
    error.status = 401;
    throw error;
  }

  const userRecord = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRecord) {
    const error = new Error("User account not found. Please log in again.");
    error.status = 401;
    throw error;
  }

  if (userRecord.role !== 'PATIENT' && userRecord.role !== 'GUEST') {
    const error = new Error(`Access denied. Roles of type ${userRecord.role} cannot initiate an emergency SOS.`);
    error.status = 403;
    throw error;
  }

  let patient = await emergencyRepository.getPatientByUserId(userId);

  if (!patient) {
    // Auto-create missing Patient profile for valid PATIENT/GUEST user
    patient = await prisma.patient.create({
      data: {
        userId: userRecord.id,
        name: userRecord.name || 'Test Patient',
        age: 30,
        gender: 'Other',
        phone: '9898676838',
        bloodGroup: 'Not specified',
        allergies: 'None recorded',
        location: (latitude != null && longitude != null) ? { latitude: Number(latitude), longitude: Number(longitude) } : undefined,
      },
    });
    console.log(`[EmergencyService] Auto-created missing Patient profile for user ${userRecord.id}`);
  }

  const { isUserBlocked } = require('./admin-blocklist.service');
  const blockCheck = await isUserBlocked(userId);
  if (blockCheck.isBlocked) {
    const error = new Error(`Account is restricted by an administrator. Reason: ${blockCheck.reason || 'Account suspended'}`);
    error.status = 403;
    throw error;
  }

  // 2. Validate GPS
  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  if (latitude == null || longitude == null || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    const error = new Error("Valid current location coordinates are required for emergency SOS.");
    error.status = 400;
    throw error;
  }
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    const error = new Error("Invalid latitude or longitude coordinate ranges.");
    error.status = 400;
    throw error;
  }

  // 3. Generate Case ID
  const caseId = publicCaseId();

  // 4. Run Safety Rule Engine to determine final severity and priority
  const safetyResult = safetyRuleEngineService.evaluateEmergency(emergencyType, severity, symptoms);

  const { encryptJSON } = require('../utils/crypto');

  // Construct static Medical History Snapshot at SOS creation & encrypt with AES-256-GCM
  const rawSummaryPayload = {
    cardiacCondition: patient.heartCondition || 'UNKNOWN',
    diabetesStatus: patient.diabetesStatus || 'UNKNOWN',
    hypertensionStatus: patient.hypertensionStatus || 'UNKNOWN',
    bloodGroup: patient.bloodGroup || 'NOT_PROVIDED',
    allergies: patient.allergies || 'NOT_PROVIDED',
    currentMedications: patient.medications || 'NOT_PROVIDED',
    confirmedConditions: patient.conditions || patient.medicalConditions || 'NOT_PROVIDED',
    snapshotTimestamp: new Date().toISOString(),
  };

  const encryptedSummary = encryptJSON(rawSummaryPayload);

  // 5. Create Emergency Case
  let emergencyCase;
  try {
    emergencyCase = await emergencyRepository.createEmergencyCase({
      caseId: publicCaseId(),
      patientId: patient.id,
      symptoms: symptoms || 'Not provided',
      emergencyType: safetyResult.matchedRule.includes('CARDIAC') ? 'CARDIAC' : (emergencyType || 'MEDICAL'),
      severity: safetyResult.severity,
      location: {
        latitude: latNum,
        longitude: lngNum,
      },
      detectedWords: safetyResult.matchedRule !== 'Default' ? [safetyResult.matchedRule] : [],
      status: 'PENDING',
      source: source || 'PATIENT_APP',
      idempotencyKey: idempotencyKey || null,
      aiReason: `Priority: ${safetyResult.priority}, Rule: ${safetyResult.matchedRule}`,
      medicalSummary: encryptedSummary,
    });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('idempotencyKey')) {
      const existingCase = await emergencyRepository.getEmergencyCaseByIdempotencyKey(idempotencyKey);
      return {
        emergencyCase: existingCase,
        nearestHospitals: [],
        isIdempotentResponse: true
      };
    }
    throw error;
  }

  // 6. Get Active Hospitals and Call Hospital Matching Service
  let matchedHospitals = [];
  try {
    const findFn = typeof hospitalMatchingService.findBestHospitals === 'function'
      ? hospitalMatchingService.findBestHospitals
      : hospitalMatchingService.HospitalMatchingService?.findBestHospitals;

    if (typeof findFn === 'function') {
      matchedHospitals = await findFn({
        latitude: latNum,
        longitude: lngNum,
        emergencyType
      });
    } else {
      console.warn('[EmergencyService] ⚠️ hospitalMatchingService.findBestHospitals function is unavailable');
    }
  } catch (matchingErr) {
    console.error('[EmergencyService] Hospital matching non-fatal error:', matchingErr.message);
    matchedHospitals = [];
  }

  if (!Array.isArray(matchedHospitals) || matchedHospitals.length === 0) {
    console.log('[EmergencyService] ℹ️ No matching hospital candidates found for coordinates');
    matchedHospitals = [];
  }

  // 7. Create Hospital Requests (Sequential Targeted Queue)
  if (matchedHospitals.length > 0) {
    const now = new Date();
    const requestsData = matchedHospitals.map((match, idx) => ({
      emergencyCaseId: emergencyCase.id,
      hospitalId: match.hospital.id,
      status: 'PENDING',
      distanceKm: match.distanceKm,
      capabilityMatched: match.capabilityMatched,
      availabilityMatched: match.availabilityMatched,
      matchScore: match.matchScore,
      // Target Candidate 0 first; Candidates 1..N-1 are queued with requestedAt: null
      requestedAt: idx === 0 ? now : null,
    }));

    await emergencyRepository.createHospitalRequests(requestsData);

    let io = global.io;
    if (!io) {
      try { io = getIo(); } catch { }
    }

    const isRedFlag = emergencyCase.severity === 'RED' || emergencyCase.severity === 'ORANGE';

    // Dispatch active alert ONLY to Candidate 0 (the top-ranked hospital)
    const activeMatch = matchedHospitals[0];
    if (activeMatch) {
      const hospital = activeMatch.hospital;
      const hospitalUserId = hospital.userId;
      const distanceStr = activeMatch.distanceKm != null ? activeMatch.distanceKm.toFixed(1) : 'N/A';

      const rawBloodGroup = patient?.bloodGroup ? String(patient.bloodGroup).trim() : null;
      const bloodGroup = rawBloodGroup || patientMedicalHistory?.bloodGroup || null;

      const rawKnownConditions = (patient?.medicalConditions ? String(patient.medicalConditions).trim() : null) ||
        (patient?.conditions ? String(patient.conditions).trim() : null);
      const knownConditions = rawKnownConditions || patientMedicalHistory?.knownConditions || null;

      const payload = {
        caseId: emergencyCase.caseId,
        publicCaseId: emergencyCase.caseId,
        emergencyType: emergencyCase.emergencyType,
        severity: emergencyCase.severity,
        isRedFlag,
        symptoms: emergencyCase.symptoms,
        source: emergencyCase.source || 'DIRECT',
        distanceKm: activeMatch.distanceKm,
        hospitalRequestId: requestsData[0]?.id,
        bloodGroup: bloodGroup,
        knownConditions: knownConditions,
        patientInfo: {
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          phone: patient.phone,
          bloodGroup: bloodGroup,
          knownConditions: knownConditions,
          medicalConditions: knownConditions,
        },
        patientLocation: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
        requestedAt: now.toISOString(),
      };

      if (io) {
        try {
          io.to(`hospital:${hospitalUserId}`).emit('emergency:new-case', payload);
          if (hospitalUserId) {
            io.to(hospitalUserId).emit('emergency:new-case', payload);
          }
          console.log(`[Socket] Emitted emergency:new-case to targeted hospital:${hospitalUserId}`, payload.caseId);
        } catch (socketErr) {
          console.error('[Socket] Failed to emit:', socketErr.message);
        }
      }

      // RED FLAG CASES ONLY: Send SMS and High-Priority Push Alerts
      if (isRedFlag) {
        if (hospital.phone) {
          textbeeProvider.sendSMS(
            hospital.phone,
            `🚨 CARESETU RED-ALERT EMERGENCY\n\nCase: ${emergencyCase.caseId}\nSeverity: ${emergencyCase.severity}\nDistance: ${distanceStr} km\nSymptoms: ${emergencyCase.symptoms || 'Not provided'}\n\nOpen dashboard to ACCEPT.`
          ).then(() => console.log(`[SMS] Sent Red Alert to ${hospital.name}`))
            .catch(err => console.error(`[SMS] Failed for ${hospital.name}:`, err.message));
        }

        // 2. Non-blocking Email
        if (hospital.email) {
          brevoProvider.sendEmail({
            to: hospital.email,
            subject: `🚨 Emergency Case ${emergencyCase.caseId}`,
            html: `
              <h2>Emergency Alert</h2>
              <p><strong>Case:</strong> ${emergencyCase.caseId}</p>
              <p><strong>Severity:</strong> ${emergencyCase.severity}</p>
              <p><strong>Source:</strong> ${emergencyCase.source || 'DIRECT'}</p>
              <p><strong>Symptoms:</strong> ${emergencyCase.symptoms || 'Not provided'}</p>
              <p><strong>Distance:</strong> ${distanceStr} km</p>
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/hospital/emergencies">Open Dashboard</a></p>
            `,
          }).then(() => console.log(`[Email] Sent to ${hospital.email}`))
            .catch(err => console.error(`[Email] Failed for ${hospital.email}:`, err.message));
        }

        // 3. Non-blocking Push (FCM)
        if (hospitalUserId) {
          prisma.fcmToken.findMany({
            where: { userId: hospitalUserId, isActive: true },
          }).then(tokens => {
            tokens.forEach(token => {
              fcmProvider.sendPush({
                token: token.token,
                title: `🚨 Emergency: ${emergencyCase.caseId}`,
                body: `${emergencyCase.severity} - ${emergencyCase.symptoms || 'Emergency'}`,
                data: {
                  caseId: emergencyCase.caseId,
                  distanceKm: m.distanceKm != null ? String(m.distanceKm) : '0',
                  bloodGroup: bloodGroup !== null ? String(bloodGroup) : 'Not provided',
                  knownConditions: knownConditions !== null ? String(knownConditions) : 'Not provided',
                  blood_group: bloodGroup || 'Not provided',
                  medical_conditions: knownConditions || 'Not provided',
                },
              }).catch(err => console.error(`[FCM] Push failed:`, err.message));
            });
          }).catch(err => console.error(`[FCM Token Lookup] Failed:`, err.message));
        }
      } else {
        console.log(`[Notification] Non-critical Green/Yellow flag case (${emergencyCase.severity}) — dispatched in-app/socket alert without SMS/high-priority push siren.`);
      }

      notificationService.notifyHospital(
        hospitalUserId,
        `An emergency case (${emergencyCase.caseId}) requires your immediate attention.`,
        {
          emergencyCaseId: emergencyCase.id,
          caseId: emergencyCase.caseId,
          distanceKm: activeMatch.distanceKm != null ? String(activeMatch.distanceKm) : '0',
          isRedFlag,
        },
        hospital.phone
      ).catch(err => console.error('[NotifyHospital] Non-blocking warning:', err.message));
    }
  }

  // 8. Emit realtime events to the patient
  const patientUserId = patient.userId;
  const snapshot = buildCaseSnapshot(emergencyCase, []
    .concat(matchedHospitals.map(m => ({
      hospitalId: m.hospital.id,
      hospital: m.hospital,
      distanceKm: m.distanceKm,
      status: 'PENDING',
      requestedAt: new Date(),
    }))));

  emitToUser(patientUserId, 'emergency:created', {
    ...snapshot,
    matchedHospitals: matchedHospitals.map(m => ({
      id: m.hospital.id,
      name: m.hospital.name,
      address: m.hospital.address,
      distanceKm: m.distanceKm,
      capabilities: m.hospital.capabilities || [],
    })),
  });

  for (const m of matchedHospitals) {
    emitToUser(patientUserId, 'hospital:found', {
      caseId: emergencyCase.caseId,
      hospital: {
        id: m.hospital.id,
        name: m.hospital.name,
        address: m.hospital.address,
        phone: m.hospital.phone,
        distanceKm: m.distanceKm,
        capabilities: m.hospital.capabilities || [],
      },
    });
  }
  emitToUser(patientUserId, 'emergency:request-sent', {
    caseId: emergencyCase.caseId,
    requestCount: matchedHospitals.length,
  });
  if (matchedHospitals.length === 0) {
    emitToUser(patientUserId, 'emergency:no-hospital', {
      caseId: emergencyCase.caseId,
      message: 'No suitable hospital found in the configured search radius.',
    });
  }

  // 9. Create Audit Log
  await emergencyRepository.createAuditLog({
    userId,
    action: 'EMERGENCY_CREATED',
    entity: 'EmergencyCase',
    entityId: emergencyCase.id,
    endpoint: '/api/emergency/sos',
    details: {
      caseId: emergencyCase.caseId,
      severity: safetyResult.severity,
      hospitalsMatched: matchedHospitals.length
    }
  });

  // 10. Return results
  return {
    emergencyCase,
    nearestHospitals: matchedHospitals.map(m => ({
      ...m.hospital,
      distanceKm: m.distanceKm
    })),
  };
};

const acceptEmergencyCase = async (caseId, hospitalUserId) => {
  const { isUserBlocked } = require('./admin-blocklist.service');
  const blockCheck = await isUserBlocked(hospitalUserId);
  if (blockCheck.isBlocked) {
    const error = new Error(`Blocked hospitals cannot accept emergency cases. Reason: ${blockCheck.reason || 'Account suspended'}`);
    error.status = 403;
    throw error;
  }

  const hospital = await prisma.hospital.findUnique({ where: { userId: hospitalUserId } });
  if (!hospital) throw new Error('Hospital profile not found.');

  // ATOMIC CLAIM: Only one concurrent request can successfully claim a PENDING unassigned case
  const claimed = await prisma.emergencyCase.updateMany({
    where: {
      id: caseId,
      status: 'PENDING',
      hospitalId: null,
    },
    data: {
      hospitalId: hospital.id,
      status: 'TRANSFER',
      acceptedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    throw new Error('Case is no longer available or has already been accepted by another hospital.');
  }

  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });

  // Fetch other hospitals currently holding PENDING requests for this case BEFORE changing statuses
  const otherPendingRequests = await prisma.hospitalRequest.findMany({
    where: { emergencyCaseId: caseId, status: 'PENDING', hospitalId: { not: hospital.id } },
    include: { hospital: { select: { userId: true } } },
  });

  // 1. Update HospitalRequest to ACCEPTED
  await prisma.hospitalRequest.updateMany({
    where: { emergencyCaseId: caseId, hospitalId: hospital.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() }
  });

  // 2. Mark other PENDING requests as CANCELLED
  await prisma.hospitalRequest.updateMany({
    where: { emergencyCaseId: caseId, status: 'PENDING', hospitalId: { not: hospital.id } },
    data: { status: 'CANCELLED' }
  });

  const updatedCase = await prisma.emergencyCase.findUnique({
    where: { id: caseId },
    include: { patient: { select: { userId: true, name: true, phone: true, age: true, gender: true } } },
  });

  // 4. Audit Log
  await emergencyRepository.createAuditLog({
    userId: hospitalUserId,
    action: 'HOSPITAL_ACCEPTED',
    details: `Hospital ${hospital.name} accepted case ${emergencyCase.caseId}`,
  });

  // 5. Automatically Share HealthPack (Phase 3 / P1)
  try {
    await healthPackService.shareHealthPackWithHospital(emergencyCase.patientId, hospital.id, hospitalUserId);
    console.log(`[P1 feature] HealthPack shared with hospital ${hospital.name}`);
  } catch (err) {
    console.warn("Failed to share HealthPack automatically:", err.message);
  }

  // 6. Notify Patient of Acceptance
  await notificationService.notifyPatient(
    updatedCase.patient.userId,
    `CareSetu: ${hospital.name} has ACCEPTED your emergency case. Help is on the way.`,
    'HOSPITAL_ACCEPTED',
    { caseId: updatedCase.id, hospitalId: hospital.id },
    updatedCase.patient.phone
  );

  // 7. Emit realtime events to the patient
  const hospitalSnapshot = {
    id: hospital.id,
    name: hospital.name,
    address: hospital.address,
    phone: hospital.phone,
  };
  emitToUser(updatedCase.patient.userId, 'case:accepted', {
    caseId: updatedCase.caseId,
    status: 'TRANSFER',
    hospital: hospitalSnapshot,
  });
  emitToUser(updatedCase.patient.userId, 'transfer:started', {
    caseId: updatedCase.caseId,
    hospital: hospitalSnapshot,
    startedAt: new Date(),
  });

  // 8. Emit realtime events to the accepting hospital and other hospitals
  if (hospitalUserId) {
    const payload = {
      caseId: updatedCase.caseId,
      publicCaseId: updatedCase.caseId,
      status: 'TRANSFER',
      hospital: hospitalSnapshot,
      assignedAt: new Date(),
    };
    emitToHospital(hospitalUserId, 'case:assigned-to-us', payload);
    emitToHospital(hospitalUserId, 'emergency:accepted', payload);
    emitToHospital(hospitalUserId, 'emergency:request-updated', { ...payload, status: 'ACCEPTED' });
  }

  for (const otherReq of otherPendingRequests) {
    if (otherReq.hospital?.userId) {
      const payload = {
        caseId: updatedCase.caseId,
        publicCaseId: updatedCase.caseId,
        status: 'CLOSED_ELSEWHERE',
        closedAt: new Date(),
        message: 'Case was accepted by another hospital.',
      };
      emitToHospital(otherReq.hospital.userId, 'case:closed-elsewhere', payload);
      emitToHospital(otherReq.hospital.userId, 'emergency:request-updated', { ...payload, status: 'CANCELLED' });
    }
  }

  return updatedCase;
};

const rejectEmergencyCase = async (caseId, hospitalUserId, reason) => {
  const hospital = await prisma.hospital.findUnique({ where: { userId: hospitalUserId } });
  if (!hospital) throw new Error('Hospital profile not found.');

  const emergencyCase = await prisma.emergencyCase.findUnique({
    where: { id: caseId },
    include: { patient: { select: { userId: true, phone: true } } },
  });
  console.log("Rejecting Case ID:", caseId, "Found Case:", emergencyCase?.id, "Status:", emergencyCase?.status);
  if (!emergencyCase || emergencyCase.status !== 'PENDING') {
    throw new Error('Case is no longer available or does not exist.');
  }

  // 1. Mark this request as REJECTED
  await prisma.hospitalRequest.updateMany({
    where: { emergencyCaseId: caseId, hospitalId: hospital.id },
    data: { status: 'REJECTED', respondedAt: new Date(), rejectionReason: reason || 'Busy' }
  });

  // 2. Audit Log
  await emergencyRepository.createAuditLog({
    userId: hospitalUserId,
    action: 'HOSPITAL_REJECTED',
    details: `Hospital ${hospital.name} rejected case ${emergencyCase.caseId}`,
  });

  // 3. Find next pending hospital to notify (Cascade)
  const nextRequest = await prisma.hospitalRequest.findFirst({
    where: { emergencyCaseId: caseId, status: 'PENDING' },
    orderBy: { matchScore: 'asc' }, // The one with lowest score is best
    include: { hospital: true }
  });

  if (nextRequest) {
    // Notify the next hospital
    await notificationService.notifyHospital(
      nextRequest.hospital.userId,
      `New SOS routed to you. Type: ${emergencyCase.emergencyType}, Severity: ${emergencyCase.severity}`,
      { caseId: emergencyCase.id },
      nextRequest.hospital.phone
    );
  }

  // 4. Emit rejection + next-search realtime events to the patient
  const rejectedHospital = {
    id: hospital.id,
    name: hospital.name,
    address: hospital.address,
  };

  // Check confirmed pending hospital after this rejection
  const pendingCount = nextRequest ? 1 : 0;

  emitToUser(emergencyCase.patient.userId, 'hospital:rejected', {
    caseId: emergencyCase.caseId,
    hospital: rejectedHospital,
    reason: reason || 'Busy',
    responseCount: pendingCount + 1,
  });

  if (nextRequest) {
    emitToUser(emergencyCase.patient.userId, 'case:next-hospital', {
      caseId: emergencyCase.caseId,
      searching: true,
      hospital: {
        id: nextRequest.hospital.id,
        name: nextRequest.hospital.name,
        address: nextRequest.hospital.address,
        distanceKm: nextRequest.distanceKm,
        capabilities: nextRequest.hospital.capabilities || [],
      },
    });
    // Notify the next hospital in real-time too
    emitToUser(emergencyCase.patient.userId, 'hospital:found', {
      caseId: emergencyCase.caseId,
      hospital: {
        id: nextRequest.hospital.id,
        name: nextRequest.hospital.name,
        address: nextRequest.hospital.address,
        phone: nextRequest.hospital.phone,
        distanceKm: nextRequest.distanceKm,
        capabilities: nextRequest.hospital.capabilities || [],
      },
    });
  } else {
    emitToUser(emergencyCase.patient.userId, 'emergency:no-hospital', {
      caseId: emergencyCase.caseId,
      message: 'No suitable hospital could accept the emergency.',
    });
  }

  return { success: true, message: 'Case rejected and cascaded to next hospital if available.' };
};

module.exports = {
  createEmergencyCase,
  acceptEmergencyCase,
  rejectEmergencyCase,
  statusToStage,
  buildCaseSnapshot,
};
