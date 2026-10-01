const { z } = require('zod');
const prisma = require('../config/prisma');
const emergencyService = require('../services/emergency.service');
const notificationService = require('../services/notification.service');
const healthPackService = require('../services/health-pack.service');
const { emitToUser, emitToHospital, emitToCaseRoom } = require('../utils/emergency.events');

const sosSchema = z.object({
  symptoms: z.string().trim().optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  emergencyType: z.string().optional(),
  severity: z.enum(['CRITICAL', 'URGENT', 'STABLE']).optional(),
  idempotencyKey: z.string().optional(),
  source: z.string().optional(),
});

async function getOwnedCase(caseId, user) {
  let hospitalId = user.hospitalId;
  if (user.role === 'HOSPITAL' && !hospitalId) {
    const h = await prisma.hospital.findUnique({
      where: { userId: user.userId || user.id },
      select: { id: true },
    });
    hospitalId = h?.id;
  }

  const emergencyCase = await prisma.emergencyCase.findFirst({
    where: {
      OR: [{ caseId: caseId }, { id: caseId }],
    },
    include: {
      patient: { select: { userId: true, name: true, age: true, gender: true, phone: true } },
      hospital: { select: { userId: true, id: true, name: true, address: true, phone: true } },
      hospitalRequests: {
        where: hospitalId ? { hospitalId: hospitalId } : undefined,
      },
    },
  });

  if (!emergencyCase) return null;

  const role = user.role;
  const userId = user.userId || user.id;

  let authorized = false;

  if (role === 'ADMIN') {
    authorized = true;
  } else if (role === 'PATIENT' || role === 'GUEST') {
    authorized = emergencyCase.patient?.userId === userId;
  } else if (role === 'HOSPITAL') {
    const isAssigned = (hospitalId && emergencyCase.hospitalId === hospitalId) || (emergencyCase.hospital?.userId === userId);
    const hasRequest = (emergencyCase.hospitalRequests || []).some((r) => r.hospitalId === hospitalId);
    authorized = isAssigned || hasRequest;
  }

  if (!authorized) {
    console.log('[Case Detail] ❌ Unauthorized:', { role, userId, hospitalId, caseId });
    const error = new Error('You do not have access to this emergency case.');
    error.status = 403;
    throw error;
  }

  return emergencyCase;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lon1 - lon2, 2)) * 111;
}

async function detectRepeatedSOS(userId) {
  try {
    const windowMinutes = 10;
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recent = await prisma.emergencyCase.count({
      where: {
        patient: { userId },
        createdAt: { gte: since },
      },
    });
    if (recent >= 2) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SOS_TRIGGERED',
          entity: 'EmergencyCase',
          details: {
            abuseFlag: true,
            reason: 'REPEATED_SOS',
            recentCount: recent,
            windowMinutes,
          },
        },
      });
      console.warn('[AbuseMonitor] Repeated SOS flagged for user ' + userId + ': ' + recent + ' in ' + windowMinutes + 'm');
    }
  } catch (e) {
    console.warn('[AbuseMonitor] detection failed (non-blocking):', e.message);
  }
}

