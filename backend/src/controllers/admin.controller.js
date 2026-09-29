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

// 6. Admin-controlled User Role Correction Workflow
exports.changeUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { newRole, reason } = req.body;

    const allowedRoles = ['PATIENT', 'HOSPITAL', 'DOCTOR', 'ADMIN'];
    if (!newRole || !allowedRoles.includes(newRole.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid target role. Allowed roles are: ${allowedRoles.join(', ')}`,
      });
    }

    const targetRole = newRole.toUpperCase();

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { hospital: true, patient: true },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user account not found.' });
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { role: targetRole },
      });

      if (targetRole === 'HOSPITAL' && !targetUser.hospital) {
        await tx.hospital.create({
          data: {
            userId: targetUser.id,
            name: targetUser.name || 'Hospital Account',
            address: 'Pending address update',
            phone: '0000000000',
            location: { latitude: 0, longitude: 0 },
            isVerified: false,
            emergencyAvailable: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.userId || req.user.id,
          action: 'PROFILE_UPDATED',
          entity: 'UserRoleCorrection',
          entityId: targetUser.id,
          details: {
            adminUserId: req.user.userId || req.user.id,
            targetUserId: targetUser.id,
            previousRole: targetUser.role,
            newRole: targetRole,
            reason: reason || 'Admin-controlled role correction workflow',
          },
        },
      });

      return user;
    });

    res.json({
      success: true,
      message: `User role updated successfully from ${targetUser.role} to ${targetRole}.`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 7. Get Hospital Verification Requests for Admin Review
exports.getHospitalVerificationRequests = async (req, res, next) => {
  try {
    const { status, search } = req.query;

    const whereClause = {
      role: 'HOSPITAL',
    };

    if (search && search.trim()) {
      whereClause.OR = [
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { hospital: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { hospital: { city: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        hospital: {
          include: {
            securityStatus: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const requests = await Promise.all(
      users.map(async (u) => {
        const docs = await prisma.medicalDocument.findMany({
          where: {
            extractedText: { contains: `"userId":"${u.id}"` },
          },
          select: {
            id: true,
            fileName: true,
            documentType: true,
            fileUrl: true,
            fileSize: true,
            fileType: true,
            createdAt: true,
          },
        });

        const parseDetails = (log) => {
          if (!log || !log.details) return {};
          if (typeof log.details === 'string') {
            try { return JSON.parse(log.details); } catch { return {}; }
          }
          return log.details;
        };

        const parsedLogs = u.auditLogs.map((l) => ({ ...l, d: parseDetails(l) }));
        const rejLog = parsedLogs.find(
          (l) => l.entity === 'HospitalRejection' || l.d?.action === 'HOSPITAL_REJECTED' || l.d?.verificationStatus === 'REJECTED'
        );
        const submitLog = parsedLogs.find(
          (l) => l.d?.event === 'HOSPITAL_ONBOARDING_SUBMITTED' || l.d?.isFinalSubmit === true
        );

        let verificationStatus = 'PENDING_REVIEW';
        let rejectionReason = null;

        if (u.status === 'BLOCKED') {
          verificationStatus = 'BLOCKED';
        } else if (u.isVerified && u.hospital?.isVerified) {
          verificationStatus = 'APPROVED';
        } else if (rejLog && (!submitLog || new Date(submitLog.createdAt).getTime() < new Date(rejLog.createdAt).getTime())) {
          verificationStatus = 'REJECTED';
          rejectionReason = rejLog.d?.reason || 'Document or detail updates required by Admin.';
        } else {
          verificationStatus = 'PENDING_REVIEW';
        }

        if (status && status !== 'ALL' && verificationStatus !== status) {
          return null;
        }

        const secStatus = u.hospital?.securityStatus?.status || (u.status === 'BLOCKED' ? 'TEMPORARILY_BLOCKED' : 'ACTIVE');

        return {
          id: u.hospital?.id || u.id,
          hospitalId: u.hospital?.id || null,
          userId: u.id,
          name: u.hospital?.name || u.email.split('@')[0] || 'Unnamed Hospital',
          email: u.email,
          phone: u.hospital?.phone || 'Not provided',
          address: u.hospital?.address || 'Not provided',
          city: u.hospital?.city || '',
          state: u.hospital?.state || '',
          district: u.hospital?.district || '',
          location: u.hospital?.location || { latitude: 0, longitude: 0 },
          capabilities: u.hospital?.capabilities || [],
          hospitalType: u.hospital?.hospitalType || (u.hospital?.capabilities?.find(c => c.startsWith('Type:'))?.replace('Type:', '') || 'Private'),
          ownership: u.hospital?.ownership || (u.hospital?.capabilities?.find(c => c.startsWith('Ownership:'))?.replace('Ownership:', '') || 'Private'),
          registrationId: u.hospital?.registrationId || u.hospital?.capabilities?.find(c => c.startsWith('REG:'))?.replace('REG:', '') || null,
          totalBeds: u.hospital?.totalBeds ?? 0,
          icuBeds: u.hospital?.icuBeds ?? 0,
          emergencyAvailable: u.hospital?.emergencyAvailable ?? true,
          isVerified: Boolean(u.isVerified && u.hospital?.isVerified),
          userStatus: u.status,
          verificationStatus,
          securityStatus: secStatus,
          securityStatusDetails: u.hospital?.securityStatus || null,
          onboardingStatus: u.hospital?.isVerified ? 'VERIFIED' : 'SUBMITTED',
          documents: docs.map(d => ({
            id: d.id,
            title: d.fileName || d.documentType || 'Verification Document',
            documentType: d.documentType,
            fileSize: d.fileSize,
            mimeType: d.fileType || 'application/pdf',
            fileUrl: d.fileUrl,
            createdAt: d.createdAt,
            downloadUrl: `/api/documents/download/${d.id}`,
          })),
          submissionDate: u.hospital?.updatedAt || u.createdAt,
          createdAt: u.createdAt,
          auditHistory: u.auditLogs.map(l => ({
            id: l.id,
            action: l.action,
            entity: l.entity,
            details: l.details,
            createdAt: l.createdAt,
          })),
        };
      })
    );

    const filteredRequests = requests.filter(Boolean);

    res.json({
      success: true,
      count: filteredRequests.length,
      requests: filteredRequests,
    });
  } catch (error) {
    next(error);
  }
};

// 8. Admin Approval of Hospital Application
exports.approveHospital = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user.userId || req.user.id;

    let hospital = await prisma.hospital.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!hospital) {
      hospital = await prisma.hospital.findUnique({
        where: { userId: id },
        include: { user: true },
      });
    }

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const h = await tx.hospital.update({
        where: { id: hospital.id },
        data: {
          isVerified: true,
          emergencyAvailable: true,
        },
      });

      await tx.user.update({
        where: { id: hospital.userId },
        data: {
          role: 'HOSPITAL',
          isVerified: true,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PROFILE_UPDATED',
          entity: 'HospitalApproval',
          entityId: hospital.id,
          details: {
            adminUserId,
            hospitalId: hospital.id,
            targetUserId: hospital.userId,
            action: 'HOSPITAL_APPROVED',
            verificationStatus: 'APPROVED',
            onboardingStatus: 'VERIFIED',
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: hospital.userId,
          title: 'HOSPITAL_APPROVAL_EVENT',
          message: 'Congratulations! Admin has successfully approved your hospital registration. Your hospital portal is now active.',
          type: 'SYSTEM',
        },
      });

      return h;
    });

    try {
      const brevo = require('../services/providers/brevo.provider');
      await brevo.sendEmail({
        to: hospital.user.email,
        subject: 'CareSetu — Hospital Verification Approved!',
        html: `<h2>Congratulations ${hospital.name}!</h2><p>Your hospital registration has been reviewed and approved by the CareSetu Verification Team. Your hospital portal is now fully active.</p><p>You can now receive emergency dispatches and manage patient cases.</p>`,
      });
    } catch (emailErr) {
      console.warn('[AdminApprove] Email notification warning:', emailErr?.message);
    }

    res.json({
      success: true,
      message: 'Hospital application approved successfully. Portal is now active.',
      hospital: updated,
      verificationStatus: 'APPROVED',
      onboardingStatus: 'VERIFIED',
    });
  } catch (error) {
    next(error);
  }
};

// 9. Admin Rejection of Hospital Application
exports.rejectHospital = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user.userId || req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
    }

    let hospital = await prisma.hospital.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!hospital) {
      hospital = await prisma.hospital.findUnique({
        where: { userId: id },
        include: { user: true },
      });
    }

    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital record not found.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const h = await tx.hospital.update({
        where: { id: hospital.id },
        data: {
          isVerified: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'PROFILE_UPDATED',
          entity: 'HospitalRejection',
          entityId: hospital.id,
          details: {
            adminUserId,
            hospitalId: hospital.id,
            targetUserId: hospital.userId,
            action: 'HOSPITAL_REJECTED',
            reason: reason.trim(),
            verificationStatus: 'REJECTED',
          },
        },
      });

      await tx.notification.create({
        data: {
          userId: hospital.userId,
          title: 'Hospital Verification Required Correction',
          message: `Your verification request requires correction. Admin Feedback: ${reason.trim()}`,
          type: 'SYSTEM',
        },
      });

      return h;
    });

    try {
      const brevo = require('../services/providers/brevo.provider');
      await brevo.sendEmail({
        to: hospital.user.email,
        subject: 'CareSetu — Hospital Verification Update Required',
        html: `<h2>Attention ${hospital.name}</h2><p>Your hospital verification application requires correction before approval.</p><p><strong>Admin Feedback:</strong> ${reason.trim()}</p><p>Please log in to your CareSetu Hospital Portal to update your details and resubmit.</p>`,
      });
    } catch (emailErr) {
      console.warn('[AdminReject] Email notification warning:', emailErr?.message);
    }

    res.json({
      success: true,
      message: 'Hospital application rejected with feedback.',
      hospital: updated,
      verificationStatus: 'REJECTED',
      reason: reason.trim(),
    });
  } catch (error) {
    next(error);
  }
};

// 10. Admin Register Hospital Facility
exports.registerHospital = async (req, res, next) => {
  try {
    const adminUserId = req.user.userId || req.user.id;
    const {
      name,
      email,
      phone,
      hospitalType,
      ownership,
      registrationId,
      state,
      district,
      city,
      address,
      latitude,
      longitude,
      totalBeds,
      icuBeds,
      emergencyAvailable,
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Facility name is required.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, error: 'Official email is required.' });

    const totalBedsNum = parseInt(totalBeds) || 0;
    const icuBedsNum = parseInt(icuBeds) || 0;

    if (icuBedsNum > totalBedsNum) {
      return res.status(400).json({ success: false, error: 'ICU beds count cannot exceed total beds.' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { hospital: true },
    });

    let hospitalRecord;
    const capabilities = [
      `Type:${hospitalType || 'Private'}`,
      `Ownership:${ownership || 'Private'}`,
      registrationId ? `REG:${registrationId.trim()}` : null,
      `TotalBeds:${totalBedsNum}`,
      `ICUBeds:${icuBedsNum}`,
    ].filter(Boolean);

    if (existingUser) {
      if (existingUser.hospital) {
        return res.status(400).json({ success: false, error: 'A hospital facility with this official email already exists in the registry.' });
      }

      hospitalRecord = await prisma.$transaction(async (tx) => {
        const h = await tx.hospital.create({
          data: {
            userId: existingUser.id,
            name: name.trim(),
            address: address?.trim() || city?.trim() || 'Address Pending',
            city: city?.trim() || '',
            state: state?.trim() || '',
            district: district?.trim() || '',
            phone: phone?.trim() || '',
            capabilities,
            location: { latitude: parseFloat(latitude) || 0, longitude: parseFloat(longitude) || 0 },
            emergencyAvailable: emergencyAvailable !== false && emergencyAvailable !== 'Unavailable',
            isVerified: false,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'PROFILE_UPDATED',
            entity: 'HospitalRegistry',
            entityId: h.id,
            details: {
              adminUserId,
              hospitalId: h.id,
              facilityName: h.name,
              email: existingUser.email,
              action: 'HOSPITAL_REGISTERED',
            },
          },
        });

        return h;
      });
    } else {
      const bcrypt = require('bcryptjs');
      const randomPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      hospitalRecord = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email.trim().toLowerCase(),
            passwordHash,
            role: 'HOSPITAL',
            status: 'ACTIVE',
            isVerified: false,
          },
        });

        const h = await tx.hospital.create({
          data: {
            userId: newUser.id,
            name: name.trim(),
            address: address?.trim() || city?.trim() || 'Address Pending',
            city: city?.trim() || '',
            state: state?.trim() || '',
            district: district?.trim() || '',
            phone: phone?.trim() || '',
            capabilities,
            location: { latitude: parseFloat(latitude) || 0, longitude: parseFloat(longitude) || 0 },
            emergencyAvailable: emergencyAvailable !== false && emergencyAvailable !== 'Unavailable',
            isVerified: false,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: adminUserId,
            action: 'PROFILE_UPDATED',
            entity: 'HospitalRegistry',
            entityId: h.id,
            details: {
              adminUserId,
              hospitalId: h.id,
              facilityName: h.name,
              email: newUser.email,
              action: 'HOSPITAL_SUBMITTED',
            },
          },
        });

        return h;
      });
    }

    res.json({
      success: true,
      message: 'Hospital facility registered successfully and submitted for verification.',
      hospital: hospitalRecord,
    });
  } catch (error) {
    next(error);
  }
};

// Centralized Admin Analytics Controller
exports.getAnalytics = async (req, res, next) => {
  try {
    const { dateRange = '30d', startDate, endDate, hospitalId, source, status, platform } = req.query;

    const now = new Date();
    let start = null;
    let end = now;

    // Validate date parameters
    if (dateRange === 'today') {
      start = new Date();
      start.setHours(0, 0, 0, 0);
    } else if (dateRange === '7d') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '90d') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (dateRange === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_DATE_RANGE',
          message: 'Invalid start date or end date format provided.'
        });
      }
      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_DATE_RANGE',
          message: 'Start date cannot be after end date.'
        });
      }
    }

    const dateWhere = start ? { createdAt: { gte: start, lte: end } } : {};
    const violationDateWhere = start ? { detectedAt: { gte: start, lte: end } } : {};

    // 1. Overview Totals with Null-Safe Execution
    const [
      totalHospitals,
      approvedHospitals,
      pendingHospitals,
      blockedHospitals,
      totalUsers,
      totalEmergencies,
      completedEmergencies,
      totalMatchingRequests,
      acceptedMatchingRequests,
      totalSecurityEvents,
      totalGovRecords,
      govRecordsDataGovIn,
      govRecordsPmjay
    ] = await Promise.all([
      prisma.hospital.count().catch(() => 0),
      prisma.hospital.count({ where: { isVerified: true } }).catch(() => 0),
      prisma.hospital.count({ where: { isVerified: false } }).catch(() => 0),
      prisma.hospitalSecurityStatus.count({ where: { status: 'TEMPORARILY_BLOCKED' } }).catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.emergencyCase.count({ where: dateWhere }).catch(() => 0),
      prisma.emergencyCase.count({ where: { ...dateWhere, status: { in: ['CLOSED', 'TREATMENT'] } } }).catch(() => 0),
      prisma.hospitalRequest.count({ where: dateWhere }).catch(() => 0),
      prisma.hospitalRequest.count({ where: { ...dateWhere, status: 'ACCEPTED' } }).catch(() => 0),
      prisma.captureViolation.count({ where: violationDateWhere }).catch(() => 0),
      prisma.governmentHealthRecord.count().catch(() => 0),
      prisma.governmentHealthRecord.count({ where: { source: 'DATA_GOV_IN' } }).catch(() => 0),
      prisma.governmentHealthRecord.count({ where: { source: 'PM_JAY' } }).catch(() => 0),
    ]);

    // 2. Emergency Operations Breakdown
    let emergencyStatusGroups = [];
    let emergencySeverityGroups = [];
    let emergencyTrend = [];
    try {
      emergencyStatusGroups = await prisma.emergencyCase.groupBy({
        by: ['status'],
        _count: { id: true },
        where: dateWhere
      });

      emergencySeverityGroups = await prisma.emergencyCase.groupBy({
        by: ['severity'],
        _count: { id: true },
        where: dateWhere
      });

      const recentCasesForTime = await prisma.emergencyCase.findMany({
        where: dateWhere,
        select: { createdAt: true, status: true, severity: true },
        orderBy: { createdAt: 'asc' },
        take: 500
      });

      const timeSeriesMap = new Map();
      recentCasesForTime.forEach((c) => {
        const dateStr = new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const current = timeSeriesMap.get(dateStr) || { date: dateStr, cases: 0, critical: 0, closed: 0 };
        current.cases += 1;
        if (c.severity === 'RED') current.critical += 1;
        if (c.status === 'CLOSED' || c.status === 'TREATMENT') current.closed += 1;
        timeSeriesMap.set(dateStr, current);
      });
      emergencyTrend = Array.from(timeSeriesMap.values());
    } catch (e) {
      console.error('[getAnalytics] Emergency query warning:', e.message);
    }

    // 3. Hospital Matching Breakdown
    let matchStatusGroups = [];
    try {
      matchStatusGroups = await prisma.hospitalRequest.groupBy({
        by: ['status'],
        _count: { id: true },
        where: dateWhere
      });
    } catch (e) {
      console.error('[getAnalytics] Match query warning:', e.message);
    }

    const matchRate = totalMatchingRequests > 0 
      ? Math.round((acceptedMatchingRequests / totalMatchingRequests) * 100)
      : 0;

    // 4. Hospital Network & Beds Summary
    let hospitalTypeGroups = [];
    let hospitalOwnershipGroups = [];
    let bedCapacitySum = { _sum: { totalBeds: 0, icuBeds: 0 } };
    try {
      hospitalTypeGroups = await prisma.hospital.groupBy({
        by: ['hospitalType'],
        _count: { id: true }
      });
      hospitalOwnershipGroups = await prisma.hospital.groupBy({
        by: ['ownership'],
        _count: { id: true }
      });
      bedCapacitySum = await prisma.hospital.aggregate({
        _sum: {
          totalBeds: true,
          icuBeds: true
        }
      });
    } catch (e) {
      console.error('[getAnalytics] Hospital query warning:', e.message);
    }

    // 5. Security Violations Breakdown (Using correct model CaptureViolation)
    let securityEventGroups = [];
    let securityPlatformGroups = [];
    let securityTrend = [];
    try {
      securityEventGroups = await prisma.captureViolation.groupBy({
        by: ['eventType'],
        _count: { id: true },
        where: violationDateWhere
      });

      securityPlatformGroups = await prisma.captureViolation.groupBy({
        by: ['platform'],
        _count: { id: true },
        where: violationDateWhere
      });

      const recentSecurityEvents = await prisma.captureViolation.findMany({
        where: violationDateWhere,
        select: { detectedAt: true, eventType: true, attemptNumber: true },
        orderBy: { detectedAt: 'asc' },
        take: 500
      });

      const securityTrendMap = new Map();
      recentSecurityEvents.forEach((se) => {
        const dateStr = new Date(se.detectedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        const current = securityTrendMap.get(dateStr) || { date: dateStr, events: 0, blocked: 0, warnings: 0 };
        current.events += 1;
        if (se.attemptNumber >= 3) current.blocked += 1;
        else current.warnings += 1;
        securityTrendMap.set(dateStr, current);
      });
      securityTrend = Array.from(securityTrendMap.values());
    } catch (e) {
      console.error('[getAnalytics] Security query warning:', e.message);
    }

    // 6. User Roles Breakdown
    let userRoleGroups = [];
    let userStatusGroups = [];
    try {
      userRoleGroups = await prisma.user.groupBy({
        by: ['role'],
        _count: { id: true }
      });
      userStatusGroups = await prisma.user.groupBy({
        by: ['status'],
        _count: { id: true }
      });
    } catch (e) {
      console.error('[getAnalytics] User query warning:', e.message);
    }

    // 7. Audit Logs Breakdown
    let auditActionGroups = [];
    try {
      auditActionGroups = await prisma.auditLog.groupBy({
        by: ['action'],
        _count: { id: true },
        where: dateWhere,
        orderBy: { _count: { id: 'desc' } },
        take: 8
      });
    } catch (e) {
      console.error('[getAnalytics] Audit query warning:', e.message);
    }

    return res.json({
      success: true,
      filters: {
        dateRange,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
      },
      overview: {
        totalHospitals,
        approvedHospitals,
        pendingHospitals,
        blockedHospitals,
        totalUsers,
        totalEmergencies,
        completedEmergencies,
        totalMatchingRequests,
        acceptedMatchingRequests,
        matchRate,
        totalSecurityEvents,
        totalGovRecords,
        govRecordsDataGovIn,
        govRecordsPmjay,
        totalBeds: bedCapacitySum._sum?.totalBeds || 0,
        totalIcuBeds: bedCapacitySum._sum?.icuBeds || 0,
      },
      emergency: {
        statuses: emergencyStatusGroups.map((g) => ({ name: g.status, value: g._count.id })),
        severities: emergencySeverityGroups.map((g) => ({ name: g.severity, value: g._count.id })),
        trend: emergencyTrend,
      },
      matching: {
        outcomes: matchStatusGroups.map((g) => ({ name: g.status, value: g._count.id })),
        matchRate,
        totalRequests: totalMatchingRequests,
        successfulMatches: acceptedMatchingRequests,
      },
      hospitals: {
        types: hospitalTypeGroups.map((g) => ({ name: g.hospitalType || 'Government', value: g._count.id })),
        ownership: hospitalOwnershipGroups.map((g) => ({ name: g.ownership || 'Government', value: g._count.id })),
        verification: [
          { name: 'Approved', value: approvedHospitals },
          { name: 'Pending Verification', value: pendingHospitals },
          { name: 'Blocked', value: blockedHospitals },
        ],
      },
      government: {
        totalRecords: totalGovRecords,
        sources: [
          { name: 'DATA_GOV_IN (District Hospitals)', value: govRecordsDataGovIn, key: 'DATA_GOV_IN' },
          { name: 'PM_JAY (Historical Admissions)', value: govRecordsPmjay, key: 'PM_JAY' },
        ],
      },
      security: {
        events: securityEventGroups.map((g) => ({ name: g.eventType, value: g._count.id })),
        results: [
          { name: '1/3 Warning', value: Math.max(0, totalSecurityEvents - blockedHospitals) },
          { name: '3/3 Blocked', value: blockedHospitals }
        ],
        platforms: securityPlatformGroups.map((g) => ({ name: g.platform || 'WEB', value: g._count.id })),
        trend: securityTrend,
      },
      users: {
        roles: userRoleGroups.map((g) => ({ name: g.role, value: g._count.id })),
        statuses: userStatusGroups.map((g) => ({ name: g.status, value: g._count.id })),
      },
      audit: {
        actions: auditActionGroups.map((g) => ({ name: g.action, value: g._count.id })),
      },
    });
  } catch (error) {
    console.error('[AdminAnalytics] Unexpected controller error:', error);
    return res.status(500).json({
      success: false,
      error: 'ANALYTICS_QUERY_FAILED',
      message: 'Unable to load analytics data.'
    });
  }
};




