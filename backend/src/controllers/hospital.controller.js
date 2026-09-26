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

exports.acceptCase = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    if (req.user.role !== 'HOSPITAL') {
      return res.status(403).json({ error: 'Only hospital accounts can accept an emergency case.' });
    }

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) {
      return res.status(409).json({ error: 'Complete your hospital profile before accepting a case.' });
    }

    const caseIdParam = req.params.caseId;
    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseIdParam }, { caseId: caseIdParam }] },
    });
    if (!emergencyCase) return res.status(404).json({ error: 'Case not found.' });

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
        const err = new Error('This case is no longer available to accept.');
        err.status = 409;
        throw err;
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
    });

    res.json({ success: true, message: 'Case accepted. Patient notified.' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
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
      select: { id: true },
    });

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    // Find all emergency cases where this hospital has a request
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
          select: { name: true, age: true, gender: true },
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
      return {
        id: c.id,
        caseId: c.caseId,
        patientName: c.patient?.name || 'Unknown',
        age: c.patient?.age,
        gender: c.patient?.gender,
        symptoms: c.symptoms,
        severity: c.severity,
        emergencyType: c.emergencyType,
        status: req?.status || c.status,
        distanceKm: req?.distanceKm,
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

    res.json({
      success: true,
      hospital: {
        ...user.hospital,
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

exports.getHospitalStaff = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    const staff = [
      { id: '1', name: 'Dr. Emergency Lead', role: 'Emergency Physician', status: hospital.emergencyAvailable ? 'On Duty' : 'Off Duty' },
      { id: '2', name: 'Dr. Specialist', role: hospital.capabilities?.[0] || 'General Physician', status: 'On Duty' },
    ];
    res.json({ success: true, staff });
  } catch (err) {
    next(err);
  }
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
