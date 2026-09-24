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
        hospital: true,
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
          location: u.hospital?.location || { latitude: 0, longitude: 0 },
          capabilities: u.hospital?.capabilities || [],
          emergencyAvailable: u.hospital?.emergencyAvailable ?? true,
          isVerified: Boolean(u.isVerified && u.hospital?.isVerified),
          userStatus: u.status,
          verificationStatus,
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