// 1. Create emergency case (SOS) and match hospitals
exports.createSOS = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.location && typeof payload.location === 'object') {
      if (payload.location.latitude !== undefined) payload.latitude = payload.location.latitude;
      if (payload.location.longitude !== undefined) payload.longitude = payload.location.longitude;
    }
    const { symptoms, latitude, longitude, emergencyType, severity, idempotencyKey, source } = sosSchema.parse(payload);

    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User authentication is required.' });
    }

    void detectRepeatedSOS(userId);

    // Fetch patient profile from Prisma model using req.user.id to retrieve blood_group and medical_conditions
    const patientProfile = await prisma.patient.findUnique({
      where: { userId },
      select: { bloodGroup: true, medicalConditions: true, conditions: true },
    }).catch(() => null);

    const bloodGroup = patientProfile?.bloodGroup ? String(patientProfile.bloodGroup).trim() : null;
    const knownConditions = (patientProfile?.medicalConditions ? String(patientProfile.medicalConditions).trim() : null) ||
      (patientProfile?.conditions ? String(patientProfile.conditions).trim() : null) ||
      null;

    const result = await emergencyService.createEmergencyCase({
      userId,
      symptoms,
      latitude,
      longitude,
      emergencyType,
      severity,
      idempotencyKey,
      source,
      patientMedicalHistory: {
        bloodGroup,
        knownConditions,
        blood_group: bloodGroup || 'Not provided',
        medical_conditions: knownConditions || 'Not provided',
      },
    });

    res.status(201).json({
      success: true,
      caseId: result.emergencyCase.id,
      publicCaseId: result.emergencyCase.caseId,
      message: 'Emergency case created successfully',
      emergencyCase: {
        id: result.emergencyCase.id,
        caseId: result.emergencyCase.caseId,
        symptoms: result.emergencyCase.symptoms,
        status: result.emergencyCase.status,
        stage: emergencyService.statusToStage(result.emergencyCase.status),
        severity: result.emergencyCase.severity,
        emergencyType: result.emergencyCase.emergencyType,
        location: result.emergencyCase.location
          ? {
            latitude: Number(result.emergencyCase.location.latitude),
            longitude: Number(result.emergencyCase.location.longitude),
          }
          : null,
        createdAt: result.emergencyCase.createdAt,
        acceptedAt: result.emergencyCase.acceptedAt,
        closedAt: result.emergencyCase.closedAt,
      },
      nearestHospitals: result.nearestHospitals,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get SOS Status
exports.getSOSStatus = async (req, res, next) => {
  try {
    const emergencyCase = await getOwnedCase(req.params.caseId, req.user);
    if (!emergencyCase) return res.status(404).json({ error: 'Case not found.' });

    const hospitalRequests = await prisma.hospitalRequest.findMany({
      where: { emergencyCaseId: emergencyCase.id },
      include: {
        hospital: {
          select: { id: true, name: true, address: true, phone: true, capabilities: true },
        },
      },
      orderBy: { requestedAt: 'asc' },
    }).catch(() => []);

    const attempts = (hospitalRequests || []).map(hr => ({
      hospital: {
        id: hr.hospital.id,
        name: hr.hospital.name,
        address: hr.hospital.address,
        phone: hr.hospital.phone,
        distanceKm: hr.distanceKm,
        capabilities: hr.hospital.capabilities || [],
      },
      status: hr.status,
      distanceKm: hr.distanceKm,
      requestedAt: hr.requestedAt,
      respondedAt: hr.respondedAt,
      rejectionReason: hr.rejectionReason,
    }));

    res.json({
      success: true,
      case: {
        id: emergencyCase.id,
        caseId: emergencyCase.caseId,
        status: emergencyCase.status,
        stage: emergencyService.statusToStage(emergencyCase.status),
        symptoms: emergencyCase.symptoms,
        severity: emergencyCase.severity,
        emergencyType: emergencyCase.emergencyType,
        location: emergencyCase.location
          ? {
            latitude: Number(emergencyCase.location.latitude),
            longitude: Number(emergencyCase.location.longitude),
          }
          : null,
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
      },
    });
  } catch (error) {
    next(error);
  }
};

// 2b. Get Attempts
exports.getAttempts = async (req, res, next) => {
  try {
    const { caseId } = req.params;

    // Ownership/isolation gate: throws 403 for unauthorized callers,
    // returns null (-> 404) for missing case. Same rule as status read.
    const owned = await getOwnedCase(caseId, req.user);
    if (!owned) return res.status(404).json({ error: "Case not found" });

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: {
        OR: [{ caseId }, { id: caseId }],
      },
      include: {
        hospitalRequests: {
          include: {
            hospital: {
              select: { id: true, name: true, address: true, phone: true, capabilities: true }
            }
          },
          orderBy: { requestedAt: "asc" },
        }
      }
    });

    if (!emergencyCase) return res.status(404).json({ error: "Case not found" });

    const attempts = (emergencyCase.hospitalRequests || []).map(hr => ({
      hospital: {
        id: hr.hospital.id,
        name: hr.hospital.name,
        address: hr.hospital.address,
        phone: hr.hospital.phone,
        distanceKm: hr.distanceKm,
        capabilities: hr.hospital.capabilities || [],
      },
      status: hr.status,
      distanceKm: hr.distanceKm,
      requestedAt: hr.requestedAt,
      respondedAt: hr.respondedAt,
      rejectionReason: hr.rejectionReason,
    }));

    res.json({ success: true, attempts });
  } catch (err) {
    console.error("[Attempts]", err);
    next(err);
  }
};

