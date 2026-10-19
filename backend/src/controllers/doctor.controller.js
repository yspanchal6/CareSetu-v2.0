const prisma = require('../config/prisma');
const { z } = require('zod');
const healthPackService = require('../services/health-pack.service');
const {
  ACTIVE_OPERATIONAL_STATUSES,
  CASE_HISTORY_STATUSES,
  canTransitionCase,
  canActorTransitionCase,
  isCaseEligibleForClosure,
} = require('../utils/case-workflow');

/**
 * Normalizes case status/severity to clean display strings for frontend UI compatibility
 */
function mapCaseStage(status) {
  const norm = String(status || '').toUpperCase();
  switch (norm) {
    case 'ACCEPTED':
    case 'HOSPITAL_REQUESTED':
      return 'HospitalAssigned';
    case 'TRANSFER':
      return 'Transfer';
    case 'IN_PROGRESS':
      return 'PatientArrived';
    case 'TREATMENT':
      return 'Treatment';
    case 'CLOSED':
    case 'COMPLETED':
      return 'Completed';
    case 'PENDING':
    case 'MATCHING':
      return 'Pending';
    default:
      return 'HospitalAssigned';
  }
}

function mapCaseSeverity(severity) {
  const norm = String(severity || '').toUpperCase();
  if (norm === 'RED' || norm === 'CRITICAL') return 'Critical';
  if (norm === 'ORANGE' || norm === 'URGENT' || norm === 'HIGH') return 'Urgent';
  return 'Stable';
}

async function resolveDoctorHospitalId(user) {
  if (!user) return null;
  if (user.hospitalId) return user.hospitalId;

  const userId = user.userId || user.id;
  const role = user.role;

  if (role === 'DOCTOR' || role === 'HOSPITAL') {
    const docStaff = await prisma.hospitalStaff.findFirst({
      where: {
        OR: [
          { userId },
          ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' } }] : []),
          { id: userId },
        ],
        isActive: true,
      },
      select: { hospitalId: true },
    });
    if (docStaff?.hospitalId) return docStaff.hospitalId;

    const hosp = await prisma.hospital.findFirst({
      where: {
        OR: [
          { userId },
          ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' } }] : []),
        ],
      },
      select: { id: true },
    });
    return hosp?.id || null;
  }

  return null;
}

async function buildDoctorScopeWhere(user) {
  const userId = user.userId || user.id;
  const role = user.role;
  if (role === 'ADMIN') return {};

  if (role === 'DOCTOR') {
    const activeStaffAffiliations = await prisma.hospitalStaff.findMany({
      where: {
        OR: [
          { userId },
          ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' } }] : []),
        ],
        isActive: true,
      },
      select: { id: true, hospitalId: true },
    });

    if (!activeStaffAffiliations.length) {
      return { id: '__no_hospital_affiliation__' };
    }

    const affiliatedHospitalIds = activeStaffAffiliations.map((s) => s.hospitalId);
    const staffIds = activeStaffAffiliations.map((s) => s.id);
    const assignedIds = [userId, ...staffIds].filter(Boolean);

    return {
      hospitalId: { in: affiliatedHospitalIds },
      OR: [
        ...assignedIds.map((id) => ({
          medicalSummary: { path: ['assignedDoctor', 'id'], equals: id },
        })),
        ...(user.email
          ? [{ medicalSummary: { path: ['assignedDoctor', 'email'], equals: user.email } }]
          : []),
      ],
    };
  }

  const hospitalId = await resolveDoctorHospitalId(user);

  if (hospitalId) {
    return {
      OR: [
        { hospitalId: hospitalId },
        {
          hospitalRequests: {
            some: {
              hospitalId: hospitalId,
              status: { in: ['PENDING', 'ACCEPTED'] },
            },
          },
        },
      ],
    };
  }

  return { id: '__no_hospital_scope__' };
}

async function isDirectlyAssigned(user, emergencyCase) {
  const assignment = emergencyCase.medicalSummary?.assignedDoctor;
  if (!assignment) return false;

  const userId = user.userId || user.id;
  const userEmail = String(user.email || '').toLowerCase();
  const caseHospitalId = emergencyCase.hospitalId;

  // Emergency cases require hospital-specific active standing
  if (!caseHospitalId) {
    return false;
  }

  const activeStaff = await prisma.hospitalStaff.findFirst({
    where: {
      hospitalId: caseHospitalId,
      OR: [
        { userId },
        ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' } }] : []),
      ],
      isActive: true,
    },
    select: { id: true },
  });
  if (!activeStaff) return false;

  if (assignment.id === userId) return true;
  if (assignment.email && String(assignment.email).toLowerCase() === userEmail) return true;

  if (assignment.id && userEmail) {
    const staff = await prisma.hospitalStaff.findFirst({
      where: {
        id: assignment.id,
        email: { equals: user.email, mode: 'insensitive' },
        isActive: true,
        hospitalId: caseHospitalId,
      },
      select: { id: true },
    });
    return Boolean(staff);
  }
  return false;
}

