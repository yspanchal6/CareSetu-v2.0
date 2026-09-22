const prisma = require('../config/prisma');

// 1. Get Dashboard Statistics
exports.getDashboardStats = async (req, res, next) => {
  try {
    const totalHospitals = await prisma.hospital.count();
    
    const activeEmergencies = await prisma.emergencyCase.count({
      where: { status: { in: ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED', 'ACCEPTED', 'IN_PROGRESS'] } }
    });
    
    // Calculate Cases Today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const casesToday = await prisma.emergencyCase.count({
      where: { createdAt: { gte: startOfToday } }
    });

    const activeUsers = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });

    // Calculate Cases by Severity
    const severityGroups = await prisma.emergencyCase.groupBy({
      by: ['severity'],
      _count: { id: true },
    });
    
    const severityPie = [
      { name: "Critical", value: 0, color: "#EF4444" },
      { name: "Urgent", value: 0, color: "#EAB308" },
      { name: "Stable", value: 0, color: "#22C55E" },
    ];
    
    severityGroups.forEach(g => {
      const item = severityPie.find(s => s.name.toUpperCase() === g.severity);
      if (item) item.value = g._count.id;
    });

    // Get Recent Cases
    const recentCasesQuery = await prisma.emergencyCase.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { patient: { select: { name: true } } }
    });
    
    const recentCases = recentCasesQuery.map(c => ({
      name: c.patient?.name || 'Unknown Patient',
      location: 'GPS Location Logged' // MVP Placeholder
    }));

    // For Trend and Acceptance arrays, we send the mocked ones from the frontend for MVP, 
    // or calculate them properly later using PostGIS and timeseries.
    const trend = [
      { m: "Jan", v: 120 }, { m: "Feb", v: 145 }, { m: "Mar", v: 132 }, { m: "Apr", v: 168 }, { m: "May", v: 190 }, { m: "Jun", v: 210 },
    ];
    const acceptance = [
      { m: "Jan", v: 82 }, { m: "Feb", v: 85 }, { m: "Mar", v: 80 }, { m: "Apr", v: 88 }, { m: "May", v: 91 }, { m: "Jun", v: 94 },
    ];

    res.json({
      success: true,
      stats: {
        totalHospitals,
        activeEmergencies,
        casesToday,
        avgResponseTime: "2.3 min", // MVP Mock
        availableBeds: 2340, // MVP Mock
        icuAvailability: "18%", // MVP Mock
        activeUsers,
        severityPie,
        recentCases,
        trend,
        acceptance
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All Users
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        // Conditionally fetch names based on role
        patientProfile: { select: { name: true } },
        hospitalProfile: { select: { name: true } },
        doctorProfile: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      name: u.patientProfile?.name || u.hospitalProfile?.name || u.doctorProfile?.name || 'Admin User'
    }));

    res.json({ success: true, users: formattedUsers });
  } catch (error) {
    next(error);
  }
};

// 3. Get All Hospitals
exports.getAllHospitals = async (req, res, next) => {
  try {
    const hospitals = await prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        emergencyAvailable: true,
        hasICU: true,
        capabilities: true,
        isVerified: true,
      },
      orderBy: { name: 'asc' }
    });

    const formattedHospitals = hospitals.map(h => ({
      id: h.id,
      name: h.name,
      bedsAvailable: Math.floor(Math.random() * 50) + 10, // Mocked for UI
      beds: 100, // Mocked
      icuAvailable: h.hasICU ? Math.floor(Math.random() * 10) : 0, // Mocked
      icuBeds: h.hasICU ? 20 : 0, // Mocked
      responseTimeMin: (Math.random() * 5 + 1).toFixed(1), // Mocked
      availability: h.emergencyAvailable ? 'Available' : 'Busy',
      isVerified: h.isVerified
    }));

    res.json({ success: true, hospitals: formattedHospitals });
  } catch (error) {
    next(error);
  }
};

// 4. Get All Emergencies
exports.getAllEmergencies = async (req, res, next) => {
  try {
    const emergencies = await prisma.emergencyCase.findMany({
      include: {
        patient: { select: { name: true } },
        hospital: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit for UI performance
    });

    const formattedEmergencies = emergencies.map(e => ({
      id: e.caseId,
      severity: e.severity === 'CRITICAL' ? 'Critical' : e.severity === 'URGENT' ? 'Urgent' : 'Stable',
      patientName: e.patient?.name || 'Unknown',
      requiredCapability: e.symptoms || 'General',
      assignedHospital: e.hospital?.name || null,
      status: e.status
    }));

    res.json({ success: true, emergencies: formattedEmergencies });
  } catch (error) {
    next(error);
  }
};

// 5. System Brevo Email Provider Health Check (Admin Only)
exports.getBrevoHealth = async (req, res, next) => {
  try {
    const brevo = require('../services/providers/brevo.provider');
    const health = await brevo.verifyBrevoAuth();
    res.json({ success: true, health });
  } catch (error) {
    next(error);
  }
};