// 3. Get my emergency cases
exports.getMyEmergencies = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.userId } });
    if (!patient) return res.json({ cases: [] });

    const cases = await prisma.emergencyCase.findMany({
      where: { patientId: patient.id },
      include: {
        hospital: {
          select: { id: true, name: true, phone: true, address: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      cases: cases.map(c => ({
        id: c.id,
        caseId: c.caseId,
        symptoms: c.symptoms,
        status: c.status,
        severity: c.severity,
        hospital: c.hospital,
        createdAt: c.createdAt,
        acceptedAt: c.acceptedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// 4. Cancel SOS
exports.cancelSOS = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.userId || req.user.id;

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: {
        OR: [
          { id: caseId },
          { caseId: caseId },
        ],
        patient: { userId },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const ageMs = Date.now() - new Date(emergencyCase.createdAt).getTime();
    if (ageMs > 60000) {
      return res.status(400).json({ error: 'Too late to cancel (>60s)' });
    }

    // Cancel is only allowed while the case is still searchable (no hospital
    // assigned yet). Once accepted/transferred/past-search the case must run its
    // documented lifecycle (acceptEmergency -> updateEmergencyStatus). The 60s
    // restriction above remains intact and still applies to searchable cases.
    const searchableStatuses = ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED', 'CREATED', 'LOCATED', 'ANALYSED', 'SEARCHING'];
    if (emergencyCase.hospitalId || !searchableStatuses.includes(emergencyCase.status)) {
      return res.status(400).json({ error: 'Cannot cancel: a hospital has already been assigned or the case is no longer searchable.' });
    }

    await prisma.$transaction([
      prisma.emergencyCase.update({
        where: { id: emergencyCase.id },
        data: { status: 'CANCELLED', closedAt: new Date() },
      }),
      prisma.hospitalRequest.updateMany({
        where: { emergencyCaseId: emergencyCase.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'EMERGENCY_CLOSED',
          entity: 'EmergencyCase',
          entityId: emergencyCase.id,
          details: { reason: 'User undo', caseId },
        },
      }),
    ]);

    res.json({ success: true, message: 'Emergency cancelled' });
  } catch (err) {
    console.error('[Cancel]', err);
    res.status(500).json({ error: 'Failed to cancel case' });
  }
};
exports.cancelEmergency = exports.cancelSOS;

// 5. Get pending emergencies near hospital
exports.getPendingEmergencies = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;
    let hospitalLat = parseFloat(latitude);
    let hospitalLng = parseFloat(longitude);
    const searchRadius = parseFloat(radius);

    if (!latitude || !longitude) {
      if (req.user && req.user.role === 'HOSPITAL') {
        const hospital = await prisma.hospital.findUnique({ where: { userId: req.user.userId } });
        if (hospital && hospital.location) {
          hospitalLat = hospital.location.latitude;
          hospitalLng = hospital.location.longitude;
        } else {
          return res.status(400).json({ error: 'Hospital location not found' });
        }
      } else {
        return res.status(400).json({ error: 'latitude and longitude are required parameters' });
      }
    }

    const cases = await prisma.emergencyCase.findMany({
      where: { status: 'PENDING' },
      include: {
        patient: { select: { name: true, phone: true, age: true, gender: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const casesWithDistance = cases
      .map(c => {
        const cLocation = c.location || {};
        const dist = calculateDistance(hospitalLat, hospitalLng, cLocation.latitude, cLocation.longitude);
        return {
          id: c.id,
          caseId: c.caseId,
          symptoms: c.symptoms,
          status: c.status,
          severity: c.severity,
          patient: c.patient,
          distance: dist,
          createdAt: c.createdAt,
        };
      })
      .filter(c => c.distance <= searchRadius)
      .sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      cases: casesWithDistance,
      count: casesWithDistance.length,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Accept emergency case (Hospital Action)
exports.acceptEmergency = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.userId || req.user.id;

    // Fetch user and linked hospital profile
    const hospital = await prisma.hospital.findFirst({
      where: { userId },
      include: { user: true },
    });

    if (!hospital) {
      return res.status(403).json({ error: 'Hospital profile not found' });
    }

    // Role & Verification Status check: Hospital must be ACTIVE & APPROVED by Admin
    if (hospital.user.status === 'BLOCKED') {
      return res.status(403).json({ error: 'Hospital account is suspended or blocked.' });
    }

    if (!hospital.isVerified || hospital.user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Hospital is not verified or active. Verification by Admin is required before accepting emergencies.' });
    }

    const hospitalId = hospital.id;

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: {
        OR: [{ caseId }, { id: caseId }],
      },
      include: {
        patient: { select: { userId: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ error: 'Emergency case not found.' });
    }

    if (emergencyCase.hospitalId && emergencyCase.hospitalId !== hospitalId) {
      return res.status(409).json({ error: 'This emergency case has already been accepted by another hospital.' });
    }

    const hospitalRequest = await prisma.hospitalRequest.findFirst({
      where: {
        emergencyCaseId: emergencyCase.id,
        hospitalId,
      },
    });

    if (!hospitalRequest) {
      return res.status(403).json({ error: 'No request assigned to this hospital for this emergency case.' });
    }

    if (hospitalRequest.status === 'ACCEPTED') {
      return res.json({ success: true, message: 'Already accepted by your hospital.' });
    }

    if (hospitalRequest.status !== 'PENDING') {
      return res.status(409).json({
        error: 'This emergency case has already been accepted or is no longer available.',
      });
    }

    const otherPendingRequests = await prisma.hospitalRequest.findMany({
      where: {
        emergencyCaseId: emergencyCase.id,
        hospitalId: { not: hospitalId },
        status: 'PENDING',
      },
      include: {
        hospital: { select: { id: true, userId: true, name: true } },
      },
    });

    // Atomic concurrency update: ensuring status is still PENDING at update time
    const [updateReqResult] = await prisma.$transaction([
      prisma.hospitalRequest.updateMany({
        where: { id: hospitalRequest.id, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      }),
      prisma.hospitalRequest.updateMany({
        where: {
          emergencyCaseId: emergencyCase.id,
          hospitalId: { not: hospitalId },
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          rejectionReason: 'ACCEPTED_BY_ANOTHER_HOSPITAL',
          respondedAt: new Date(),
        },
      }),
      prisma.emergencyCase.updateMany({
        where: { id: emergencyCase.id, hospitalId: null },
        data: {
          hospitalId,
          status: 'TRANSFER',
          acceptedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'HOSPITAL_ACCEPTED',
          entity: 'EmergencyCase',
          entityId: emergencyCase.id,
          details: { caseId: emergencyCase.caseId, hospitalId },
        },
      }),
      ...(emergencyCase.patient?.userId
        ? [
          prisma.notification.create({
            data: {
              userId: emergencyCase.patient.userId,
              type: 'HOSPITAL_ACCEPTED',
              title: 'Hospital Assigned',
              message: 'A hospital has accepted your emergency request.',
              data: { caseId: emergencyCase.caseId, hospitalId },
            },
          }),
        ]
        : []),
    ]);

    if (updateReqResult.count === 0) {
      return res.status(409).json({
        error: 'This emergency case has already been accepted or is no longer available.',
      });
    }

    // Automatically share the patient's HealthPack with the accepting hospital.
    // Reuses HealthPackService (ensures an ACTIVE pack exists; idempotent on retry).
    try {
      await healthPackService.shareHealthPackWithHospital(emergencyCase.patientId, hospitalId, userId);
      console.log(`[P1 feature] HealthPack shared with accepting hospital ${hospitalId}`);
    } catch (hpErr) {
      console.warn('[Accept] HealthPack auto-share failed:', hpErr.message);
    }

    emitToHospital(userId, 'case:assigned-to-us', {
      caseId: emergencyCase.caseId,
      emergencyCaseId: emergencyCase.id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    });
    emitToHospital(userId, 'emergency:accepted', {
      caseId: emergencyCase.caseId,
      status: 'ACCEPTED',
    });

    otherPendingRequests.forEach((reqItem) => {
      const targetUserId = reqItem.hospital?.userId;
      if (targetUserId) {
        emitToHospital(targetUserId, 'case:closed-elsewhere', {
          caseId: emergencyCase.caseId,
          emergencyCaseId: emergencyCase.id,
          assignedToOther: true,
          status: 'REJECTED',
          reason: 'Assigned to another hospital',
        });
        emitToHospital(targetUserId, 'emergency:request-updated', {
          caseId: emergencyCase.caseId,
          status: 'REJECTED',
          reason: 'Assigned to another hospital',
        });
      }
    });

    const acceptingHospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true, name: true, address: true, phone: true },
    });

    const hospitalObj = acceptingHospital || { id: hospitalId, name: 'Hospital', address: '', phone: '' };

    if (emergencyCase.patient?.userId) {
      emitToUser(emergencyCase.patient.userId, 'case:accepted', {
        caseId: emergencyCase.caseId,
        emergencyCaseId: emergencyCase.id,
        hospitalId,
        status: 'TRANSFER',
        hospital: hospitalObj,
      });
      emitToUser(emergencyCase.patient.userId, 'transfer:started', {
        caseId: emergencyCase.caseId,
        status: 'TRANSFER',
        hospital: hospitalObj,
        startedAt: new Date(),
      });
      emitToUser(emergencyCase.patient.userId, 'emergency:status-updated', {
        caseId: emergencyCase.caseId,
        status: 'TRANSFER',
        hospitalId,
      });
    }

    emitToCaseRoom(emergencyCase.caseId, 'emergency:accepted', {
      caseId: emergencyCase.caseId,
      hospitalId,
      status: 'TRANSFER',
    });

    res.json({
      success: true,
      message: 'Case accepted successfully',
      caseId: emergencyCase.caseId,
      status: 'TRANSFER',
      requestStatus: 'ACCEPTED',
      case: {
        id: emergencyCase.id,
        caseId: emergencyCase.caseId,
        status: 'TRANSFER',
      },
    });
  } catch (err) {
    console.error('[Accept] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 6b. Reject emergency case (Hospital Action)
exports.rejectEmergency = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reason } = req.body || {};
    const userId = req.user.userId || req.user.id;

    let hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      const hospital = await prisma.hospital.findUnique({
        where: { userId },
        select: { id: true },
      });
      hospitalId = hospital?.id;
    }

    if (!hospitalId) {
      return res.status(403).json({ error: 'Hospital profile not found' });
    }

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ caseId }, { id: caseId }] },
    });

    if (!emergencyCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const hospitalRequest = await prisma.hospitalRequest.findFirst({
      where: {
        emergencyCaseId: emergencyCase.id,
        hospitalId,
        status: 'PENDING',
      },
    });

    if (!hospitalRequest) {
      return res.status(404).json({ error: 'No pending request for this hospital' });
    }

    await prisma.$transaction([
      prisma.hospitalRequest.update({
        where: { id: hospitalRequest.id },
        data: {
          status: 'REJECTED',
          respondedAt: new Date(),
          rejectionReason: reason || 'No capacity',
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: 'HOSPITAL_REJECTED',
          entity: 'EmergencyCase',
          entityId: emergencyCase.id,
          details: {
            caseId: emergencyCase.caseId,
            hospitalId,
            reason: reason || 'No capacity',
          },
        },
      }),
    ]);

    const nextRequest = await prisma.hospitalRequest.findFirst({
      where: {
        emergencyCaseId: emergencyCase.id,
        status: 'PENDING',
      },
      include: {
        hospital: { select: { id: true, name: true, address: true, phone: true, capabilities: true } },
      },
    });

    const freshCase = await prisma.emergencyCase.findUnique({
      where: { id: emergencyCase.id },
      include: { patient: { select: { userId: true } } },
    });

    if (freshCase && freshCase.patient) {
      const hospitalRef = await prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { id: true, name: true, address: true },
      });

      emitToUser(freshCase.patient.userId, 'hospital:rejected', {
        caseId: freshCase.caseId,
        hospital: hospitalRef || { id: hospitalId, name: 'Hospital', address: '' },
        reason: reason || 'No capacity',
      });

      if (nextRequest) {
        emitToUser(freshCase.patient.userId, 'case:next-hospital', {
          caseId: freshCase.caseId,
          searching: true,
          hospital: {
            id: nextRequest.hospital.id,
            name: nextRequest.hospital.name,
            address: nextRequest.hospital.address,
            distanceKm: nextRequest.distanceKm,
            capabilities: nextRequest.hospital.capabilities || [],
          },
        });
        emitToUser(freshCase.patient.userId, 'hospital:found', {
          caseId: freshCase.caseId,
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
        emitToUser(freshCase.patient.userId, 'emergency:no-hospital', {
          caseId: freshCase.caseId,
          message: 'No suitable hospital could accept the emergency.',
        });
      }
    }

    const rejectingHospitalUser = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { userId: true, name: true },
    });
    if (rejectingHospitalUser?.userId) {
      emitToHospital(rejectingHospitalUser.userId, 'case:rejected-by-us', {
        caseId: emergencyCase.caseId,
        casePublicId: emergencyCase.caseId,
        hospital: { id: hospitalId, name: rejectingHospitalUser.name },
        reason: reason || null,
        rejectedAt: new Date(),
      });
    }

    console.log('[Reject] Hospital ' + hospitalId + ' rejected ' + emergencyCase.caseId);
    res.json({ success: true, message: 'Case rejected' });

  } catch (err) {
    console.error('[Reject] Error:', err);
    res.status(500).json({ error: err.message });
  }
};

const VALID_STATUS_TRANSITIONS = {
  ACCEPTED: ['TRANSFER', 'IN_PROGRESS'],
  TRANSFER: ['TREATMENT', 'CLOSED', 'IN_PROGRESS'],
  TREATMENT: ['CLOSED'],
  IN_PROGRESS: ['TREATMENT', 'CLOSED'],
  PENDING: ['TRANSFER', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

const VALID_STATUSES = ['TRANSFER', 'TREATMENT', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'];

// 7. Update emergency status (Transfer → Treatment → Completed)
exports.updateEmergencyStatus = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Allowed: ' + VALID_STATUSES.join(', '),
      });
    }

    const emergencyCase = await getOwnedCase(caseId, req.user);
    if (!emergencyCase) return res.status(404).json({ error: 'Case not found.' });

    if (emergencyCase.status === status) {
      return res.json({
        success: true,
        message: 'Status is already ' + status,
        case: emergencyCase,
      });
    }

    const allowedFrom = VALID_STATUS_TRANSITIONS[emergencyCase.status];
    if (allowedFrom === undefined || !allowedFrom.includes(status)) {
      return res.status(400).json({
        error: 'Cannot transition from ' + emergencyCase.status + ' to ' + status + '. Allowed: ' + (allowedFrom ? allowedFrom.join(', ') : 'none'),
      });
    }

    const closedAt = status === 'CLOSED' ? new Date() : null;

    const updatedCase = await prisma.emergencyCase.update({
      where: { id: emergencyCase.id },
      data: { status, closedAt },
      include: {
        patient: { select: { userId: true } },
        hospital: { select: { id: true, name: true, address: true, phone: true } },
      },
    });

    const patientUserId = updatedCase.patient?.userId;
    if (patientUserId) {
      if (status === 'TRANSFER' || status === 'IN_PROGRESS') {
        emitToUser(patientUserId, 'transfer:started', {
          caseId: updatedCase.caseId,
          status,
          hospital: updatedCase.hospital,
          startedAt: new Date(),
        });
      } else if (status === 'TREATMENT') {
        emitToUser(patientUserId, 'treatment:started', {
          caseId: updatedCase.caseId,
          hospital: updatedCase.hospital,
          startedAt: new Date(),
        });
      } else if (status === 'CLOSED') {
        emitToUser(patientUserId, 'case:completed', {
          caseId: updatedCase.caseId,
          completedAt: closedAt,
        });
      }

      // Existing generic status event (same shape as acceptEmergency) so
      // every transition surfaces an emergency:status-updated exactly once.
      emitToUser(patientUserId, 'emergency:status-updated', {
        caseId: updatedCase.caseId,
        status,
        hospitalId: updatedCase.hospital?.id,
      });
    }

    res.json({
      success: true,
      message: 'Emergency status updated to ' + status,
      emergencyCase: {
        id: updatedCase.id,
        caseId: updatedCase.caseId,
        status: updatedCase.status,
        closedAt: updatedCase.closedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
