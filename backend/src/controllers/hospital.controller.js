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
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'A valid latitude and longitude are required.' });
    }

    const hospitals = await prisma.hospital.findMany({
      where: { emergencyAvailable: true },
      select: { id: true, name: true, address: true, phone: true, capabilities: true, emergencyAvailable: true, location: true },
    });
    const origin = { latitude, longitude };
    const nearbyHospitals = hospitals
      .map((hospital) => {
        const hospitalCoordinates = coordinates(hospital.location);
        if (!hospitalCoordinates) return null;
        const distanceKm = distanceInKilometres(origin, hospitalCoordinates);
        return { hospital, distanceKm };
      })
      .filter(Boolean)
      .filter(({ distanceKm }) => distanceKm <= 8)
      .sort((first, second) => first.distanceKm - second.distanceKm)
      .slice(0, 5)
      .map(({ hospital, distanceKm }) => ({
        id: hospital.id,
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone,
        capabilities: hospital.capabilities,
        emergencyAvailable: hospital.emergencyAvailable,
        distance: `${distanceKm.toFixed(2)} km`,
      }));

    res.json({ success: true, hospitals: nearbyHospitals });
  } catch (error) {
    next(error);
  }
};

exports.acceptCase = async (req, res, next) => {
  try {
    if (req.user.role !== 'HOSPITAL') {
      return res.status(403).json({ error: 'Only hospital accounts can accept an emergency case.' });
    }

    const hospital = await prisma.hospital.findUnique({ where: { userId: req.user.userId } });
    if (!hospital) {
      return res.status(409).json({ error: 'Complete your hospital profile before accepting a case.' });
    }

    const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: req.params.caseId } });
    if (!emergencyCase) return res.status(404).json({ error: 'Case not found.' });

    const claimed = await prisma.emergencyCase.updateMany({
      where: {
        id: emergencyCase.id,
        status: { in: ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED'] },
        OR: [{ hospitalId: null }, { hospitalId: hospital.id }],
      },
      data: { hospitalId: hospital.id, status: 'ACCEPTED', acceptedAt: new Date() },
    });

    if (claimed.count === 0) {
      return res.status(409).json({ error: 'This case is no longer available to accept.' });
    }

    res.json({ success: true, message: 'Case accepted. Patient notified.' });
  } catch (error) {
    next(error);
  }
};

exports.getAllHospitals = async (req, res, next) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      where: { emergencyAvailable: true },
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
    const hospital = await prisma.hospital.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });
    res.json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

exports.updateHospitalProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { name, address, phone, city, state, capabilities, emergencyAvailable, location } = req.body;

    const hospital = await prisma.hospital.findUnique({ where: { userId } });
    if (!hospital) return res.status(404).json({ error: 'Hospital profile not found' });

    const updated = await prisma.hospital.update({
      where: { id: hospital.id },
      data: {
        name: name || hospital.name,
        address: address || hospital.address,
        phone: phone || hospital.phone,
        city: city !== undefined ? city : hospital.city,
        state: state !== undefined ? state : hospital.state,
        capabilities: capabilities || hospital.capabilities,
        emergencyAvailable: emergencyAvailable !== undefined ? emergencyAvailable : hospital.emergencyAvailable,
        location: location || hospital.location,
      },
    });

    res.json({ success: true, message: 'Profile updated successfully', hospital: updated });
  } catch (err) {
    next(err);
  }
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