const doctorProfileUpdateSchema = z.object({
  userId: z.string().trim().optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  specialty: z.string().trim().min(2).max(120).optional(),
  subSpecialties: z.array(z.string().trim().min(1).max(80)).optional(),
  licenseNumber: z.string().trim().min(3).max(80).optional(),
  medicalCouncil: z.string().trim().min(2).max(120).optional(),
  qualification: z.string().trim().min(2).max(120).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  bio: z.string().trim().max(2000).optional().or(z.literal('')),
  clinicAddress: z.string().trim().min(5).max(250).optional().or(z.literal('')),
  city: z.string().trim().min(2).max(100).optional().or(z.literal('')),
  state: z.string().trim().min(2).max(100).optional().or(z.literal('')),
  pincode: z.string().trim().min(4).max(20).optional().or(z.literal('')),
  isIndependent: z.boolean().optional(),
  location: z.any().optional(),
}).passthrough();

exports.getDoctorProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true, isVerified: true },
    });
    if (!user || user.role !== 'DOCTOR') {
      return res.status(404).json({ success: false, error: 'Doctor profile not found.' });
    }

    const hospitalAffiliations = await prisma.hospitalStaff.findMany({
      where: {
        OR: [
          { userId: user.id },
          ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' } }] : []),
        ],
        isActive: true,
      },
      include: {
        hospital: { select: { id: true, name: true, address: true, city: true, state: true } },
      },
    });

    const independentProfile = await prisma.doctorProfile.findUnique({
      where: { userId: user.id },
    });

    return res.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name || hospitalAffiliations[0]?.name || independentProfile?.fullName || 'Doctor',
        email: user.email,
        role: user.role,
        status: user.status,
        isVerified: user.isVerified,
        affiliations: hospitalAffiliations.map((s) => ({
          hospitalId: s.hospital.id,
          hospitalName: s.hospital.name,
          address: s.hospital.address,
          city: s.hospital.city,
          state: s.hospital.state,
          staffRole: s.role,
          specialty: s.specialty,
          dutyStatus: s.dutyStatus,
        })),
        affiliation: hospitalAffiliations[0]
          ? {
              hospitalId: hospitalAffiliations[0].hospital.id,
              hospitalName: hospitalAffiliations[0].hospital.name,
              address: hospitalAffiliations[0].hospital.address,
              city: hospitalAffiliations[0].hospital.city,
              state: hospitalAffiliations[0].hospital.state,
              staffRole: hospitalAffiliations[0].role,
              specialty: hospitalAffiliations[0].specialty,
              dutyStatus: hospitalAffiliations[0].dutyStatus,
            }
          : null,
        independentProfile: independentProfile
          ? {
              fullName: independentProfile.fullName,
              specialty: independentProfile.specialty,
              subSpecialties: independentProfile.subSpecialties,
              licenseNumber: independentProfile.licenseNumber,
              medicalCouncil: independentProfile.medicalCouncil,
              qualification: independentProfile.qualification,
              experienceYears: independentProfile.experienceYears,
              bio: independentProfile.bio,
              clinicAddress: independentProfile.clinicAddress,
              city: independentProfile.city,
              state: independentProfile.state,
              pincode: independentProfile.pincode,
              verificationStatus: independentProfile.verificationStatus,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateDoctorProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, email: true, name: true },
    });

    if (!user || user.role !== 'DOCTOR') {
      return res.status(403).json({ success: false, error: 'Doctor profile updates are restricted to doctor accounts.' });
    }

    const payload = doctorProfileUpdateSchema.parse(req.body || {});
    const { userId: _ignoredUserId, ...profileData } = payload;
    const cleanData = Object.fromEntries(
      Object.entries(profileData).filter(([, value]) => value !== undefined && value !== null)
    );

    const baseProfile = {
      fullName: cleanData.fullName || user.name || 'Doctor',
      specialty: cleanData.specialty || 'General Physician',
      subSpecialties: cleanData.subSpecialties || [],
      licenseNumber: cleanData.licenseNumber || `${user.email || user.id}-license`,
      medicalCouncil: cleanData.medicalCouncil || 'State Medical Council',
      qualification: cleanData.qualification || 'MBBS',
      experienceYears: Number(cleanData.experienceYears ?? 0),
      bio: cleanData.bio || null,
      clinicAddress: cleanData.clinicAddress || null,
      city: cleanData.city || null,
      state: cleanData.state || null,
      pincode: cleanData.pincode || null,
      location: cleanData.location || null,
      isIndependent: cleanData.isIndependent ?? true,
      verificationStatus: 'PENDING_ADMIN_REVIEW',
      rejectionReason: null,
      reviewedAt: null,
      reviewedBy: null,
    };

    const existing = await prisma.doctorProfile.findUnique({ where: { userId } });
    const profile = await prisma.doctorProfile.upsert({
      where: { userId },
      update: baseProfile,
      create: {
        userId,
        ...baseProfile,
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        specialty: true,
        subSpecialties: true,
        licenseNumber: true,
        medicalCouncil: true,
        qualification: true,
        experienceYears: true,
        bio: true,
        clinicAddress: true,
        city: true,
        state: true,
        pincode: true,
        isIndependent: true,
        verificationStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      success: true,
      message: existing ? 'Doctor profile updated and queued for review.' : 'Doctor profile created and queued for review.',
      profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues[0]?.message || 'Invalid doctor profile payload.' });
    }
    next(error);
  }
};

