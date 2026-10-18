const prisma = require('../config/prisma');

function coordinates(location) {
  if (!location || typeof location !== 'object') return null;
  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function distanceInKilometres(from, to) {
  const radians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.findNearbyHospitals = async (req, res, next) => {
  try {
    const latitude = Number(req.query.lat ?? req.query.latitude);
    const longitude = Number(req.query.lng ?? req.query.longitude);
    const radiusKm = Math.min(200, Math.max(1, Number(req.query.radius ?? req.query.radiusKm ?? 25)));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'A valid latitude (-90 to 90) and longitude (-180 to 180) are required.' });
    }

    const emergencyRepository = require('../repositories/emergency.repository');
    const rawHospitals = await emergencyRepository.getActiveHospitalsInRadius(latitude, longitude, radiusKm);

    const nearbyHospitals = rawHospitals.map((h) => {
      const distKm = Number(h.distanceMeters || 0) / 1000;
      return {
        id: h.id,
        name: h.name,
        address: h.address,
        phone: h.phone,
        city: h.city || null,
        capabilities: h.capabilities || [],
        emergencyAvailable: Boolean(h.emergencyAvailable),
        isVerified: Boolean(h.isVerified),
        hasEmergencyDepartment: Boolean(h.hasEmergencyDepartment),
        hasICU: Boolean(h.hasICU),
        hasTraumaUnit: Boolean(h.hasTraumaUnit),
        hasCardiology: Boolean(h.hasCardiology),
        hasNeurology: Boolean(h.hasNeurology),
        hasAmbulance: Boolean(h.hasAmbulance),
        distanceKm: Number(distKm.toFixed(2)),
        distance: `${distKm.toFixed(1)} km`,
        location: {
          latitude: Number(h.latitude),
          longitude: Number(h.longitude),
        },
      };
    });

    res.json({
      success: true,
      hospitals: nearbyHospitals,
      count: nearbyHospitals.length,
      searchRadiusKm: radiusKm,
    });
  } catch (error) {
    next(error);
  }
};

const crypto = require('crypto');

function computePayloadHash(payload) {
  const str = JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(str).digest('hex');
}

function getIdempotencyKey(req) {
  return (
    req.headers['x-idempotency-key'] ||
    req.body?.idempotencyKey ||
    req.body?.operationId ||
    req.query?.idempotencyKey
  );
}

exports.acceptCase = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (req.user.role !== 'HOSPITAL') {
      return res.status(403).json({ error: 'Only hospital accounts can accept an emergency case.', code: 'FORBIDDEN_ROLE' });
    }

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      return res.status(409).json({ error: 'Complete your hospital profile before accepting a case.', code: 'PROFILE_INCOMPLETE' });
    }

    const caseIdParam = req.params.caseId;
    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseIdParam }, { caseId: caseIdParam }] },
    });
    if (!emergencyCase) return res.status(404).json({ error: 'Case not found.', code: 'CASE_NOT_FOUND' });

    const idempotencyKey = getIdempotencyKey(req);
    const payloadHash = computePayloadHash(req.body);

    if (idempotencyKey) {
      const existingRecord = await prisma.hospitalIdempotencyRecord.findUnique({
        where: { operationId: idempotencyKey },
      });

      if (existingRecord) {
        if (
          existingRecord.actorUserId !== userId ||
          existingRecord.hospitalId !== hospital.id ||
          existingRecord.caseId !== emergencyCase.id ||
          existingRecord.actionType !== 'ACCEPT' ||
          existingRecord.payloadHash !== payloadHash
        ) {
          return res.status(400).json({
            error: 'Idempotency Key Payload Mismatch: Operation ID cannot be reused with a modified payload or different actor.',
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          });
        }

        const parsedBody = JSON.parse(existingRecord.responseBody);
        return res.status(existingRecord.responseStatus).json(parsedBody);
      }
    }

    // Check if case is already accepted by this hospital
    if (emergencyCase.hospitalId === hospital.id && emergencyCase.status === 'ACCEPTED') {
      const resp = { success: true, message: 'Case already accepted by your hospital.', code: 'ALREADY_APPLIED' };
      if (idempotencyKey) {
        await prisma.hospitalIdempotencyRecord.create({
          data: {
            operationId: idempotencyKey,
            actorUserId: userId,
            hospitalId: hospital.id,
            caseId: emergencyCase.id,
            actionType: 'ACCEPT',
            payloadHash,
            responseStatus: 200,
            responseBody: JSON.stringify(resp),
          },
        }).catch(() => { });
      }
      return res.json(resp);
    }

    // Check if case is accepted by another hospital
    if (emergencyCase.hospitalId && emergencyCase.hospitalId !== hospital.id) {
      return res.status(409).json({
        error: 'This emergency case has already been accepted or assigned to another hospital.',
        code: 'ACCEPTED_BY_OTHER',
      });
    }

    // Check if case is no longer active
    const activeStatuses = ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED'];
    if (!activeStatuses.includes(emergencyCase.status)) {
      return res.status(409).json({
        error: 'This emergency case is no longer active or available for acceptance.',
        code: 'INVALID_STATE',
      });
    }

    const successResponse = { success: true, message: 'Case accepted. Patient notified.', code: 'SUCCESS' };

    await prisma.$transaction(async (tx) => {
      // 1. Atomic claim check: prevent two hospitals from accepting the same case
      const claimed = await tx.emergencyCase.updateMany({
        where: {
          id: emergencyCase.id,
          status: { in: ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED'] },
          OR: [{ hospitalId: null }, { hospitalId: hospital.id }],
        },
        data: { hospitalId: hospital.id, status: 'ACCEPTED', acceptedAt: new Date() },
      });

      if (claimed.count === 0) {
        const currentCase = await tx.emergencyCase.findUnique({ where: { id: emergencyCase.id } });
        if (currentCase && currentCase.hospitalId && currentCase.hospitalId !== hospital.id) {
          const err = new Error('This emergency case has already been accepted by another hospital.');
          err.status = 409;
          err.code = 'ACCEPTED_BY_OTHER';
          throw err;
        } else {
          const err = new Error('This emergency case is no longer available to accept.');
          err.status = 409;
          err.code = 'INVALID_STATE';
          throw err;
        }
      }

      // 2. Update HospitalRequest if present
      await tx.hospitalRequest.updateMany({
        where: { emergencyCaseId: emergencyCase.id, hospitalId: hospital.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });

      // 3. Retrieve or auto-generate active HealthPack for patient within transaction
      let healthPack = await tx.healthPack.findFirst({
        where: { patientId: emergencyCase.patientId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });

      if (!healthPack) {
        const patient = await tx.patient.findUnique({ where: { id: emergencyCase.patientId } });
        const { encrypt } = require('../utils/crypto');
        const rawString = JSON.stringify({
          bloodGroup: patient?.bloodGroup || 'NOT_PROVIDED',
          allergies: patient?.allergies || 'NOT_PROVIDED',
          medications: patient?.medications || 'NOT_PROVIDED',
          conditions: patient?.conditions || patient?.medicalConditions || 'NOT_PROVIDED',
          heartCondition: patient?.heartCondition || 'UNKNOWN',
          diabetesStatus: patient?.diabetesStatus || 'UNKNOWN',
          hypertensionStatus: patient?.hypertensionStatus || 'UNKNOWN',
        });
        const { iv, encryptedData } = encrypt(rawString);
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        healthPack = await tx.healthPack.create({
          data: {
            patientId: emergencyCase.patientId,
            encryptedData,
            iv,
            status: 'ACTIVE',
            expiresAt,
          },
        });
      }

      // 4. Ensure HealthPackShare exists for hospital UUID without modifying existing shares or creating duplicates
      const existingShare = await tx.healthPackShare.findFirst({
        where: {
          healthPackId: healthPack.id,
          sharedWithHospitalId: hospital.id,
          status: 'ACTIVE',
        },
      });

      const shareExpiresAt = new Date();
      shareExpiresAt.setHours(shareExpiresAt.getHours() + 24);

      if (!existingShare) {
        await tx.healthPackShare.create({
          data: {
            healthPackId: healthPack.id,
            sharedWithHospitalId: hospital.id,
            sharedWithUserId: hospital.userId,
            consentGranted: true,
            status: 'ACTIVE',
            expiresAt: shareExpiresAt,
          },
        });
      } else if (existingShare.expiresAt && existingShare.expiresAt < new Date()) {
        await tx.healthPackShare.update({
          where: { id: existingShare.id },
          data: { status: 'ACTIVE', expiresAt: shareExpiresAt },
        });
      }

      if (idempotencyKey) {
        await tx.hospitalIdempotencyRecord.create({
          data: {
            operationId: idempotencyKey,
            actorUserId: userId,
            hospitalId: hospital.id,
            caseId: emergencyCase.id,
            actionType: 'ACCEPT',
            payloadHash,
            responseStatus: 200,
            responseBody: JSON.stringify(successResponse),
          },
        });
      }
    });

    res.json(successResponse);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message, code: error.code || 'CONFLICT' });
    }
    next(error);
  }
};

/**
 * POST /api/hospitals/cases/:caseId/assign-doctor
 * Assigns an authorized Doctor/Staff member to an accepted emergency case.
 */