/**
 * GET /api/doctors/dashboard
 * Retrieves authoritative Doctor Dashboard statistics & recent assigned patients.
 */
exports.getDoctorDashboard = async (req, res, next) => {
  try {
    if (req.user.role === 'DOCTOR') {
      const userId = req.user.userId || req.user.id;
      const activeStaff = await prisma.hospitalStaff.findFirst({
        where: {
          OR: [
            { userId },
            ...(req.user.email ? [{ email: { equals: req.user.email, mode: 'insensitive' } }] : []),
          ],
          isActive: true,
        },
        select: { id: true, hospitalId: true },
      });

      if (!activeStaff) {
        return res.status(403).json({
          success: false,
          error: 'Active hospital affiliation is required to access emergency cases.',
          code: 'HOSPITAL_AFFILIATION_REQUIRED',
        });
      }
    }

    const baseScopeWhere = await buildDoctorScopeWhere(req.user);

    // 1. Assigned Active Cases Count (ACCEPTED, TRANSFER, TREATMENT, IN_PROGRESS)
    const assignedCount = await prisma.emergencyCase.count({
      where: {
        ...baseScopeWhere,
        status: { in: ['ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS'] },
      },
    });

    // 2. Critical Cases Count (Active assigned cases with severity RED or CRITICAL)
    const criticalCount = await prisma.emergencyCase.count({
      where: {
        ...baseScopeWhere,
        status: { in: ['ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS'] },
        severity: 'RED',
      },
    });

    // 3. Pending Cases Count (PENDING, MATCHING, HOSPITAL_REQUESTED)
    const pendingCount = await prisma.emergencyCase.count({
      where: {
        ...baseScopeWhere,
        status: { in: ['PENDING', 'MATCHING', 'HOSPITAL_REQUESTED'] },
      },
    });

    // 4. Completed Cases Count (CLOSED)
    const completedCount = await prisma.emergencyCase.count({
      where: {
        ...baseScopeWhere,
        status: 'CLOSED',
      },
    });

    // Fetch Recent Patients / Active Assigned Cases
    const recentCasesRaw = await prisma.emergencyCase.findMany({
      where: {
        ...baseScopeWhere,
        status: { in: ['ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS'] },
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            bloodGroup: true,
            phone: true,
          },
        },
        hospital: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentPatients = recentCasesRaw.map((c) => ({
      id: c.id,
      caseId: c.caseId,
      patientId: c.patientId,
      patientName: c.patient?.name || 'Emergency Patient',
      age: c.patient?.age || 0,
      gender: c.patient?.gender || 'Unspecified',
      bloodGroup: c.patient?.bloodGroup || 'O+',
      symptoms: c.symptoms || 'Emergency medical evaluation requested',
      severity: mapCaseSeverity(c.severity),
      rawSeverity: c.severity,
      emergencyType: c.emergencyType || 'MEDICAL',
      status: c.status,
      stage: mapCaseStage(c.status),
      hospitalName: c.hospital?.name || 'CareSetu Assigned Hospital',
      createdAt: c.createdAt,
      acceptedAt: c.acceptedAt,
    }));

    return res.json({
      success: true,
      stats: {
        assigned: assignedCount,
        critical: criticalCount,
        pending: pendingCount,
        completed: completedCount,
      },
      recentPatients,
    });
  } catch (error) {
    console.error('[DoctorController] getDoctorDashboard error:', error);
    next(error);
  }
};

/**
 * GET /api/doctors/cases
 * Retrieves active cases and retained history visible to the Doctor.
 */
exports.getDoctorCases = async (req, res, next) => {
  try {
    if (req.user.role === 'DOCTOR') {
      const userId = req.user.userId || req.user.id;
      const activeStaff = await prisma.hospitalStaff.findFirst({
        where: {
          OR: [
            { userId },
            ...(req.user.email ? [{ email: { equals: req.user.email, mode: 'insensitive' } }] : []),
          ],
          isActive: true,
        },
        select: { id: true, hospitalId: true },
      });

      if (!activeStaff) {
        return res.status(403).json({
          success: false,
          error: 'Active hospital affiliation is required to access emergency cases.',
          code: 'HOSPITAL_AFFILIATION_REQUIRED',
        });
      }
    }

    const baseScopeWhere = await buildDoctorScopeWhere(req.user);

    const include = {
      patient: {
        select: {
          id: true,
          name: true,
          age: true,
          gender: true,
          bloodGroup: true,
          allergies: true,
          medicalConditions: true,
          medications: true,
        },
      },
      hospital: {
        select: { id: true, name: true },
      },
    };
    const [casesRaw, completedCasesRaw] = await Promise.all([
      prisma.emergencyCase.findMany({
        where: { ...baseScopeWhere, status: { in: ACTIVE_OPERATIONAL_STATUSES } },
        include,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.emergencyCase.findMany({
        where: { ...baseScopeWhere, status: { in: CASE_HISTORY_STATUSES } },
        include,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const formatCase = (c) => ({
      id: c.id,
      caseId: c.caseId,
      patientId: c.patientId,
      patientName: c.patient?.name || 'Emergency Patient',
      age: c.patient?.age || 0,
      gender: c.patient?.gender || 'Unspecified',
      bloodGroup: c.patient?.bloodGroup || 'O+',
      symptoms: c.symptoms || 'Medical Emergency',
      severity: mapCaseSeverity(c.severity),
      rawSeverity: c.severity,
      emergencyType: c.emergencyType || 'MEDICAL',
      status: c.status,
      stage: mapCaseStage(c.status),
      hospitalName: c.hospital?.name || 'CareSetu Facility',
      createdAt: c.createdAt,
    });

    return res.json({
      success: true,
      cases: casesRaw.map(formatCase),
      caseHistory: completedCasesRaw.map(formatCase),
    });
  } catch (error) {
    console.error('[DoctorController] getDoctorCases error:', error);
    next(error);
  }
};

/**
 * GET /api/doctors/cases/:id
 * Retrieves detail for a specific case.
 */
exports.getDoctorCaseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;
    const role = req.user.role;

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: {
        OR: [{ id: id }, { caseId: id }],
      },
      include: {
        patient: true,
        hospital: { select: { id: true, name: true, address: true, phone: true } },
        hospitalRequests: { select: { hospitalId: true, status: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found', code: 'NOT_FOUND' });
    }

    if (role === 'DOCTOR') {
      if (!(await isDirectlyAssigned(req.user, emergencyCase))) {
        return res.status(403).json({
          success: false,
          error: 'You are not the doctor assigned to this emergency case.',
          code: 'FORBIDDEN_CASE_ACCESS',
        });
      }
    } else if (role === 'HOSPITAL') {
      const docHospId = await resolveDoctorHospitalId(req.user);
      const isHospitalCase = docHospId && (
        emergencyCase.hospitalId === docHospId ||
        (!emergencyCase.hospitalId && (emergencyCase.hospitalRequests || []).some((r) => r.hospitalId === docHospId && ['PENDING', 'ACCEPTED'].includes(r.status)))
      );

      if (!isHospitalCase) {
        return res.status(403).json({
          success: false,
          error: 'You do not have authorization to view this emergency case.',
          code: 'FORBIDDEN_CASE_ACCESS',
        });
      }
    }

    const patientData = emergencyCase.patient
      ? {
          id: emergencyCase.patient.id,
          name: emergencyCase.patient.name,
          age: emergencyCase.patient.age,
          gender: emergencyCase.patient.gender,
          bloodGroup: emergencyCase.patient.bloodGroup || 'O+',
          allergies: emergencyCase.patient.allergies ? emergencyCase.patient.allergies.split(',').map((s) => s.trim()) : [],
          medications: emergencyCase.patient.medications ? emergencyCase.patient.medications.split(',').map((s) => s.trim()) : [],
          medicalConditions: emergencyCase.patient.medicalConditions || 'None reported',
        }
      : null;

    const formattedCase = {
      id: emergencyCase.id,
      caseId: emergencyCase.caseId,
      patientId: emergencyCase.patientId,
      patientName: emergencyCase.patient?.name || 'Emergency Patient',
      symptoms: emergencyCase.symptoms,
      severity: mapCaseSeverity(emergencyCase.severity),
      rawSeverity: emergencyCase.severity,
      requiredCapability: emergencyCase.emergencyType || 'General Medical Care',
      emergencyType: emergencyCase.emergencyType,
      status: emergencyCase.status,
      stage: mapCaseStage(emergencyCase.status),
      hospitalName: emergencyCase.hospital?.name || 'CareSetu Facility',
      assignedDoctor: emergencyCase.medicalSummary?.assignedDoctor || null,
      createdAt: emergencyCase.createdAt,
    };

    return res.json({
      success: true,
      emergencyCase: formattedCase,
      case: formattedCase,
      patient: patientData,
    });
  } catch (error) {
    console.error('[DoctorController] getDoctorCaseById error:', error);
    next(error);
  }
};

/**
 * PUT /api/doctors/cases/:id/status
 * Updates the emergency case status (e.g. TREATMENT, IN_PROGRESS, CLOSED).
 */
exports.updateDoctorCaseStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.userId || req.user.id;
    const role = req.user.role;

    let targetStatus = String(status || '').toUpperCase();
    if (targetStatus === 'COMPLETED' || targetStatus === 'RESOLVED') {
      targetStatus = 'CLOSED';
    }

    const validStatuses = ['ACCEPTED', 'TRANSFER', 'TREATMENT', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'];
    if (!validStatuses.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status '${status}'. Valid statuses are: ${validStatuses.join(', ')}`,
      });
    }

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id }, { caseId: id }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found' });
    }

    let authorized = role === 'ADMIN';
    if (role === 'DOCTOR') {
      authorized = await isDirectlyAssigned(req.user, emergencyCase);
    } else if (role === 'HOSPITAL') {
      let hospitalId = req.user.hospitalId;
      if (!hospitalId) {
        const hospital = await prisma.hospital.findFirst({
          where: { OR: [{ userId }, { email: req.user.email }] },
          select: { id: true },
        });
        hospitalId = hospital?.id;
      }
      authorized = Boolean(hospitalId && emergencyCase.hospitalId === hospitalId);
    }

    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Unauthorized to update this emergency case.' });
    }

    if (!canActorTransitionCase(role, targetStatus)) {
      return res.status(403).json({
        success: false,
        error: targetStatus === 'CLOSED'
          ? 'Doctors are not permitted to close hospital emergency cases. Case closure must be completed by hospital administration.'
          : 'Your role is not permitted to perform this case transition.',
        code: 'FORBIDDEN_CASE_TRANSITION',
      });
    }

    if (String(emergencyCase.status).toUpperCase() === targetStatus) {
      return res.json({
        success: true,
        message: `Case status is already ${targetStatus}`,
        case: emergencyCase,
      });
    }

    if (!canTransitionCase(emergencyCase.status, targetStatus)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition case from ${emergencyCase.status} to ${targetStatus}.`,
        code: 'INVALID_CASE_TRANSITION',
      });
    }

    // Closure safety gate: consistent with the emergency update-status endpoint
    // and the hospital close endpoint — a case may only be closed when it is in
    // TREATMENT with an APPROVED diagnosis report.
    if (targetStatus === 'CLOSED' && !isCaseEligibleForClosure(emergencyCase)) {
      const diagStatus = emergencyCase.medicalSummary?.diagnosisReport?.status;
      return res.status(422).json({
        success: false,
        error: diagStatus !== 'APPROVED'
          ? `Case cannot be closed without an approved diagnosis report. Current diagnosis status: ${diagStatus || 'NONE'}.`
          : 'Case cannot be closed. Must be in TREATMENT status before closure.',
        code: diagStatus !== 'APPROVED' ? 'DIAGNOSIS_NOT_APPROVED' : 'CASE_NOT_READY_FOR_CLOSURE',
      });
    }

    const updateData = {
      status: targetStatus,
    };
    if (targetStatus === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    let updatedCase;
    try {
      updatedCase = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.emergencyCase.updateMany({
          where: { id: emergencyCase.id, status: emergencyCase.status },
          data: updateData,
        });
        if (updateResult.count !== 1) {
          const error = new Error('Case status changed before this transition could be applied.');
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
            details: { caseId: result.caseId, previousStatus: emergencyCase.status, newStatus: targetStatus },
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

    const { emitToUser, emitToHospital, emitToCaseRoom } = require('../utils/emergency.events');
    const eventPayload = {
      caseId: updatedCase.caseId,
      id: updatedCase.id,
      status: updatedCase.status,
      hospital: updatedCase.hospital,
      assignedDoctor: emergencyCase.medicalSummary?.assignedDoctor || null,
      timestamp: new Date().toISOString(),
    };

    emitToCaseRoom(updatedCase.caseId, 'emergency_status_updated', eventPayload);
    emitToCaseRoom(updatedCase.id, 'emergency_status_updated', eventPayload);
    if (updatedCase.hospitalId) {
      emitToHospital(updatedCase.hospitalId, 'emergency_status_updated', eventPayload);
    }
    if (updatedCase.patient?.userId) {
      emitToUser(updatedCase.patient.userId, 'emergency_status_updated', eventPayload);
    }
    const assignedDoctorId = emergencyCase.medicalSummary?.assignedDoctor?.id;
    if (assignedDoctorId) {
      emitToUser(assignedDoctorId, 'emergency_status_updated', eventPayload);
    }

    return res.json({
      success: true,
      message: `Case status updated to ${targetStatus}`,
      case: updatedCase,
    });
  } catch (error) {
    console.error('[DoctorController] updateDoctorCaseStatus error:', error);
    next(error);
  }
};

/**
 * GET /api/doctors/cases/:id/health-pack
 * Retrieves authorized Health Pack snapshot for the patient.
 */
exports.getDoctorCaseHealthPack = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'DOCTOR') {
      const emergencyCase = await prisma.emergencyCase.findFirst({
        where: { OR: [{ id }, { caseId: id }] },
      });
      if (!emergencyCase) {
        return res.status(404).json({ success: false, error: 'Emergency case not found' });
      }
      if (!(await isDirectlyAssigned(req.user, emergencyCase))) {
        return res.status(403).json({
          success: false,
          error: 'You are not the doctor assigned to this emergency case.',
          code: 'FORBIDDEN_CASE_ACCESS',
        });
      }
    }

    const userId = req.user.userId || req.user.id;
    const healthPack = await healthPackService.getDecryptedHealthPackForCase(id, userId, req.user.role);
    return res.json({
      success: true,
      healthPack: {
        id: healthPack.id,
        expiresAt: healthPack.expiresAt,
        ...healthPack.healthData,
      },
    });
  } catch (error) {
    if (error.message?.includes('Unauthorized') || error.message?.includes('expired') || error.message?.includes('closed') || error.message?.includes('concluded')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    if (error.message?.toLowerCase().includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('[DoctorController] getDoctorCaseHealthPack error:', error);
    next(error);
  }
};

/**
 * GET /api/doctor/independent/verification-status
 * Returns only the authenticated doctor's own verification status.
 * Omits internal reviewer identity (reviewedBy) for privacy & security.
 * Does NOT require prior approval.
 */
exports.getDoctorVerificationStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        licenseNumber: true,
        specialty: true,
        verificationStatus: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const activeHospitalStaff = await prisma.hospitalStaff.findFirst({
      where: {
        OR: [
          { userId },
          ...(req.user.email ? [{ email: { equals: req.user.email, mode: 'insensitive' } }] : []),
        ],
        isActive: true,
      },
      include: {
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!profile) {
      return res.json({
        success: true,
        verificationStatus: 'NOT_STARTED',
        message: 'Independent practitioner profile not started.',
        hasHospitalAffiliation: Boolean(activeHospitalStaff),
        hospitalAffiliation: activeHospitalStaff
          ? {
              hospitalId: activeHospitalStaff.hospitalId,
              hospitalName: activeHospitalStaff.hospital?.name,
              staffRole: activeHospitalStaff.role,
            }
          : null,
        profile: null,
      });
    }

    return res.json({
      success: true,
      verificationStatus: profile.verificationStatus,
      rejectionReason: profile.rejectionReason,
      reviewedAt: profile.reviewedAt,
      hasHospitalAffiliation: Boolean(activeHospitalStaff),
      hospitalAffiliation: activeHospitalStaff
        ? {
            hospitalId: activeHospitalStaff.hospitalId,
            hospitalName: activeHospitalStaff.hospital?.name,
            staffRole: activeHospitalStaff.role,
          }
        : null,
      profile: {
        id: profile.id,
        fullName: profile.fullName,
        licenseNumber: profile.licenseNumber,
        medicalCouncil: profile.medicalCouncil,
        specialty: profile.specialty,
        qualification: profile.qualification,
        experienceYears: profile.experienceYears,
        clinicAddress: profile.clinicAddress,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        bio: profile.bio,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error('[DoctorController] getDoctorVerificationStatus error:', error);
    next(error);
  }
};

/**
 * GET /api/doctors/independent/dashboard
 * Retrieves authoritative practice metrics for verified Independent Doctors.
 * Excludes hospital-only emergency triage data.
 */
exports.getIndependentDoctorDashboard = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const profile = await prisma.doctorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'DOCTOR_PROFILE_NOT_FOUND',
        message: 'No independent doctor profile found for this user.',
      });
    }

    return res.json({
      success: true,
      practice: {
        id: profile.id,
        fullName: profile.fullName,
        licenseNumber: profile.licenseNumber,
        medicalCouncil: profile.medicalCouncil,
        specialty: profile.specialty,
        subSpecialties: profile.subSpecialties,
        experienceYears: profile.experienceYears,
        qualification: profile.qualification,
        bio: profile.bio,
        clinicAddress: profile.clinicAddress,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        verificationStatus: profile.verificationStatus,
        isIndependent: profile.isIndependent,
        createdAt: profile.createdAt,
      },
      stats: {
        consultations: 0,
        activePatients: 0,
        pendingAppointments: 0,
        completedSessions: 0,
      },
      notice: 'Independent Clinical Practice Workspace. Hospital emergency dispatch, trauma queues, and Health Pack decryption are strictly restricted to licensed hospital facilities.',
    });
  } catch (error) {
    console.error('[DoctorController] getIndependentDoctorDashboard error:', error);
    next(error);
  }
};

/**
 * POST /api/doctors/cases/:id/diagnosis
 * Submit or amend diagnosis report for an assigned emergency case.
 */
exports.submitDoctorDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      primaryDiagnosis,
      condition,
      clinicalNotes,
      notes,
      summary,
      treatmentPlan,
      prescribedTreatment,
      action = 'SUBMIT',
      expectedVersion,
    } = req.body;

    const diagCondition = String(primaryDiagnosis || condition || '').trim();
    const diagSummary = String(clinicalNotes || notes || summary || '').trim();
    const diagTreatmentPlan = String(treatmentPlan || prescribedTreatment || '').trim();

    if (!diagCondition || diagCondition.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Primary diagnosis / condition is required (minimum 3 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!diagSummary || diagSummary.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Clinical notes / summary is required (minimum 5 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id }, { caseId: id }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found', code: 'CASE_NOT_FOUND' });
    }

    if (['CLOSED', 'CANCELLED'].includes(String(emergencyCase.status).toUpperCase())) {
      return res.status(403).json({
        success: false,
        error: `Cannot submit diagnosis for a ${emergencyCase.status} case.`,
        code: 'CASE_ALREADY_CLOSED',
      });
    }

    const role = req.user.role;
    let authorized = role === 'ADMIN';
    if (role === 'DOCTOR') {
      authorized = await isDirectlyAssigned(req.user, emergencyCase);
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Only the currently assigned doctor with active hospital affiliation may submit diagnosis reports.',
        code: 'FORBIDDEN_CASE_ACCESS',
      });
    }

    const currentSummary = (typeof emergencyCase.medicalSummary === 'object' && emergencyCase.medicalSummary !== null)
      ? emergencyCase.medicalSummary
      : {};
    const existingReport = currentSummary.diagnosisReport || null;

    if (expectedVersion !== undefined && expectedVersion !== null && existingReport?.version) {
      if (Number(expectedVersion) !== Number(existingReport.version)) {
        return res.status(409).json({
          success: false,
          error: `Diagnosis report version conflict. Expected version ${expectedVersion}, but current version is ${existingReport.version}.`,
          code: 'REPORT_VERSION_CONFLICT',
          currentVersion: existingReport.version,
        });
      }
    }

    const nextVersion = (existingReport?.version || 0) + 1;
    const targetStatus = action === 'DRAFT' ? 'DRAFT' : 'SUBMITTED_FOR_REVIEW';

    const previousRevisions = Array.isArray(existingReport?.revisions)
      ? [...existingReport.revisions]
      : [];

    if (existingReport && existingReport.status) {
      previousRevisions.push({
        version: existingReport.version || 1,
        condition: existingReport.condition,
        summary: existingReport.summary,
        treatmentPlan: existingReport.treatmentPlan,
        status: existingReport.status,
        submittedAt: existingReport.submittedAt,
        reviewedAt: existingReport.reviewedAt || null,
        reviewedBy: existingReport.reviewedBy || null,
        reviewFeedback: existingReport.reviewFeedback || null,
      });
    }

    const doctorUser = req.user;
    const updatedDiagnosisReport = {
      id: existingReport?.id || `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      version: nextVersion,
      status: targetStatus,
      condition: diagCondition,
      summary: diagSummary,
      treatmentPlan: diagTreatmentPlan,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      submittedBy: {
        id: doctorUser.userId || doctorUser.id,
        name: doctorUser.name || 'Attending Physician',
        email: doctorUser.email,
        specialty: emergencyCase.medicalSummary?.assignedDoctor?.specialty || 'General Practice',
      },
      revisions: previousRevisions,
      reviewFeedback: null,
      reviewedBy: null,
      reviewedAt: null,
    };

    const updatedMedicalSummary = {
      ...currentSummary,
      diagnosisReport: updatedDiagnosisReport,
    };

    let updatedCase;
    try {
      updatedCase = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.emergencyCase.updateMany({
          where: { id: emergencyCase.id, status: emergencyCase.status },
          data: { medicalSummary: updatedMedicalSummary },
        });
        if (updateResult.count !== 1) {
          const error = new Error('Case status or ownership changed before diagnosis could be saved.');
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
            userId: doctorUser.userId || doctorUser.id,
            action: 'EMERGENCY_UPDATED',
            entity: 'EmergencyCase',
            entityId: result.id,
            details: {
              event: 'DIAGNOSIS_SUBMITTED',
              caseId: result.caseId,
              version: nextVersion,
              status: targetStatus,
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
      diagnosisReport: updatedDiagnosisReport,
      timestamp: new Date().toISOString(),
    };
    if (updatedCase.hospitalId) {
      emitToHospital(updatedCase.hospitalId, 'diagnosis_submitted', eventPayload);
    }
    emitToCaseRoom(updatedCase.caseId, 'diagnosis_submitted', eventPayload);
    emitToCaseRoom(updatedCase.id, 'diagnosis_submitted', eventPayload);
    if (updatedCase.patient?.userId) {
      emitToUser(updatedCase.patient.userId, 'diagnosis_submitted', eventPayload);
    }

    return res.json({
      success: true,
      message: targetStatus === 'DRAFT'
        ? 'Diagnosis draft saved successfully.'
        : 'Diagnosis report submitted for hospital review.',
      diagnosisReport: updatedDiagnosisReport,
    });
  } catch (error) {
    console.error('[DoctorController] submitDoctorDiagnosis error:', error);
    next(error);
  }
};

/**
 * GET /api/doctors/cases/:id/diagnosis
 * Fetch current diagnosis report, revision history, and review details.
 */
exports.getDoctorDiagnosis = async (req, res, next) => {
  try {
    const { id } = req.params;
    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id }, { caseId: id }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found', code: 'CASE_NOT_FOUND' });
    }

    const role = req.user.role;
    let authorized = role === 'ADMIN';
    if (role === 'DOCTOR') {
      authorized = await isDirectlyAssigned(req.user, emergencyCase);
    } else if (role === 'HOSPITAL') {
      let hospitalId = req.user.hospitalId;
      if (!hospitalId) {
        const hospital = await prisma.hospital.findFirst({
          where: { OR: [{ userId: req.user.userId || req.user.id }, { email: req.user.email }] },
          select: { id: true },
        });
        hospitalId = hospital?.id;
      }
      authorized = Boolean(hospitalId && emergencyCase.hospitalId === hospitalId);
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view diagnosis for this emergency case.',
        code: 'FORBIDDEN_CASE_ACCESS',
      });
    }

    const summary = emergencyCase.medicalSummary || {};
    return res.json({
      success: true,
      caseId: emergencyCase.caseId,
      status: emergencyCase.status,
      diagnosisReport: summary.diagnosisReport || null,
      treatmentNotes: summary.treatmentNotes || [],
    });
  } catch (error) {
    console.error('[DoctorController] getDoctorDiagnosis error:', error);
    next(error);
  }
};

/**
 * POST /api/doctors/cases/:id/treatment-notes
 * Record treatment progress notes and vitals after diagnosis is approved.
 */
exports.addDoctorTreatmentNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note, vitals } = req.body;

    const trimmedNote = String(note || '').trim();
    if (!trimmedNote || trimmedNote.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Treatment note is required (minimum 3 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id }, { caseId: id }] },
      include: {
        patient: { select: { id: true, userId: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });

    if (!emergencyCase) {
      return res.status(404).json({ success: false, error: 'Emergency case not found', code: 'CASE_NOT_FOUND' });
    }

    if (['CLOSED', 'CANCELLED'].includes(String(emergencyCase.status).toUpperCase())) {
      return res.status(403).json({
        success: false,
        error: `Cannot add treatment notes for a ${emergencyCase.status} case.`,
        code: 'CASE_ALREADY_CLOSED',
      });
    }

    const role = req.user.role;
    let authorized = role === 'ADMIN';
    if (role === 'DOCTOR') {
      authorized = await isDirectlyAssigned(req.user, emergencyCase);
    }

    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Only the currently assigned doctor with active hospital affiliation may record treatment notes.',
        code: 'FORBIDDEN_CASE_ACCESS',
      });
    }

    const currentSummary = (typeof emergencyCase.medicalSummary === 'object' && emergencyCase.medicalSummary !== null)
      ? emergencyCase.medicalSummary
      : {};
    const existingNotes = Array.isArray(currentSummary.treatmentNotes) ? [...currentSummary.treatmentNotes] : [];

    const newNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      note: trimmedNote,
      vitals: vitals && typeof vitals === 'object' ? vitals : null,
      doctorId: req.user.userId || req.user.id,
      doctorName: req.user.name || 'Attending Physician',
      recordedAt: new Date().toISOString(),
    };

    existingNotes.push(newNote);

    const updatedMedicalSummary = {
      ...currentSummary,
      treatmentNotes: existingNotes,
    };

    let updatedCase;
    try {
      updatedCase = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.emergencyCase.updateMany({
          where: { id: emergencyCase.id, status: emergencyCase.status },
          data: { medicalSummary: updatedMedicalSummary },
        });
        if (updateResult.count !== 1) {
          const error = new Error('Case status or ownership changed before treatment note could be saved.');
          error.status = 409;
          error.code = 'CASE_STATUS_CONFLICT';
          throw error;
        }
        const result = await tx.emergencyCase.findUnique({
          where: { id: emergencyCase.id },
        });
        await tx.auditLog.create({
          data: {
            userId: req.user.userId || req.user.id,
            action: 'EMERGENCY_UPDATED',
            entity: 'EmergencyCase',
            entityId: result.id,
            details: {
              event: 'TREATMENT_NOTE_ADDED',
              caseId: result.caseId,
              noteId: newNote.id,
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

    const { emitToHospital, emitToCaseRoom } = require('../utils/emergency.events');
    const eventPayload = {
      caseId: updatedCase.caseId,
      id: updatedCase.id,
      note: newNote,
      timestamp: new Date().toISOString(),
    };
    if (updatedCase.hospitalId) {
      emitToHospital(updatedCase.hospitalId, 'treatment_note_added', eventPayload);
    }
    emitToCaseRoom(updatedCase.caseId, 'treatment_note_added', eventPayload);
    emitToCaseRoom(updatedCase.id, 'treatment_note_added', eventPayload);

    return res.json({
      success: true,
      message: 'Treatment progress note recorded successfully.',
      note: newNote,
      treatmentNotes: existingNotes,
    });
  } catch (error) {
    console.error('[DoctorController] addDoctorTreatmentNote error:', error);
    next(error);
  }
};

exports.isDirectlyAssigned = isDirectlyAssigned;