exports.assignDoctor = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (req.user.role !== 'HOSPITAL') {
      return res.status(403).json({ error: 'Only hospital accounts can assign a doctor.', code: 'FORBIDDEN_ROLE' });
    }

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      return res.status(409).json({ error: 'Complete your hospital profile before assigning a doctor.', code: 'PROFILE_INCOMPLETE' });
    }

    const caseIdParam = req.params.caseId;
    const { staffId, doctorId, doctorName, specialty } = req.body || {};
    const targetStaffId = staffId || doctorId;

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseIdParam }, { caseId: caseIdParam }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ error: 'Case not found.', code: 'CASE_NOT_FOUND' });
    }

    if (emergencyCase.hospitalId !== hospital.id) {
      return res.status(403).json({
        error: 'You are not authorized to assign doctors to a case assigned to another facility.',
        code: 'UNAUTHORIZED_HOSPITAL_SCOPE',
      });
    }

    const ASSIGNABLE_STATUSES = ['ACCEPTED', 'TRANSFER', 'IN_PROGRESS', 'TREATMENT'];
    if (!ASSIGNABLE_STATUSES.includes(emergencyCase.status)) {
      return res.status(409).json({
        error: `A doctor cannot be assigned to a case in '${emergencyCase.status}' status. Doctor assignment is only permitted during active stages (${ASSIGNABLE_STATUSES.join(', ')}).`,
        code: 'CASE_NOT_ASSIGNABLE',
      });
    }

    if (!targetStaffId) {
      return res.status(400).json({ error: 'An active hospital doctor staffId is required.', code: 'STAFF_ID_REQUIRED' });
    }

    const staffMember = await prisma.hospitalStaff.findFirst({
      where: { id: targetStaffId, hospitalId: hospital.id, isActive: true },
    });
    if (!staffMember) {
      return res.status(404).json({ error: 'The selected active hospital staff member was not found.', code: 'STAFF_NOT_FOUND' });
    }
    if (!staffMember.email) {
      return res.status(409).json({ error: 'The selected doctor has no linked sign-in account.', code: 'DOCTOR_ACCOUNT_NOT_LINKED' });
    }
    const doctorUser = await prisma.user.findFirst({
      where: {
        email: { equals: staffMember.email, mode: 'insensitive' },
        role: 'DOCTOR',
        status: 'ACTIVE',
      },
      select: { id: true, email: true },
    });
    if (!doctorUser) {
      return res.status(409).json({ error: 'The selected staff member is not linked to an active doctor account.', code: 'DOCTOR_ACCOUNT_NOT_LINKED' });
    }

    if (!/doctor|physician|specialist|surgeon|internist|cardiologist|pediatrician|neurologist|orthopedist|oncologist|consultant/i.test(`${staffMember.role} ${staffMember.clinicalRole || ''}`)) {
      return res.status(422).json({ error: 'The selected staff member is not registered as a doctor.', code: 'STAFF_NOT_DOCTOR' });
    }

    const currentAssignment = emergencyCase.medicalSummary?.assignedDoctor;
    if (currentAssignment?.id === doctorUser.id || (
      currentAssignment?.email &&
      String(currentAssignment.email).toLowerCase() === doctorUser.email.toLowerCase()
    )) {
      return res.json({
        success: true,
        message: `Doctor ${currentAssignment.name || staffMember.name} is already assigned to this case.`,
        case: emergencyCase,
        assignedDoctor: currentAssignment,
      });
    }

    const isReassignment = Boolean(currentAssignment && (currentAssignment.id || currentAssignment.email));
    const assignedDoctor = {
      id: doctorUser.id,
      staffId: staffMember.id,
      name: staffMember.name || doctorName || 'Emergency Physician',
      role: staffMember.role || 'Emergency Physician',
      specialty: staffMember.specialty || specialty || 'Emergency Medicine',
      phone: staffMember.phone || hospital.phone,
      email: doctorUser.email,
      assignedAt: new Date().toISOString(),
      ...(isReassignment ? { reassignedFrom: currentAssignment.name || currentAssignment.email || currentAssignment.id } : {}),
    };

    const currentSummary = (typeof emergencyCase.medicalSummary === 'object' && emergencyCase.medicalSummary !== null)
      ? emergencyCase.medicalSummary
      : {};

    const updatedSummary = {
      ...currentSummary,
      assignedDoctor,
    };

    let updatedCase;
    try {
      updatedCase = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.emergencyCase.updateMany({
          where: {
            id: emergencyCase.id,
            hospitalId: hospital.id,
            status: emergencyCase.status,
          },
          data: {
            acceptedAt: emergencyCase.acceptedAt || new Date(),
            medicalSummary: updatedSummary,
          },
        });
        if (updateResult.count !== 1) {
          const error = new Error('Case ownership or status changed before the doctor assignment was saved.');
          error.status = 409;
          error.code = 'CASE_ASSIGNMENT_CONFLICT';
          throw error;
        }
        const result = await tx.emergencyCase.findUnique({
          where: { id: emergencyCase.id },
          include: {
            patient: { select: { id: true, userId: true, name: true } },
            hospital: { select: { id: true, name: true, address: true, phone: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: 'EMERGENCY_UPDATED',
            entity: 'EmergencyCase',
            entityId: result.id,
            details: {
              event: isReassignment ? 'EMERGENCY_REASSIGNED' : 'EMERGENCY_ASSIGNED',
              caseId: result.caseId,
              hospitalId: hospital.id,
              assignedDoctor,
              previousDoctor: currentAssignment || null,
              isReassignment,
              caseStatus: result.status,
            },
          },
        });
        return result;
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      throw error;
    }

    const { emitToUser, emitToHospital, emitToCaseRoom } = require('../utils/emergency.events');
    const eventPayload = {
      caseId: updatedCase.caseId,
      id: updatedCase.id,
      status: updatedCase.status,
      hospital: updatedCase.hospital,
      assignedDoctor,
      previousDoctor: currentAssignment || null,
      isReassignment,
      timestamp: new Date().toISOString(),
    };

    emitToCaseRoom(updatedCase.caseId, 'emergency_assigned', eventPayload);
    emitToCaseRoom(updatedCase.id, 'emergency_assigned', eventPayload);
    emitToHospital(hospital.id, 'emergency_assigned', eventPayload);
    emitToUser(doctorUser.id, 'emergency_assigned', eventPayload);
    if (updatedCase.patient?.userId) {
      emitToUser(updatedCase.patient.userId, 'emergency_assigned', eventPayload);
    }

    // Revoke previous doctor access immediately via realtime channel
    const prevDoctorUserId = currentAssignment?.id || (currentAssignment?.email
      ? (await prisma.user.findFirst({
        where: { email: { equals: currentAssignment.email, mode: 'insensitive' } },
        select: { id: true },
      }))?.id
      : null);

    if (prevDoctorUserId && prevDoctorUserId !== doctorUser.id) {
      emitToUser(prevDoctorUserId, 'emergency_assignment_revoked', {
        caseId: updatedCase.caseId,
        id: updatedCase.id,
        reason: 'Case reassigned to another physician by hospital administration',
        reassignedTo: assignedDoctor.name,
      });
    }

    return res.json({
      success: true,
      message: isReassignment
        ? `Reassigned case ${updatedCase.caseId} to Dr. ${assignedDoctor.name}`
        : `Assigned ${assignedDoctor.name} to case ${updatedCase.caseId}`,
      case: updatedCase,
      assignedDoctor,
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectCase = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (req.user.role !== 'HOSPITAL') {
      return res.status(403).json({ error: 'Only hospital accounts can reject an emergency case.', code: 'FORBIDDEN_ROLE' });
    }

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      return res.status(409).json({ error: 'Complete your hospital profile before performing actions.', code: 'PROFILE_INCOMPLETE' });
    }

    const caseIdParam = req.params.caseId;
    const { reason } = req.body || {};

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseIdParam }, { caseId: caseIdParam }] },
    });
    if (!emergencyCase) return res.status(404).json({ error: 'Case not found.', code: 'CASE_NOT_FOUND' });

    const idempotencyKey = getIdempotencyKey(req);
    const payloadHash = computePayloadHash(req.body);

    if (idempotencyKey) {
      const existingRecord = await prisma.hospitalIdempotencyRecord.findUnique({
        where: { operationId: idempotencyKey },
      });

      if (existingRecord) {
        if (
          existingRecord.actorUserId !== userId ||
          existingRecord.hospitalId !== hospital.id ||
          existingRecord.caseId !== emergencyCase.id ||
          existingRecord.actionType !== 'REJECT' ||
          existingRecord.payloadHash !== payloadHash
        ) {
          return res.status(400).json({
            error: 'Idempotency Key Payload Mismatch: Operation ID cannot be reused with a modified payload or different actor.',
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          });
        }

        const parsedBody = JSON.parse(existingRecord.responseBody);
        return res.status(existingRecord.responseStatus).json(parsedBody);
      }
    }

    const successResponse = { success: true, message: 'Case rejected: ' + (reason || 'No capacity'), code: 'SUCCESS' };

    await prisma.$transaction(async (tx) => {
      await tx.hospitalRequest.updateMany({
        where: { emergencyCaseId: emergencyCase.id, hospitalId: hospital.id },
        data: { status: 'REJECTED', rejectionReason: reason || 'Busy', respondedAt: new Date() },
      });

      if (idempotencyKey) {
        await tx.hospitalIdempotencyRecord.create({
          data: {
            operationId: idempotencyKey,
            actorUserId: userId,
            hospitalId: hospital.id,
            caseId: emergencyCase.id,
            actionType: 'REJECT',
            payloadHash,
            responseStatus: 200,
            responseBody: JSON.stringify(successResponse),
          },
        });
      }
    });

    res.json(successResponse);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message, code: error.code || 'CONFLICT' });
    }
    next(error);
  }
};

exports.getAllHospitals = async (req, res, next) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      where: {
        isVerified: true,
        emergencyAvailable: true,
        user: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        capabilities: true,
        location: true,
      },
    });

    res.json({ success: true, hospitals });
  } catch (error) {
    next(error);
  }
};

exports.getHospitalById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Hospital ID is required.' });
    }

    const hospital = await prisma.hospital.findFirst({
      where: {
        OR: [
          { id: id },
          { userId: id },
        ],
      },
      select: {
        id: true,
        userId: true,
        name: true,
        address: true,
        phone: true,
        email: true,
        city: true,
        state: true,
        capabilities: true,
        emergencyAvailable: true,
        isVerified: true,
        hasEmergencyDepartment: true,
        hasICU: true,
        hasTraumaUnit: true,
        hasCardiology: true,
        hasNeurology: true,
        hasAmbulance: true,
        location: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    const coords = coordinates(hospital.location) || { latitude: 28.6139, longitude: 77.2090 };

    res.json({
      success: true,
      hospital: {
        ...hospital,
        lat: coords.latitude,
        lng: coords.longitude,
        location: coords,
        availability: hospital.emergencyAvailable ? 'Available' : 'Limited',
        responseTimeMin: 12,
        bedsAvailable: 15,
        beds: 40,
        icuAvailable: 4,
        icuBeds: 10,
        ventilatorsAvailable: 2,
        ventilators: 5,
        rating: 4.8,
        specialists: ['Emergency Medicine', 'Trauma Specialist', 'Cardiologist', 'Neurologist'],
      },
    });
  } catch (error) {
    next(error);
  }
};

const getHospitalCases = async (req, res) => {
  try {
    // Get hospitalId from authenticated user
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true, name: true, location: true },
    });

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Find all emergency cases where this hospital has a request or is assigned
    const cases = await prisma.emergencyCase.findMany({
      where: {
        OR: [
          { hospitalId: hospital.id },  // Cases assigned to this hospital
          {
            hospitalRequests: {
              some: { hospitalId: hospital.id },  // Cases this hospital was requested for
            },
          },
        ],
      },
      include: {
        patient: {
          select: { name: true, age: true, gender: true, location: true },
        },
        hospital: {
          select: { id: true, name: true, location: true },
        },
        hospitalRequests: {
          where: { hospitalId: hospital.id },
          select: {
            id: true,
            status: true,
            distanceKm: true,
            requestedAt: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Format for the frontend
    const formatted = cases.map((c) => {
      const req = c.hospitalRequests[0];

      // Calculate distance if missing or 0
      let calcDistanceKm = req?.distanceKm;
      if (calcDistanceKm == null || Number(calcDistanceKm) === 0) {
        const pLoc = coordinates(c.location) || coordinates(c.patient?.location);
        const hLoc = coordinates(c.hospital?.location) || coordinates(hospital.location);
        if (pLoc && hLoc) {
          const dist = distanceInKilometres(pLoc, hLoc);
          if (dist > 0) {
            calcDistanceKm = Number(dist.toFixed(1));
          }
        }
      }

      const assignedHospital = c.hospital
        ? { id: c.hospital.id, name: c.hospital.name }
        : (hospital?.name ? { id: hospital.id, name: hospital.name } : null);

      return {
        id: c.id,
        caseId: c.caseId,
        patientName: c.patient?.name || null,
        age: c.patient?.age || null,
        gender: c.patient?.gender || null,
        symptoms: c.symptoms || null,
        severity: c.severity || null,
        emergencyType: c.emergencyType || null,
        status: c.status || req?.status || 'PENDING',
        hospital: assignedHospital,
        hospitalName: assignedHospital?.name || null,
        acceptedAt: c.acceptedAt || (c.status === 'ACCEPTED' || c.status === 'TREATMENT' || c.status === 'TRANSFER' ? c.updatedAt : null),
        distanceKm: calcDistanceKm && Number(calcDistanceKm) > 0 ? Number(calcDistanceKm) : null,
        // Expose workflow summary (assignedDoctor, diagnosisReport) so the
        // active-cases UI can render assignment/review/closure state.
        medicalSummary: c.medicalSummary || null,
        requestedAt: req?.requestedAt || c.createdAt,
        createdAt: c.createdAt,
      };
    });

    res.json({ cases: formatted });
  } catch (err) {
    console.error('[Hospital] getHospitalCases error:', err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

exports.getHospitalCases = getHospitalCases;

exports.getHospitalStats = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
    });

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital profile not found' });
    }

    const incomingCount = await prisma.hospitalRequest.count({
      where: { hospitalId: hospital.id, status: 'PENDING' },
    });

    const activeCasesCount = await prisma.emergencyCase.count({
      where: {
        hospitalId: hospital.id,
        status: { in: ['ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const acceptedCasesToday = await prisma.hospitalRequest.count({
      where: {
        hospitalId: hospital.id,
        status: 'ACCEPTED',
        respondedAt: { gte: startOfToday },
      },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const responded = await prisma.hospitalRequest.findMany({
      where: {
        hospitalId: hospital.id,
        requestedAt: { gte: sevenDaysAgo },
        respondedAt: { not: null },
        status: { in: ['ACCEPTED', 'REJECTED'] },
      },
      select: { requestedAt: true, respondedAt: true },
    });

    let avgResponseMin = 0;
    if (responded.length > 0) {
      const totalMs = responded.reduce((sum, r) =>
        sum + (new Date(r.respondedAt).getTime() - new Date(r.requestedAt).getTime()), 0);
      avgResponseMin = (totalMs / responded.length) / 60000;
      if (avgResponseMin > 60) avgResponseMin = 60;
    }

    const avgResponseTime = responded.length === 0
      ? '—'
      : avgResponseMin.toFixed(1) + ' min';

    const recentLogs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const capacity = hospitalCapacityStore.get(hospital.id) || {
      totalBeds: 100,
      availableBeds: 40,
      totalICU: 20,
      availableICU: 5,
      totalVentilators: 10,
      availableVentilators: 3,
    };

    res.json({
      success: true,
      stats: {
        incomingCount,
        activeCasesCount,
        acceptedCasesToday,
        totalBeds: capacity.totalBeds,
        availableBeds: capacity.availableBeds,
        totalICU: capacity.totalICU,
        availableICU: capacity.availableICU,
        totalVentilators: capacity.totalVentilators,
        availableVentilators: capacity.availableVentilators,
        avgResponseTime,
        recentActivity: recentLogs.map((l) => ({
          id: l.id,
          action: l.action,
          details: typeof l.details === 'string' ? l.details : JSON.stringify(l.details),
          createdAt: l.createdAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

const hospitalCapacityStore = new Map();

exports.getHospitalCapacity = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    const stored = hospitalCapacityStore.get(hospital.id) || {
      totalBeds: 100,
      availableBeds: 40,
      totalICU: 20,
      availableICU: 5,
      totalVentilators: 10,
      availableVentilators: 3,
    };

    res.json({
      success: true,
      capacity: {
        id: hospital.id,
        name: hospital.name,
        ...stored,
        updatedAt: stored.updatedAt || hospital.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateHospitalCapacity = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { availableBeds, totalBeds, availableICU, totalICU, availableVentilators, totalVentilators } = req.body;

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    if (
      (availableBeds != null && availableBeds < 0) ||
      (availableICU != null && availableICU < 0) ||
      (availableVentilators != null && availableVentilators < 0)
    ) {
      return res.status(400).json({ error: 'Available capacity cannot be negative.' });
    }

    const current = hospitalCapacityStore.get(hospital.id) || {
      totalBeds: 100,
      availableBeds: 40,
      totalICU: 20,
      availableICU: 5,
      totalVentilators: 10,
      availableVentilators: 3,
    };

    const updatedCapacity = {
      totalBeds: totalBeds !== undefined ? Math.max(0, Number(totalBeds)) : current.totalBeds,
      availableBeds: availableBeds !== undefined ? Math.max(0, Number(availableBeds)) : current.availableBeds,
      totalICU: totalICU !== undefined ? Math.max(0, Number(totalICU)) : current.totalICU,
      availableICU: availableICU !== undefined ? Math.max(0, Number(availableICU)) : current.availableICU,
      totalVentilators: totalVentilators !== undefined ? Math.max(0, Number(totalVentilators)) : current.totalVentilators,
      availableVentilators: availableVentilators !== undefined ? Math.max(0, Number(availableVentilators)) : current.availableVentilators,
      updatedAt: new Date(),
    };

    hospitalCapacityStore.set(hospital.id, updatedCapacity);

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        entity: 'Hospital',
        entityId: hospital.id,
        details: { event: 'CAPACITY_UPDATED', capacity: updatedCapacity },
      },
    });

    const { emitToHospital } = require('../utils/emergency.events');
    emitToHospital(userId, 'hospital:capacity-updated', {
      hospitalId: hospital.id,
      ...updatedCapacity,
    });

    res.json({
      success: true,
      message: 'Capacity updated successfully',
      capacity: {
        id: hospital.id,
        name: hospital.name,
        ...updatedCapacity,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getHospitalPatients = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { search = '', page = 1, limit = 20 } = req.query;

    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const patientCases = await prisma.emergencyCase.findMany({
      where: {
        OR: [
          { hospitalId: hospital.id },
          { hospitalRequests: { some: { hospitalId: hospital.id } } },
        ],
        patient: search ? { name: { contains: String(search), mode: 'insensitive' } } : undefined,
      },
      include: {
        patient: {
          select: { id: true, name: true, age: true, gender: true, bloodGroup: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: (Number(page) - 1) * Number(limit),
    });

    const patientMap = new Map();
    patientCases.forEach((c) => {
      if (c.patient && !patientMap.has(c.patient.id)) {
        patientMap.set(c.patient.id, {
          ...c.patient,
          lastCaseId: c.caseId,
          lastCaseStatus: c.status,
          lastCaseSeverity: c.severity,
          lastSeen: c.createdAt,
        });
      }
    });

    res.json({ success: true, patients: Array.from(patientMap.values()) });
  } catch (err) {
    next(err);
  }
};

exports.getHospitalNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    if (id === 'all') {
      await prisma.notification.updateMany({
        where: { userId, status: 'UNREAD' },
        data: { status: 'READ', readAt: new Date() },
      });
      return res.json({ success: true, message: 'All notifications marked read' });
    }

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { status: 'READ', readAt: new Date() },
    });
    res.json({ success: true, message: 'Notification marked read' });
  } catch (err) {
    next(err);
  }
};

exports.getHospitalReports = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    const severityGroups = await prisma.emergencyCase.groupBy({
      by: ['severity'],
      where: {
        OR: [
          { hospitalId: hospital.id },
          { hospitalRequests: { some: { hospitalId: hospital.id } } },
        ],
      },
      _count: { id: true },
    });

    const requestStatusGroups = await prisma.hospitalRequest.groupBy({
      by: ['status'],
      where: { hospitalId: hospital.id },
      _count: { id: true },
    });

    const totalRequests = requestStatusGroups.reduce((acc, g) => acc + g._count.id, 0);
    const acceptedCount = requestStatusGroups.find((g) => g.status === 'ACCEPTED')?._count.id || 0;
    const acceptanceRate = totalRequests > 0 ? Math.round((acceptedCount / totalRequests) * 100) : 0;

    res.json({
      success: true,
      reports: {
        totalRequests,
        acceptedCount,
        acceptanceRate,
        severityDistribution: severityGroups.map((g) => ({ severity: g.severity || 'OTHER', count: g._count.id })),
        requestStatusDistribution: requestStatusGroups.map((g) => ({ status: g.status, count: g._count.id })),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getHospitalProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        hospital: true,
      },
    });

    if (!user || !user.hospital) {
      return res.status(404).json({ error: 'Hospital profile not found' });
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { userId: user.id },
          { entityId: user.hospital.id },
          { entityId: user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const parseDetails = (log) => {
      if (!log || !log.details) return {};
      if (typeof log.details === 'string') {
        try { return JSON.parse(log.details); } catch { return {}; }
      }
      return log.details;
    };

    const parsedLogs = auditLogs.map((l) => ({ ...l, d: parseDetails(l) }));
    const rejLog = parsedLogs.find(
      (l) => l.entity === 'HospitalRejection' || l.d?.action === 'HOSPITAL_REJECTED' || l.d?.verificationStatus === 'REJECTED'
    );
    const submitLog = parsedLogs.find(
      (l) => l.d?.event === 'HOSPITAL_ONBOARDING_SUBMITTED' || l.d?.isFinalSubmit === true
    );

    let verificationStatus = 'PENDING_REVIEW';
    let rejectionReason = null;

    if (user.status === 'BLOCKED') {
      verificationStatus = 'BLOCKED';
    } else if (user.isVerified && user.hospital.isVerified) {
      verificationStatus = 'APPROVED';
    } else if (rejLog && (!submitLog || new Date(submitLog.createdAt).getTime() < new Date(rejLog.createdAt).getTime())) {
      verificationStatus = 'REJECTED';
      rejectionReason = rejLog.d?.reason || 'Document or detail updates required by Admin.';
    } else {
      verificationStatus = 'PENDING_REVIEW';
    }

    const capacity = hospitalCapacityStore.get(user.hospital.id) || null;

    res.json({
      success: true,
      hospital: {
        ...user.hospital,
        ...(capacity ? {
          totalBeds: capacity.totalBeds,
          availableBeds: capacity.availableBeds,
          totalICU: capacity.totalICU,
          availableICU: capacity.availableICU,
          totalVentilators: capacity.totalVentilators,
          availableVentilators: capacity.availableVentilators,
        } : {}),
        verificationStatus,
        rejectionReason,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateHospitalProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const {
      name,
      address,
      phone,
      email,
      city,
      state,
      pincode,
      capabilities,
      emergencyAvailable,
      hasEmergencyDepartment,
      hasICU,
      hasTraumaUnit,
      hasCardiology,
      hasNeurology,
      hasAmbulance,
      location,
      latitude,
      longitude,
      isFinalSubmit,
      idempotencyKey,
    } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { hospital: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    let hospital = user.hospital;
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: {
          userId: user.id,
          name: name || user.name || 'Hospital Facility',
          address: address || 'Address Pending',
          phone: phone || '0000000000',
          email: email || user.email,
          city: city || null,
          state: state || null,
          location: { latitude: Number(latitude) || 0, longitude: Number(longitude) || 0 },
        },
      });
    }

    // Validate location coordinates
    let locData = hospital.location;
    if (latitude !== undefined && longitude !== undefined && latitude !== '' && longitude !== '') {
      const latNum = Number(latitude);
      const lngNum = Number(longitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90 || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ error: 'Invalid latitude (-90 to 90) or longitude (-180 to 180) coordinates.' });
      }
      locData = { latitude: latNum, longitude: lngNum };
    } else if (location && typeof location === 'object') {
      const latNum = Number(location.latitude ?? location.lat);
      const lngNum = Number(location.longitude ?? location.lng);
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        locData = { latitude: latNum, longitude: lngNum };
      }
    }

    if (isFinalSubmit) {
      if (!name || !name.trim()) return res.status(400).json({ error: 'Official Hospital Name is required for submission.' });
      if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) return res.status(400).json({ error: 'Valid 10-digit Indian phone number is required.' });
      if (!address || !address.trim()) return res.status(400).json({ error: 'Complete hospital street address is required.' });
      if (!city || !city.trim()) return res.status(400).json({ error: 'City / District is required.' });
      if (!state || !state.trim()) return res.status(400).json({ error: 'State is required.' });

      const latVal = Number(locData?.latitude);
      const lngVal = Number(locData?.longitude);
      if (!Number.isFinite(latVal) || latVal < -90 || latVal > 90 || !Number.isFinite(lngVal) || lngVal < -180 || lngVal > 180 || (latVal === 0 && lngVal === 0)) {
        return res.status(400).json({ error: 'Valid GPS latitude and longitude coordinates are required for hospital submission.' });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedHospital = await tx.hospital.update({
        where: { id: hospital.id },
        data: {
          name: name ? name.trim() : hospital.name,
          address: address ? address.trim() : hospital.address,
          phone: phone ? phone.trim() : hospital.phone,
          email: email ? email.trim() : hospital.email,
          city: city !== undefined ? (city ? city.trim() : null) : hospital.city,
          state: state !== undefined ? (state ? state.trim() : null) : hospital.state,
          capabilities: Array.isArray(capabilities) ? capabilities : hospital.capabilities,
          emergencyAvailable: emergencyAvailable !== undefined ? Boolean(emergencyAvailable) : hospital.emergencyAvailable,
          hasEmergencyDepartment: hasEmergencyDepartment !== undefined ? Boolean(hasEmergencyDepartment) : hospital.hasEmergencyDepartment,
          hasICU: hasICU !== undefined ? Boolean(hasICU) : hospital.hasICU,
          hasTraumaUnit: hasTraumaUnit !== undefined ? Boolean(hasTraumaUnit) : hospital.hasTraumaUnit,
          hasCardiology: hasCardiology !== undefined ? Boolean(hasCardiology) : hospital.hasCardiology,
          hasNeurology: hasNeurology !== undefined ? Boolean(hasNeurology) : hospital.hasNeurology,
          hasAmbulance: hasAmbulance !== undefined ? Boolean(hasAmbulance) : hospital.hasAmbulance,
          location: locData,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PROFILE_UPDATED',
          entity: 'Hospital',
          entityId: hospital.id,
          endpoint: '/api/hospitals/profile',
          details: {
            event: isFinalSubmit ? 'HOSPITAL_ONBOARDING_SUBMITTED' : 'HOSPITAL_PROFILE_DRAFT_SAVED',
            isFinalSubmit: Boolean(isFinalSubmit),
            idempotencyKey: idempotencyKey || null,
          },
        },
      });

      return updatedHospital;
    });

    const message = isFinalSubmit
      ? 'Your hospital registration has been submitted successfully. Our verification team will review your details and documents.'
      : 'Hospital profile draft saved successfully.';

    res.json({
      success: true,
      message,
      hospital: updated,
      verificationStatus: updated.isVerified ? 'VERIFIED' : 'PENDING_REVIEW',
      onboardingStatus: isFinalSubmit ? 'SUBMITTED' : 'DRAFT',
    });
  } catch (err) {
    next(err);
  }
};

exports.submitHospitalOnboarding = async (req, res, next) => {
  req.body.isFinalSubmit = true;
  return exports.updateHospitalProfile(req, res, next);
};



exports.getHospitalSettings = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    res.json({
      success: true,
      settings: {
        autoAcceptLowSeverity: false,
        pushNotificationAlerts: true,
        smsAlertsCritical: true,
        emergencyAvailable: hospital.emergencyAvailable,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateHospitalSettings = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { emergencyAvailable } = req.body;

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    if (emergencyAvailable !== undefined) {
      await prisma.hospital.update({
        where: { id: hospital.id },
        data: { emergencyAvailable },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        entity: 'HospitalSettings',
        entityId: hospital.id,
        details: { event: 'SETTINGS_UPDATED', settings: req.body },
      },
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getHospitalDiagnostics = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true, isVerified: true, createdAt: true },
    });

    if (!user) return res.status(404).json({ success: false, error: 'User account not found' });

    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        isVerified: true,
        emergencyAvailable: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      diagnostics: {
        userId: user.id,
        email: user.email,
        databaseRole: user.role,
        accountStatus: user.status,
        userVerified: user.isVerified,
        hospitalProfileExists: Boolean(hospital),
        hospitalId: hospital?.id || null,
        hospitalName: hospital?.name || null,
        hospitalVerified: hospital?.isVerified || false,
        emergencyAvailable: hospital?.emergencyAvailable || false,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUnseenApprovalEvent = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const notification = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'SYSTEM',
        title: 'HOSPITAL_APPROVAL_EVENT',
        status: 'UNREAD',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!notification) {
      return res.json({ success: true, hasUnseenApproval: false });
    }

    res.json({
      success: true,
      hasUnseenApproval: true,
      eventId: notification.id,
      message: notification.message,
    });
  } catch (err) {
    next(err);
  }
};

exports.consumeApprovalEvent = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({ success: false, error: 'eventId parameter is required' });
    }

    await prisma.notification.updateMany({
      where: {
        id: eventId,
        userId,
        title: 'HOSPITAL_APPROVAL_EVENT',
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Approval event consumed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/hospitals/directory
 */
exports.getDirectory = async (req, res, next) => {
  try {
    const { HospitalDirectoryService } = require('../services/hospital-directory.service');
    const { page, limit, search, state, district, type, source, sort } = req.query;

    const result = await HospitalDirectoryService.getDirectory({
      page,
      limit,
      search,
      state,
      district,
      type,
      source,
      sort
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/hospitals/directory/filters
 */
exports.getDirectoryFilters = async (req, res, next) => {
  try {
    const { HospitalDirectoryService } = require('../services/hospital-directory.service');
    const { state } = req.query;
    const filters = await HospitalDirectoryService.getFilterOptions(state);

    return res.json({
      success: true,
      filters
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/hospitals/directory/:id
 */
exports.getDirectoryItemById = async (req, res, next) => {
  try {
    const { HospitalDirectoryService } = require('../services/hospital-directory.service');
    const { id } = req.params;

    const hospital = await HospitalDirectoryService.getDirectoryById(id);
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found in directory.' });
    }

    return res.json({
      success: true,
      hospital
    });
  } catch (err) {
    return next(err);
  }
};

async function ensureDefaultStaff(hospitalId) {
  try {
    const lead = await prisma.hospitalStaff.findFirst({
      where: {
        hospitalId,
        OR: [
          { name: 'Dr. Emergency Lead' },
          { staffId: 'STAFF-001' },
          { staffId: 'STAFF-DEFAULT-001' },
        ],
      },
    });

    if (!lead) {
      await prisma.hospitalStaff.create({
        data: {
          hospitalId,
          name: 'Dr. Emergency Lead',
          role: 'Emergency Physician',
          specialty: 'Emergency Medicine',
          department: 'Emergency Care',
          staffId: 'STAFF-001',
          phone: '+91 98765 43210',
          email: 'emergency.lead@caresetu.org',
          dutyStatus: 'ON_DUTY',
          clinicalRole: 'Emergency Care Lead',
          dutyResponsibilities: 'Handles emergency cases, performs initial patient assessment, stabilization, and coordinates urgent treatment.',
          isDefault: true,
          isActive: true,
        },
      });
    } else if (!lead.isActive) {
      await prisma.hospitalStaff.update({
        where: { id: lead.id },
        data: { isActive: true, isDefault: true, dutyStatus: 'ON_DUTY' },
      });
    }

    const specialist = await prisma.hospitalStaff.findFirst({
      where: {
        hospitalId,
        OR: [
          { name: 'Dr. Specialist' },
          { staffId: 'STAFF-002' },
          { staffId: 'STAFF-DEFAULT-002' },
        ],
      },
    });

    if (!specialist) {
      await prisma.hospitalStaff.create({
        data: {
          hospitalId,
          name: 'Dr. Specialist',
          role: 'General Physician',
          specialty: 'General Medicine',
          department: 'General OPD',
          staffId: 'STAFF-002',
          phone: '+91 98765 43211',
          email: 'specialist@caresetu.org',
          dutyStatus: 'ON_DUTY',
          clinicalRole: 'Consultant Specialist',
          dutyResponsibilities: 'Provides general OPD consultation, diagnostic review, specialist referrals, and inpatient rounding.',
          isDefault: true,
          isActive: true,
        },
      });
    } else if (!specialist.isActive) {
      await prisma.hospitalStaff.update({
        where: { id: specialist.id },
        data: { isActive: true, isDefault: true, dutyStatus: 'ON_DUTY' },
      });
    }
  } catch (e) {
    console.error('[ensureDefaultStaff] Error ensuring default staff:', e);
  }
}

/**
 * GET /api/hospitals/staff
 * Scoped strictly to authenticated hospital.
 */
exports.getHospitalStaff = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found.' });
    }

    // Ensure default staff members exist for this facility
    await ensureDefaultStaff(hospital.id);

    const { search = '', dutyStatus } = req.query;

    const whereClause = {
      hospitalId: hospital.id,
      isActive: true,
    };

    if (dutyStatus && String(dutyStatus).toUpperCase() !== 'ALL') {
      whereClause.dutyStatus = String(dutyStatus).toUpperCase();
    }

    if (search && String(search).trim() !== '') {
      const queryStr = String(search).trim();
      whereClause.OR = [
        { name: { contains: queryStr, mode: 'insensitive' } },
        { role: { contains: queryStr, mode: 'insensitive' } },
        { specialty: { contains: queryStr, mode: 'insensitive' } },
        { department: { contains: queryStr, mode: 'insensitive' } },
        { staffId: { contains: queryStr, mode: 'insensitive' } },
        { clinicalRole: { contains: queryStr, mode: 'insensitive' } },
        { dutyResponsibilities: { contains: queryStr, mode: 'insensitive' } },
      ];
    }

    const staffMembers = await prisma.hospitalStaff.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    const allActive = await prisma.hospitalStaff.findMany({
      where: { hospitalId: hospital.id, isActive: true },
      select: { dutyStatus: true },
    });

    const totalCount = allActive.length;
    const onDutyCount = allActive.filter((s) => s.dutyStatus === 'ON_DUTY').length;
    const offDutyCount = allActive.filter((s) => s.dutyStatus === 'OFF_DUTY').length;
    const onLeaveCount = allActive.filter((s) => s.dutyStatus === 'ON_LEAVE').length;

    return res.json({
      success: true,
      staff: staffMembers,
      counts: {
        total: totalCount,
        onDuty: onDutyCount,
        offDuty: offDutyCount,
        onLeave: onLeaveCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hospitals/staff
 * Scoped strictly to authenticated hospital.
 */
exports.createHospitalStaff = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true, name: true },
    });

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found.' });
    }

    const {
      name,
      role,
      specialty,
      department,
      staffId,
      phone,
      email,
      dutyStatus = 'OFF_DUTY',
      clinicalRole,
      dutyResponsibilities,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Full Name is required.' });
    }
    if (!role || !String(role).trim()) {
      return res.status(400).json({ success: false, error: 'Professional Role is required.' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

    if (staffId && String(staffId).trim()) {
      const existing = await prisma.hospitalStaff.findFirst({
        where: {
          hospitalId: hospital.id,
          staffId: String(staffId).trim(),
          isActive: true,
        },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Staff ID '${staffId}' is already assigned to another active staff member at this facility.`,
        });
      }
    }

    const formattedDutyStatus = ['ON_DUTY', 'OFF_DUTY', 'ON_LEAVE'].includes(String(dutyStatus).toUpperCase())
      ? String(dutyStatus).toUpperCase()
      : 'OFF_DUTY';

    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const isDoctorRole = Boolean(
      role &&
      /doctor|physician|specialist|surgeon|internist|cardiologist|pediatrician|neurologist|orthopedist|oncologist|consultant/i.test(String(role))
    );

    // Prevent duplicate active affiliation for this email at this facility
    if (normalizedEmail) {
      const existingEmailAffiliation = await prisma.hospitalStaff.findFirst({
        where: {
          hospitalId: hospital.id,
          email: normalizedEmail,
          isActive: true,
        },
      });
      if (existingEmailAffiliation) {
        return res.status(409).json({
          success: false,
          error: `A staff member with email "${normalizedEmail}" is already actively affiliated with this hospital facility.`,
          code: 'DUPLICATE_AFFILIATION',
        });
      }
    }

    let linkedUserId = null;
    let provisionedUser = null;
    let newStaff = null;

    if (normalizedEmail && isDoctorRole) {
      // 1. Check if user account already exists with this email
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        if (existingUser.role !== 'DOCTOR') {
          return res.status(409).json({
            success: false,
            error: `An account with email "${normalizedEmail}" already exists with role "${existingUser.role}". Incompatible accounts cannot be linked as hospital medical staff.`,
            code: 'INCOMPATIBLE_ACCOUNT_ROLE',
          });
        }

        // Check if existing doctor is already actively affiliated with this hospital
        const existingDocAffiliation = await prisma.hospitalStaff.findFirst({
          where: {
            hospitalId: hospital.id,
            userId: existingUser.id,
            isActive: true,
          },
        });
        if (existingDocAffiliation) {
          return res.status(409).json({
            success: false,
            error: `Doctor "${existingUser.name || normalizedEmail}" is already actively affiliated with this hospital facility.`,
            code: 'DUPLICATE_AFFILIATION',
          });
        }

        // Safely link existing active doctor (multi-hospital affiliation preserved; credentials untouched)
        linkedUserId = existingUser.id;
        provisionedUser = existingUser;
      } else {
        // Validate temporary password if provided for direct account creation
        const tempPassword = req.body.temporaryPassword || req.body.password;
        if (tempPassword) {
          if (typeof tempPassword !== 'string' || tempPassword.length < 8) {
            return res.status(400).json({
              success: false,
              error: 'Temporary password must be at least 8 characters long.',
              code: 'VALIDATION_ERROR',
            });
          }

          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(tempPassword, 12);

          // Atomic creation of user and staff record via transaction to prevent partial/orphan records
          const txResult = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
              data: {
                name: String(name).trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: 'DOCTOR',
                status: 'ACTIVE',
                isActivated: true,
                mustChangePassword: true,
                tokenVersion: 1,
              },
            });

            const createdStaff = await tx.hospitalStaff.create({
              data: {
                hospitalId: hospital.id,
                userId: createdUser.id,
                name: String(name).trim(),
                role: String(role).trim(),
                specialty: specialty ? String(specialty).trim() : null,
                department: department ? String(department).trim() : null,
                staffId: staffId ? String(staffId).trim() : null,
                phone: phone ? String(phone).trim() : null,
                email: normalizedEmail,
                dutyStatus: formattedDutyStatus,
                clinicalRole: clinicalRole ? String(clinicalRole).trim() : (isDoctorRole ? 'Physician' : null),
                dutyResponsibilities: dutyResponsibilities ? String(dutyResponsibilities).trim() : null,
                isActive: true,
              },
            });

            await tx.auditLog.create({
              data: {
                userId,
                action: 'REGISTER',
                entity: 'User',
                entityId: createdUser.id,
                details: {
                  event: 'DOCTOR_ACCOUNT_CREATED_VIA_STAFF',
                  hospitalId: hospital.id,
                  email: normalizedEmail,
                  mustChangePassword: true,
                },
              },
            });

            await tx.auditLog.create({
              data: {
                userId,
                action: 'PROFILE_UPDATED',
                entity: 'HospitalStaff',
                entityId: createdStaff.id,
                details: {
                  event: 'STAFF_ADDED',
                  staffName: createdStaff.name,
                  role: createdStaff.role,
                  accountLinked: true,
                },
              },
            });

            return { createdUser, createdStaff };
          });

          linkedUserId = txResult.createdUser.id;
          provisionedUser = txResult.createdUser;
          newStaff = txResult.createdStaff;
        }
      }
    }

    // If newStaff was not created inside the transaction above (e.g. non-doctor, existing doctor, or no temp password)
    if (!newStaff) {
      newStaff = await prisma.hospitalStaff.create({
        data: {
          hospitalId: hospital.id,
          userId: linkedUserId,
          name: String(name).trim(),
          role: String(role).trim(),
          specialty: specialty ? String(specialty).trim() : null,
          department: department ? String(department).trim() : null,
          staffId: staffId ? String(staffId).trim() : null,
          phone: phone ? String(phone).trim() : null,
          email: normalizedEmail,
          dutyStatus: formattedDutyStatus,
          clinicalRole: clinicalRole ? String(clinicalRole).trim() : (isDoctorRole ? 'Physician' : null),
          dutyResponsibilities: dutyResponsibilities ? String(dutyResponsibilities).trim() : null,
          isActive: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'PROFILE_UPDATED',
          entity: 'HospitalStaff',
          entityId: newStaff.id,
          details: {
            event: 'STAFF_ADDED',
            staffName: newStaff.name,
            role: newStaff.role,
            accountLinked: Boolean(linkedUserId),
          },
        },
      });
    }

    try {
      const { emitToHospital } = require('../utils/emergency.events');
      emitToHospital(userId, 'hospital:staff-updated', { action: 'CREATED', staff: newStaff });
    } catch (e) {
      // socket fail safe
    }

    let emailDelivery = null;
    if (provisionedUser && req.body.temporaryPassword) {
      try {
        const brevoProvider = require('../services/providers/brevo.provider');
        const { doctorTemporaryCredentialsEmail } = require('../services/templates/doctor-onboarding-email.templates');
        const emailContent = doctorTemporaryCredentialsEmail({
          doctorName: name,
          doctorEmail: normalizedEmail,
          hospitalName: hospital.name,
          department,
          role,
          temporaryPassword: req.body.temporaryPassword,
        });

        const mailRes = await brevoProvider.sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        emailDelivery = {
          attempted: true,
          delivered: Boolean(mailRes?.success),
          provider: 'brevo',
          deliveryState: mailRes?.deliveryState || (mailRes?.success ? 'ACCEPTED_BY_PROVIDER' : 'REJECTED_BY_PROVIDER'),
          messageId: mailRes?.messageId || null,
        };
      } catch (e) {
        emailDelivery = { attempted: true, delivered: false, provider: 'brevo', deliveryState: 'DISPATCH_ERROR', error: 'DISPATCH_ERROR' };
      }
    }

    return res.status(201).json({
      success: true,
      message: provisionedUser
        ? 'Staff member added and doctor login account linked successfully.'
        : 'Staff member added successfully.',
      staff: newStaff,
      accountLinked: Boolean(linkedUserId),
      mustChangePassword: provisionedUser ? Boolean(provisionedUser.mustChangePassword) : false,
      ...(emailDelivery ? { emailDelivery } : {}),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/hospitals/staff/:id
 * Scoped strictly to authenticated hospital.
 */
exports.updateHospitalStaff = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found.' });
    }

    const existingStaff = await prisma.hospitalStaff.findFirst({
      where: { id, hospitalId: hospital.id, isActive: true },
    });

    if (!existingStaff) {
      return res.status(404).json({ success: false, error: 'Staff member not found or unauthorized.' });
    }

    const {
      name,
      role,
      specialty,
      department,
      staffId,
      phone,
      email,
      dutyStatus,
      clinicalRole,
      dutyResponsibilities,
    } = req.body;

    if (name !== undefined && (!name || !String(name).trim())) {
      return res.status(400).json({ success: false, error: 'Full Name cannot be empty.' });
    }
    if (role !== undefined && (!role || !String(role).trim())) {
      return res.status(400).json({ success: false, error: 'Professional Role cannot be empty.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

    if (staffId && String(staffId).trim() !== existingStaff.staffId) {
      const duplicate = await prisma.hospitalStaff.findFirst({
        where: {
          hospitalId: hospital.id,
          staffId: String(staffId).trim(),
          id: { not: id },
          isActive: true,
        },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: `Staff ID '${staffId}' is already assigned to another staff member.`,
        });
      }
    }

    const updatedStaff = await prisma.hospitalStaff.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : existingStaff.name,
        role: role !== undefined ? String(role).trim() : existingStaff.role,
        specialty: specialty !== undefined ? (specialty ? String(specialty).trim() : null) : existingStaff.specialty,
        department: department !== undefined ? (department ? String(department).trim() : null) : existingStaff.department,
        staffId: staffId !== undefined ? (staffId ? String(staffId).trim() : null) : existingStaff.staffId,
        phone: phone !== undefined ? (phone ? String(phone).trim() : null) : existingStaff.phone,
        email: email !== undefined ? (email ? String(email).trim() : null) : existingStaff.email,
        dutyStatus: dutyStatus
          ? ['ON_DUTY', 'OFF_DUTY', 'ON_LEAVE'].includes(String(dutyStatus).toUpperCase())
            ? String(dutyStatus).toUpperCase()
            : existingStaff.dutyStatus
          : existingStaff.dutyStatus,
        clinicalRole: clinicalRole !== undefined
          ? (clinicalRole ? String(clinicalRole).trim() : null)
          : (existingStaff.clinicalRole || (/doctor|physician|specialist|surgeon|internist|cardiologist|pediatrician|neurologist|orthopedist|oncologist|consultant/i.test(role || existingStaff.role) ? 'Physician' : null)),
        dutyResponsibilities: dutyResponsibilities !== undefined ? (dutyResponsibilities ? String(dutyResponsibilities).trim() : null) : existingStaff.dutyResponsibilities,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        entity: 'HospitalStaff',
        entityId: updatedStaff.id,
        details: { event: 'STAFF_UPDATED', staffName: updatedStaff.name },
      },
    });

    try {
      const { emitToHospital } = require('../utils/emergency.events');
      emitToHospital(userId, 'hospital:staff-updated', { action: 'UPDATED', staff: updatedStaff });
    } catch (e) {
      // socket fail safe
    }

    return res.json({
      success: true,
      message: 'Staff member updated successfully.',
      staff: updatedStaff,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/hospitals/staff/:id
 * Soft deactivates staff to preserve historical medical logs.
 */
exports.deleteHospitalStaff = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found.' });
    }

    const existingStaff = await prisma.hospitalStaff.findFirst({
      where: { id, hospitalId: hospital.id, isActive: true },
    });

    if (!existingStaff) {
      return res.status(404).json({ success: false, error: 'Staff member not found or unauthorized.' });
    }

    if (existingStaff.isDefault || ['Dr. Emergency Lead', 'Dr. Specialist'].includes(existingStaff.name)) {
      return res.status(400).json({
        success: false,
        error: 'Default hospital staff members cannot be removed.',
      });
    }

    const deactivatedStaff = await prisma.hospitalStaff.update({
      where: { id },
      data: { isActive: false, dutyStatus: 'OFF_DUTY' },
    });

    // Case continuity check: flag active cases assigned to this staff member for reassignment
    const activeCases = await prisma.emergencyCase.findMany({
      where: {
        hospitalId: hospital.id,
        status: { in: ['ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS'] },
      },
      select: { id: true, caseId: true, medicalSummary: true },
    });

    const affectedCases = activeCases.filter((c) => {
      const doc = c.medicalSummary?.assignedDoctor;
      return doc && (doc.id === existingStaff.id || doc.id === existingStaff.userId || doc.email === existingStaff.email);
    });

    for (const c of affectedCases) {
      const updatedSummary = {
        ...(typeof c.medicalSummary === 'object' ? c.medicalSummary : {}),
        reassignmentNeeded: true,
        previousAssignedDoctor: c.medicalSummary?.assignedDoctor,
        assignedDoctor: null,
      };
      await prisma.emergencyCase.update({
        where: { id: c.id },
        data: { medicalSummary: updatedSummary },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        entity: 'HospitalStaff',
        entityId: id,
        details: { event: 'STAFF_DEACTIVATED', staffName: existingStaff.name, affectedCasesCount: affectedCases.length },
      },
    });

    try {
      const { emitToHospital } = require('../utils/emergency.events');
      emitToHospital(userId, 'hospital:staff-updated', { action: 'DEACTIVATED', staffId: id });
      if (affectedCases.length > 0) {
        emitToHospital(userId, 'hospital:case:reassignment-needed', {
          count: affectedCases.length,
          caseIds: affectedCases.map((c) => c.caseId),
        });
      }
    } catch (e) {
      // socket fail safe
    }

    // Revoke any active secure viewing sessions at this hospital
    try {
      await prisma.secureViewSession.updateMany({
        where: { hospitalId: hospital.id, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
    } catch (sessionErr) { }

    // Invalidate active session tokens if doctor has no other active hospital affiliations
    if (existingStaff.userId) {
      try {
        const otherActiveAffiliations = await prisma.hospitalStaff.count({
          where: {
            userId: existingStaff.userId,
            id: { not: existingStaff.id },
            isActive: true,
          },
        });
        if (otherActiveAffiliations === 0) {
          await prisma.user.update({
            where: { id: existingStaff.userId },
            data: { tokenVersion: { increment: 1 } },
          });
        }
      } catch (tokenErr) { }
    }

    return res.json({
      success: true,
      message: 'Staff member removed from the active roster.',
      staffId: id,
      reassignmentNeededCount: affectedCases.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/hospitals/staff/provision-doctor
 * Provisions a hospital doctor directly with temporary password credentials,
 * or falls back to an activation link workflow when no password is provided.
 */
exports.provisionHospitalDoctor = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital profile not found', code: 'HOSPITAL_NOT_FOUND' });
    }

    const {
      name,
      email,
      phone,
      role,
      department,
      staffId,
      clinicalRole,
      specialty,
      temporaryPassword,
      password,
    } = req.body || {};

    if (!name || !email) {
      return res.status(400).json({ error: 'Doctor name and email are required.', code: 'MISSING_FIELDS' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const tempPassword = temporaryPassword || password;

    // Check if staff member is already active at this facility
    const existingStaffMember = await prisma.hospitalStaff.findFirst({
      where: { hospitalId: hospital.id, email: normalizedEmail, isActive: true },
    });
    if (existingStaffMember) {
      return res.status(409).json({
        success: false,
        error: 'STAFF_ALREADY_EXISTS',
        message: `Doctor with email "${normalizedEmail}" is already an active staff member at your hospital.`,
      });
    }

    // Role & Account Validation: Check if an account already exists with this email
    let doctorUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (doctorUser && doctorUser.role !== 'DOCTOR') {
      return res.status(409).json({
        success: false,
        error: 'INCOMPATIBLE_ACCOUNT_ROLE',
        message: `An account with email "${normalizedEmail}" already exists with role "${doctorUser.role}". Incompatible accounts cannot be provisioned as hospital medical staff.`,
      });
    }

    const bcrypt = require('bcryptjs');

    // Case 1: Direct Provisioning with Temporary Password (No invitation token required)
    if (tempPassword) {
      if (typeof tempPassword !== 'string' || tempPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Temporary password must be at least 8 characters long.',
        });
      }

      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      if (!doctorUser) {
        doctorUser = await prisma.user.create({
          data: {
            name: String(name).trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: 'DOCTOR',
            status: 'ACTIVE',
            isActivated: true,
            mustChangePassword: true,
            tokenVersion: 1,
          },
        });
      } else {
        if (doctorUser.status === 'PENDING_ACTIVATION' || !doctorUser.isActivated) {
          doctorUser = await prisma.user.update({
            where: { id: doctorUser.id },
            data: {
              password: hashedPassword,
              status: 'ACTIVE',
              isActivated: true,
              mustChangePassword: true,
            },
          });
        }
      }

      const staffMember = await prisma.hospitalStaff.create({
        data: {
          hospitalId: hospital.id,
          userId: doctorUser.id,
          name: String(name).trim(),
          role: role ? String(role).trim() : 'Doctor',
          department: department ? String(department).trim() : null,
          staffId: staffId ? String(staffId).trim() : null,
          phone: phone ? String(phone).trim() : null,
          email: normalizedEmail,
          specialty: specialty ? String(specialty).trim() : null,
          clinicalRole: clinicalRole ? String(clinicalRole).trim() : 'Physician',
          dutyStatus: 'OFF_DUTY',
          isActive: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'REGISTER',
          entity: 'HospitalStaff',
          entityId: staffMember.id,
          details: {
            event: 'DOCTOR_PROVISIONED_DIRECT',
            doctorUserId: doctorUser.id,
            hospitalId: hospital.id,
            mustChangePassword: true,
          },
        },
      });

      try {
        const { emitToHospital } = require('../utils/emergency.events');
        emitToHospital(userId, 'hospital:staff-updated', { action: 'CREATED', staff: staffMember });
      } catch (e) { }

      let emailDelivery = { attempted: true, delivered: false, provider: 'brevo', deliveryState: 'UNCONFIGURED' };
      try {
        const brevoProvider = require('../services/providers/brevo.provider');
        const { doctorTemporaryCredentialsEmail } = require('../services/templates/doctor-onboarding-email.templates');
        const emailContent = doctorTemporaryCredentialsEmail({
          doctorName: name,
          doctorEmail: normalizedEmail,
          hospitalName: hospital.name,
          department,
          role,
          temporaryPassword: tempPassword,
        });

        const mailRes = await brevoProvider.sendEmail({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        emailDelivery = {
          attempted: true,
          delivered: Boolean(mailRes?.success),
          provider: 'brevo',
          deliveryState: mailRes?.deliveryState || (mailRes?.success ? 'ACCEPTED_BY_PROVIDER' : 'REJECTED_BY_PROVIDER'),
          messageId: mailRes?.messageId || null,
        };
      } catch (e) {
        emailDelivery = { attempted: true, delivered: false, provider: 'brevo', deliveryState: 'DISPATCH_ERROR', error: 'DISPATCH_ERROR' };
      }

      return res.status(201).json({
        success: true,
        message: 'Doctor account created directly. Doctor can sign in using their issued credentials and will be prompted to update their password.',
        staff: {
          id: staffMember.id,
          name: staffMember.name,
          email: staffMember.email,
          role: staffMember.role,
          department: staffMember.department,
          isActive: staffMember.isActive,
          hospitalId: hospital.id,
        },
        account: {
          id: doctorUser.id,
          email: doctorUser.email,
          status: doctorUser.status,
          mustChangePassword: doctorUser.mustChangePassword,
        },
        emailDelivery,
      });
    }

    // Case 2: Backward-compatible Invitation / Activation Token Flow (when no password provided)
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
    const lockedPassword = `*LOCKED*ACTIVATION_REQUIRED*${crypto.randomBytes(32).toString('hex')}`;

    if (!doctorUser) {
      doctorUser = await prisma.user.create({
        data: {
          name: String(name).trim(),
          email: normalizedEmail,
          password: lockedPassword,
          role: 'DOCTOR',
          status: 'PENDING_ACTIVATION',
          isActivated: false,
          mustChangePassword: true,
        },
      });
    }

    const staffMember = await prisma.hospitalStaff.create({
      data: {
        hospitalId: hospital.id,
        userId: doctorUser.id,
        name: String(name).trim(),
        role: role ? String(role).trim() : 'Doctor',
        department: department ? String(department).trim() : null,
        staffId: staffId ? String(staffId).trim() : null,
        phone: phone ? String(phone).trim() : null,
        email: normalizedEmail,
        specialty: specialty ? String(specialty).trim() : null,
        clinicalRole: clinicalRole ? String(clinicalRole).trim() : 'Physician',
        dutyStatus: 'OFF_DUTY',
        isActive: true,
      },
    });

    await prisma.doctorActivationToken.create({
      data: {
        userId: doctorUser.id,
        tokenHash,
        hospitalId: hospital.id,
        expiresAt,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'PROFILE_UPDATED',
        entity: 'HospitalStaff',
        entityId: staffMember.id,
        details: { event: 'DOCTOR_PROVISIONED', doctorUserId: doctorUser.id, hospitalId: hospital.id },
      },
    });

    let emailDispatched = false;
    let emailDelivery = { attempted: true, delivered: false, provider: 'brevo', deliveryState: 'UNCONFIGURED' };
    try {
      const brevoProvider = require('../services/providers/brevo.provider');
      const { doctorActivationLinkEmail } = require('../services/templates/doctor-onboarding-email.templates');
      const emailContent = doctorActivationLinkEmail({
        doctorName: name,
        doctorEmail: normalizedEmail,
        hospitalName: hospital.name,
        department,
        role,
        rawToken,
        expiresAt,
      });

      const mailRes = await brevoProvider.sendEmail({
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      emailDispatched = Boolean(mailRes?.success);
      emailDelivery = {
        attempted: true,
        delivered: emailDispatched,
        provider: 'brevo',
        deliveryState: mailRes?.deliveryState || (mailRes?.success ? 'ACCEPTED_BY_PROVIDER' : 'REJECTED_BY_PROVIDER'),
        messageId: mailRes?.messageId || null,
      };
    } catch (e) {
      emailDispatched = false;
      emailDelivery = { attempted: true, delivered: false, provider: 'brevo', deliveryState: 'DISPATCH_ERROR', error: 'DISPATCH_ERROR' };
    }

    return res.status(201).json({
      success: true,
      message: 'Doctor provisioned successfully.',
      staff: {
        id: staffMember.id,
        name: staffMember.name,
        email: staffMember.email,
        role: staffMember.role,
        department: staffMember.department,
        isActive: staffMember.isActive,
      },
      activation: {
        deliveryMethod: emailDispatched ? 'EMAIL' : 'MANUAL_DISPATCH_REQUIRED',
        activationUrl: `/activate-doctor?token=${rawToken}`,
        expiresAt,
      },
      emailDelivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/hospitals/diagnosis-reviews/pending
 * Retrieve emergency cases with diagnosis reports awaiting hospital review.
 */
exports.getPendingDiagnosisReviews = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    let hospitalId = req.user.hospitalId;

    if (!hospitalId && req.user.role === 'HOSPITAL') {
      const hospital = await prisma.hospital.findFirst({
        where: { OR: [{ userId }, { email: req.user.email }] },
        select: { id: true },
      });
      hospitalId = hospital?.id;
    }

    if (!hospitalId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Hospital identification required.', code: 'UNAUTHORIZED_HOSPITAL_SCOPE' });
    }

    const whereClause = {
      status: { in: ['ACCEPTED', 'TRANSFER', 'IN_PROGRESS', 'TREATMENT'] },
      ...(req.user.role === 'ADMIN' ? {} : { hospitalId }),
    };

    const cases = await prisma.emergencyCase.findMany({
      where: whereClause,
      include: {
        patient: { select: { id: true, name: true, age: true, gender: true } },
        hospital: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const pendingReviews = [];
    for (const c of cases) {
      const report = c.medicalSummary?.diagnosisReport;
      if (report && String(report.status).toUpperCase() === 'SUBMITTED_FOR_REVIEW') {
        pendingReviews.push({
          caseId: c.caseId,
          id: c.id,
          status: c.status,
          severity: c.severity,
          symptoms: c.symptoms,
          patient: c.patient,
          hospital: c.hospital,
          assignedDoctor: c.medicalSummary?.assignedDoctor || null,
          diagnosisReport: report,
          submittedAt: report.submittedAt || c.updatedAt,
        });
      }
    }

    return res.json({
      success: true,
      count: pendingReviews.length,
      pendingReviews,
    });
  } catch (error) {
    console.error('[HospitalController] getPendingDiagnosisReviews error:', error);
    next(error);
  }
};

/**
 * POST /api/hospitals/cases/:caseId/diagnosis/review
 * Hospital review decision (APPROVED or CHANGES_REQUESTED) on a submitted diagnosis.
 */
exports.reviewDiagnosisReport = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { decision, feedback, reviewNotes, expectedVersion } = req.body;

    const normalizedDecision = String(decision || '').toUpperCase();
    if (!['APPROVED', 'CHANGES_REQUESTED'].includes(normalizedDecision)) {
      return res.status(400).json({
        success: false,
        error: "Decision must be either 'APPROVED' or 'CHANGES_REQUESTED'.",
        code: 'INVALID_REVIEW_DECISION',
      });
    }

    const reviewFeedback = String(feedback || reviewNotes || '').trim();
    if (normalizedDecision === 'CHANGES_REQUESTED' && (!reviewFeedback || reviewFeedback.length < 5)) {
      return res.status(400).json({
        success: false,
        error: 'Feedback is required when requesting changes (minimum 5 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    const userId = req.user.userId || req.user.id;
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === 'HOSPITAL') {
      const hospital = await prisma.hospital.findFirst({
        where: { OR: [{ userId }, { email: req.user.email }] },
        select: { id: true },
      });
      hospitalId = hospital?.id;
    }

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseId }, { caseId }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found', code: 'CASE_NOT_FOUND' });
    }

    if (req.user.role !== 'ADMIN' && (!hospitalId || emergencyCase.hospitalId !== hospitalId)) {
      return res.status(403).json({
        success: false,
        error: 'Only authorized hospital staff belonging to this hospital may review diagnosis reports.',
        code: 'UNAUTHORIZED_HOSPITAL_SCOPE',
      });
    }

    if (['CLOSED', 'CANCELLED'].includes(String(emergencyCase.status).toUpperCase())) {
      return res.status(403).json({
        success: false,
        error: `Cannot review diagnosis for a ${emergencyCase.status} case.`,
        code: 'CASE_ALREADY_CLOSED',
      });
    }

    const currentSummary = (typeof emergencyCase.medicalSummary === 'object' && emergencyCase.medicalSummary !== null)
      ? emergencyCase.medicalSummary
      : {};
    const report = currentSummary.diagnosisReport;

    if (!report || String(report.status).toUpperCase() !== 'SUBMITTED_FOR_REVIEW') {
      return res.status(400).json({
        success: false,
        error: 'This case does not have a diagnosis report pending review.',
        code: 'NO_PENDING_DIAGNOSIS',
      });
    }

    if (expectedVersion !== undefined && expectedVersion !== null && report.version) {
      if (Number(expectedVersion) !== Number(report.version)) {
        return res.status(409).json({
          success: false,
          error: `Diagnosis review conflict: Report has been updated to version ${report.version}. You reviewed version ${expectedVersion}.`,
          code: 'REPORT_VERSION_CONFLICT',
          currentVersion: report.version,
        });
      }
    }

    const reviewerInfo = {
      id: userId,
      name: req.user.name || 'Hospital Reviewer',
      email: req.user.email,
      role: req.user.role,
      reviewedAt: new Date().toISOString(),
    };

    const reviewHistory = Array.isArray(report.reviewHistory) ? [...report.reviewHistory] : [];
    reviewHistory.push({
      decision: normalizedDecision,
      feedback: reviewFeedback || null,
      reviewedBy: reviewerInfo,
      reviewedAt: reviewerInfo.reviewedAt,
      version: report.version || 1,
    });

    const updatedReport = {
      ...report,
      status: normalizedDecision,
      reviewedAt: reviewerInfo.reviewedAt,
      reviewedBy: reviewerInfo,
      reviewFeedback: reviewFeedback || null,
      reviewHistory,
    };

    const updatedSummary = {
      ...currentSummary,
      diagnosisReport: updatedReport,
    };

    let updatedCase;
    try {
      updatedCase = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.emergencyCase.updateMany({
          where: { id: emergencyCase.id, status: emergencyCase.status },
          data: { medicalSummary: updatedSummary },
        });
        if (updateResult.count !== 1) {
          const error = new Error('Case status or ownership changed before diagnosis review could be applied.');
          error.status = 409;
          error.code = 'CASE_STATUS_CONFLICT';
          throw error;
        }
        const result = await tx.emergencyCase.findUnique({
          where: { id: emergencyCase.id },
          include: {
            patient: { select: { id: true, userId: true, name: true } },
            hospital: { select: { id: true, name: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: 'EMERGENCY_UPDATED',
            entity: 'EmergencyCase',
            entityId: result.id,
            details: {
              event: 'DIAGNOSIS_REVIEWED',
              decision: normalizedDecision,
              caseId: result.caseId,
              version: report.version,
            },
          },
        });
        return result;
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message, code: error.code });
      }
      throw error;
    }

    const { emitToHospital, emitToCaseRoom, emitToUser } = require('../utils/emergency.events');
    const eventPayload = {
      caseId: updatedCase.caseId,
      id: updatedCase.id,
      decision: normalizedDecision,
      feedback: reviewFeedback || null,
      diagnosisReport: updatedReport,
      timestamp: new Date().toISOString(),
    };

    if (updatedCase.hospitalId) {
      emitToHospital(updatedCase.hospitalId, 'diagnosis_reviewed', eventPayload);
    }
    emitToCaseRoom(updatedCase.caseId, 'diagnosis_reviewed', eventPayload);
    emitToCaseRoom(updatedCase.id, 'diagnosis_reviewed', eventPayload);

    const assignedDoctorId = updatedSummary.assignedDoctor?.id;
    if (assignedDoctorId) {
      emitToUser(assignedDoctorId, 'diagnosis_reviewed', eventPayload);
    }

    return res.json({
      success: true,
      message: normalizedDecision === 'APPROVED'
        ? 'Diagnosis report approved successfully.'
        : 'Changes requested on diagnosis report.',
      decision: normalizedDecision,
      diagnosisReport: updatedReport,
    });
  } catch (error) {
    console.error('[HospitalController] reviewDiagnosisReport error:', error);
    next(error);
  }
};

/**
 * POST /api/hospitals/cases/:caseId/close
 * Hospital-authorized case closure endpoint.
 * Requires: Hospital staff (or ADMIN), TREATMENT status, and APPROVED diagnosis report.
 */
exports.closeHospitalEmergencyCase = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    // Defensive: clients may call this endpoint with no JSON body at all
    // (req.body undefined). Missing closureNotes is acceptable; a crash is not.
    const { closureNotes } = req.body || {};
    const userId = req.user.userId || req.user.id;

    let hospitalId = req.user.hospitalId;
    if (!hospitalId && req.user.role === 'HOSPITAL') {
      const hospital = await prisma.hospital.findFirst({
        where: { OR: [{ userId }, { email: req.user.email }] },
        select: { id: true },
      });
      hospitalId = hospital?.id;
    }

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseId }, { caseId }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found', code: 'CASE_NOT_FOUND' });
    }

    if (req.user.role !== 'ADMIN' && (!hospitalId || emergencyCase.hospitalId !== hospitalId)) {
      return res.status(403).json({
        success: false,
        error: 'Only authorized hospital staff belonging to this hospital may close this case.',
        code: 'UNAUTHORIZED_HOSPITAL_SCOPE',
      });
    }

    if (String(emergencyCase.status).toUpperCase() === 'CLOSED') {
      return res.json({
        success: true,
        message: 'Case is already closed.',
        case: emergencyCase,
      });
    }

    if (String(emergencyCase.status).toUpperCase() !== 'TREATMENT') {
      return res.status(400).json({
        success: false,
        error: `Cannot close case from ${emergencyCase.status} stage. Case must be in TREATMENT stage before closure.`,
        code: 'INVALID_CASE_TRANSITION',
      });
    }

    const { isCaseEligibleForClosure } = require('../utils/case-workflow');
    if (!isCaseEligibleForClosure(emergencyCase)) {
      const diagStatus = emergencyCase.medicalSummary?.diagnosisReport?.status;
      return res.status(422).json({
        success: false,
        error: `Cannot close case: An approved diagnosis report is required before hospital case closure. Current diagnosis status: ${diagStatus || 'NONE'}.`,
        code: 'DIAGNOSIS_NOT_APPROVED',
      });
    }

    const closedAt = new Date();
    const currentSummary = (typeof emergencyCase.medicalSummary === 'object' && emergencyCase.medicalSummary !== null)
      ? emergencyCase.medicalSummary
      : {};

    const updatedSummary = {
      ...currentSummary,
      closedBy: {
        id: userId,
        name: req.user.name || 'Hospital Administration',
        email: req.user.email,
        role: req.user.role,
        closedAt: closedAt.toISOString(),
        notes: closureNotes || null,
      },
    };

    let updatedCase;
    try {
      updatedCase = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.emergencyCase.updateMany({
          where: { id: emergencyCase.id, status: emergencyCase.status },
          data: {
            status: 'CLOSED',
            closedAt,
            medicalSummary: updatedSummary,
          },
        });
        if (updateResult.count !== 1) {
          const error = new Error('Case status changed before closure could be applied.');
          error.status = 409;
          error.code = 'CASE_STATUS_CONFLICT';
          throw error;
        }
        const result = await tx.emergencyCase.findUnique({
          where: { id: emergencyCase.id },
          include: {
            patient: { select: { id: true, userId: true, name: true } },
            hospital: { select: { id: true, name: true, address: true, phone: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: 'EMERGENCY_CLOSED',
            entity: 'EmergencyCase',
            entityId: result.id,
            details: {
              caseId: result.caseId,
              previousStatus: emergencyCase.status,
              newStatus: 'CLOSED',
              closedBy: req.user.email,
            },
          },
        });
        return result;
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message, code: error.code });
      }
      throw error;
    }

    const { emitToHospital, emitToCaseRoom, emitToUser } = require('../utils/emergency.events');
    const eventPayload = {
      caseId: updatedCase.caseId,
      id: updatedCase.id,
      status: 'CLOSED',
      closedAt: closedAt.toISOString(),
      hospital: updatedCase.hospital,
      timestamp: closedAt.toISOString(),
    };

    if (updatedCase.hospitalId) {
      emitToHospital(updatedCase.hospitalId, 'emergency_status_updated', eventPayload);
      emitToHospital(updatedCase.hospitalId, 'emergency_case_closed', eventPayload);
    }
    emitToCaseRoom(updatedCase.caseId, 'emergency_status_updated', eventPayload);
    emitToCaseRoom(updatedCase.id, 'emergency_status_updated', eventPayload);
    emitToCaseRoom(updatedCase.caseId, 'emergency_case_closed', eventPayload);

    if (updatedCase.patient?.userId) {
      emitToUser(updatedCase.patient.userId, 'emergency_status_updated', eventPayload);
    }

    const assignedDoctorId = updatedSummary.assignedDoctor?.id;
    if (assignedDoctorId) {
      emitToUser(assignedDoctorId, 'emergency_status_updated', eventPayload);
      emitToUser(assignedDoctorId, 'emergency_case_closed', eventPayload);
    }

    return res.json({
      success: true,
      message: 'Emergency case closed successfully.',
      case: updatedCase,
    });
  } catch (error) {
    console.error('[HospitalController] closeHospitalEmergencyCase error:', error);
    next(error);
  }
};


