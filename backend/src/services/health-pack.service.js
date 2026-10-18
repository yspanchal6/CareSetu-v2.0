const prisma = require('../config/prisma');
const { encrypt, decrypt } = require('../utils/crypto');

class HealthPackService {
  /**
   * Creates or updates an encrypted HealthPack for a patient.
   */
  async createHealthPack(patientId, healthData) {
    const rawString = JSON.stringify(healthData);
    
    // Encrypt the data with AES-256-GCM
    const { iv, encryptedData } = encrypt(rawString);
    
    // Set expiration to 1 year for the pack itself
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // 1. Create HealthPack record
    const healthPack = await prisma.healthPack.create({
      data: {
        patientId,
        encryptedData,
        iv,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    // 2. Update Patient profile with explicit confirmed medical fields
    try {
      await prisma.patient.update({
        where: { id: patientId },
        data: {
          bloodGroup: healthData.bloodGroup || undefined,
          allergies: healthData.allergies || undefined,
          medications: healthData.medications || undefined,
          conditions: healthData.conditions || undefined,
          medicalConditions: healthData.conditions || undefined,
          heartCondition: healthData.heartCondition || 'UNKNOWN',
          diabetesStatus: healthData.diabetesStatus || 'UNKNOWN',
          hypertensionStatus: healthData.hypertensionStatus || 'UNKNOWN',
        },
      });
    } catch (patientErr) {
      console.warn('[HealthPack] Patient profile update warning:', patientErr.message);
    }

    // 3. Link unlinked documents to this HealthPack if documentIds provided or available
    try {
      if (Array.isArray(healthData.documentIds) && healthData.documentIds.length > 0) {
        await prisma.medicalDocument.updateMany({
          where: {
            id: { in: healthData.documentIds },
            patientId,
          },
          data: { healthPackId: healthPack.id },
        });
      } else {
        // Link all patient documents currently unassigned
        await prisma.medicalDocument.updateMany({
          where: { patientId, healthPackId: null },
          data: { healthPackId: healthPack.id },
        });
      }
    } catch (docErr) {
      console.warn('[HealthPack] Document link warning:', docErr.message);
    }

    return healthPack;
  }

  /**
   * Smallest safe synchronization mechanism: after a patient updates their
   * medical profile, re-encrypt their latest ACTIVE HealthPack so hospitals
   * never read a stale/empty snapshot. Pack-only extension fields (surgeries,
   * notes, etc.) are preserved. If no ACTIVE pack exists, one is generated
   * from the current profile.
   */
  async refreshHealthPackFromPatient(patientId) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return null;

    const isMeaningful = (v) => {
      if (v == null) return false;
      const s = String(v).trim();
      return s.length > 0 && s !== 'NOT_PROVIDED' && s !== 'UNKNOWN';
    };

    let healthPack = await prisma.healthPack.findFirst({
      where: { patientId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!healthPack) {
      return this.createHealthPack(patientId, {
        bloodGroup: patient.bloodGroup || 'NOT_PROVIDED',
        allergies: patient.allergies || 'NOT_PROVIDED',
        medications: patient.medications || 'NOT_PROVIDED',
        conditions: patient.conditions || patient.medicalConditions || 'NOT_PROVIDED',
        medicalConditions: patient.medicalConditions || patient.conditions || 'NOT_PROVIDED',
        heartCondition: patient.heartCondition || 'UNKNOWN',
        diabetesStatus: patient.diabetesStatus || 'UNKNOWN',
        hypertensionStatus: patient.hypertensionStatus || 'UNKNOWN',
      });
    }

    // Preserve pack-only extension fields not managed by the patient profile.
    let existing = {};
    try {
      existing = JSON.parse(decrypt(healthPack.encryptedData, healthPack.iv)) || {};
    } catch (err) {
      existing = {};
    }

    const project = (profileValue, existingValue, fallback) => {
      if (isMeaningful(profileValue)) return String(profileValue).trim();
      if (isMeaningful(existingValue)) return String(existingValue).trim();
      return fallback;
    };

    const conditionsValue = patient.conditions || patient.medicalConditions || null;

    const merged = {
      ...existing,
      bloodGroup: project(patient.bloodGroup, existing.bloodGroup, 'NOT_PROVIDED'),
      allergies: project(patient.allergies, existing.allergies, 'NOT_PROVIDED'),
      medications: project(patient.medications, existing.medications, 'NOT_PROVIDED'),
      conditions: project(conditionsValue, existing.conditions || existing.medicalConditions, 'NOT_PROVIDED'),
      medicalConditions: project(conditionsValue, existing.medicalConditions || existing.conditions, 'NOT_PROVIDED'),
      heartCondition: project(patient.heartCondition, existing.heartCondition, 'UNKNOWN'),
      diabetesStatus: project(patient.diabetesStatus, existing.diabetesStatus, 'UNKNOWN'),
      hypertensionStatus: project(patient.hypertensionStatus, existing.hypertensionStatus, 'UNKNOWN'),
    };

    const { iv, encryptedData } = encrypt(JSON.stringify(merged));

    const updated = await prisma.healthPack.update({
      where: { id: healthPack.id },
      data: { encryptedData, iv },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'HEALTH_PACK_UPDATED',
          entity: 'HealthPack',
          entityId: healthPack.id,
          details: { event: 'SYNCED_FROM_PATIENT_PROFILE', patientId },
        },
      });
    } catch (auditErr) {
      console.warn('[HealthPack] Profile sync audit warning:', auditErr.message);
    }

    return updated;
  }

  async resolveUserHospitalId(userId, role) {
    if (!userId) return null;
    if (role === 'HOSPITAL') {
      const hosp = await prisma.hospital.findFirst({ where: { userId } });
      return hosp?.id || null;
    }
    if (role === 'DOCTOR') {
      const userObj = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      const staff = await prisma.hospitalStaff.findFirst({
        where: {
          OR: [
            ...(userObj?.email ? [{ email: { equals: userObj.email, mode: 'insensitive' } }] : []),
            { id: userId },
          ],
          isActive: true,
        },
        select: { hospitalId: true },
      });
      if (staff?.hospitalId) return staff.hospitalId;

      const hosp = await prisma.hospital.findFirst({
        where: {
          OR: [
            { userId },
            ...(userObj?.email ? [{ email: { equals: userObj.email, mode: 'insensitive' } }] : []),
          ],
        },
        select: { id: true },
      });
      return hosp?.id || null;
    }
    return null;
  }

  async shareHealthPackWithHospital(patientId, hospitalId, hospitalUserId, baseTimestamp = null) {
    let healthPack = await prisma.healthPack.findFirst({
      where: { patientId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!healthPack) {
      // Auto-generate basic active HealthPack from Patient profile
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });
      const initialData = {
        bloodGroup: patient?.bloodGroup || 'NOT_PROVIDED',
        allergies: patient?.allergies || 'NOT_PROVIDED',
        medications: patient?.medications || 'NOT_PROVIDED',
        conditions: patient?.conditions || patient?.medicalConditions || 'NOT_PROVIDED',
        heartCondition: patient?.heartCondition || 'UNKNOWN',
        diabetesStatus: patient?.diabetesStatus || 'UNKNOWN',
        hypertensionStatus: patient?.hypertensionStatus || 'UNKNOWN',
      };
      healthPack = await this.createHealthPack(patientId, initialData);
    }

    const whereClause = hospitalId
      ? { healthPackId: healthPack.id, sharedWithHospitalId: hospitalId }
      : { healthPackId: healthPack.id, sharedWithUserId: hospitalUserId };

    const existingShare = await prisma.healthPackShare.findFirst({
      where: whereClause,
    });

    // Authoritative calculation: baseTimestamp (e.g. acceptedAt / createdAt) + 24 hours
    const baseDate = baseTimestamp ? new Date(baseTimestamp) : new Date();
    const newExpiresAt = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

    if (existingShare) {
      if (baseTimestamp || (existingShare.expiresAt && new Date(existingShare.expiresAt) <= new Date()) || existingShare.status !== 'ACTIVE') {
        const updatedShare = await prisma.healthPackShare.update({
          where: { id: existingShare.id },
          data: {
            expiresAt: newExpiresAt,
            status: 'ACTIVE',
            consentGranted: true,
            sharedAt: baseDate,
          },
        });
        return updatedShare;
      }
      return existingShare;
    }

    const share = await prisma.healthPackShare.create({
      data: {
        healthPackId: healthPack.id,
        sharedWithHospitalId: hospitalId || null,
        sharedWithUserId: hospitalUserId,
        consentGranted: true,
        expiresAt: newExpiresAt,
        status: 'ACTIVE',
        sharedAt: baseDate,
      },
    });

    return share;
  }

  /**
   * Decrypts and retrieves a HealthPack for an authorized hospital or doctor using caseId.
   */
  async getDecryptedHealthPackForCase(caseId, requestingUserId, userRole = 'HOSPITAL') {
    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseId }, { caseId }] },
    });

    if (!emergencyCase) {
      throw new Error('Emergency case not found.');
    }

    let isAuthorized = false;
    let authorizedHospitalId = null;
    let hospitalName = 'CareSetu Facility';

    if (userRole === 'ADMIN') {
      isAuthorized = true;
    } else if (userRole === 'HOSPITAL') {
      const hospital = await prisma.hospital.findFirst({ where: { userId: requestingUserId } });
      if (!hospital) {
        throw new Error('Hospital profile not found.');
      }
      authorizedHospitalId = hospital.id;
      hospitalName = hospital.name;

      const isAssignedHospital = emergencyCase.hospitalId === hospital.id;
      let isRequestedHospital = false;
      if (!isAssignedHospital) {
        const request = await prisma.hospitalRequest.findFirst({
          where: {
            emergencyCaseId: emergencyCase.id,
            hospitalId: hospital.id,
            status: { in: ['ACCEPTED', 'PENDING'] },
          },
        });
        if (request) isRequestedHospital = true;
      }

      isAuthorized = isAssignedHospital || isRequestedHospital;
      if (!isAuthorized) {
        throw new Error('Unauthorized: Hospital is not assigned or requested for this emergency case.');
      }
    } else if (userRole === 'DOCTOR') {
      const doctorUser = await prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { id: true, email: true },
      });
      if (!doctorUser) {
        throw new Error('Doctor user profile not found.');
      }

      if (!emergencyCase.hospitalId) {
        throw new Error('Unauthorized: Emergency case has no hospital affiliation.');
      }

      const userEmail = String(doctorUser.email || '').toLowerCase();

      // Enforce active hospital affiliation at emergencyCase.hospitalId
      const activeStaff = await prisma.hospitalStaff.findFirst({
        where: {
          hospitalId: emergencyCase.hospitalId,
          OR: [
            { userId: requestingUserId },
            ...(userEmail ? [{ email: { equals: userEmail, mode: 'insensitive' } }] : []),
          ],
          isActive: true,
        },
        select: { id: true },
      });

      if (!activeStaff) {
        throw new Error('Unauthorized: Doctor has no active hospital affiliation with this facility.');
      }

      // Enforce direct assignment to this emergency case
      const assignment = emergencyCase.medicalSummary?.assignedDoctor;
      const isAssigned = assignment && (
        assignment.id === requestingUserId ||
        assignment.id === activeStaff.id ||
        (assignment.email && String(assignment.email).toLowerCase() === userEmail) ||
        (emergencyCase.assignedDoctorId && (emergencyCase.assignedDoctorId === requestingUserId || emergencyCase.assignedDoctorId === activeStaff.id))
      );

      if (!isAssigned) {
        throw new Error('Unauthorized: Doctor is not assigned to this emergency case.');
      }

      isAuthorized = true;
      authorizedHospitalId = emergencyCase.hospitalId;
      if (authorizedHospitalId) {
        const hospital = await prisma.hospital.findUnique({
          where: { id: authorizedHospitalId },
          select: { name: true },
        });
        if (hospital) hospitalName = hospital.name;
      }
    } else {
      throw new Error('Unauthorized access: Role is not permitted to view HealthPack for case.');
    }

    // Retrieve active HealthPack for the patient
    let healthPack = await prisma.healthPack.findFirst({
      where: { patientId: emergencyCase.patientId, status: 'ACTIVE' },
      include: { shares: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!healthPack) {
      const patient = await prisma.patient.findUnique({ where: { id: emergencyCase.patientId } });
      const initialData = {
        name: patient?.name || 'Patient',
        bloodGroup: patient?.bloodGroup || 'NOT_PROVIDED',
        allergies: patient?.allergies || 'None reported',
        medications: patient?.currentMedications || 'None reported',
        conditions: patient?.conditions || patient?.medicalConditions || 'NOT_PROVIDED',
        heartCondition: patient?.heartCondition || 'UNKNOWN',
        diabetesStatus: patient?.diabetesStatus || 'UNKNOWN',
        hypertensionStatus: patient?.hypertensionStatus || 'UNKNOWN',
      };
      healthPack = await this.createHealthPack(emergencyCase.patientId, initialData);
      healthPack = await prisma.healthPack.findUnique({
        where: { id: healthPack.id },
        include: { shares: true },
      });
    }

    // Check HealthPack overall expiration
    if (healthPack.expiresAt && new Date(healthPack.expiresAt) <= new Date()) {
      throw new Error('Unauthorized access: HealthPack has expired.');
    }

    // Find existing share record for this hospital or user
    const existingShare = (healthPack.shares || []).find(
      (s) =>
        (authorizedHospitalId && String(s.sharedWithHospitalId) === String(authorizedHospitalId)) ||
        String(s.sharedWithUserId) === String(requestingUserId)
    );

    const inactiveCaseStatuses = ['CLOSED', 'CANCELLED', 'RESOLVED', 'EXPIRED', 'REJECTED'];
    const isCaseActive = !inactiveCaseStatuses.includes(String(emergencyCase.status).toUpperCase());

    let shareRecord = existingShare;

    if (existingShare) {
      if (existingShare.consentGranted === false) {
        throw new Error('Unauthorized access: HealthPack share is inactive or has been revoked.');
      }
      if (existingShare.expiresAt && new Date(existingShare.expiresAt) <= new Date()) {
        throw new Error('Unauthorized access: HealthPack share has expired.');
      }
      if (userRole === 'DOCTOR' && !isCaseActive) {
        throw new Error('Unauthorized access: HealthPack access is closed because the emergency case has concluded.');
      }
    } else {
      if (isAuthorized && isCaseActive) {
        const baseTimestamp = emergencyCase.acceptedAt || emergencyCase.createdAt;
        shareRecord = await this.shareHealthPackWithHospital(emergencyCase.patientId, authorizedHospitalId, requestingUserId, baseTimestamp);
      } else {
        throw new Error('Unauthorized access: HealthPack access not granted.');
      }
    }

    // Safe diagnostic log (DO NOT log keys, medical data, or tokens)
    console.log('[HealthPack Diagnostic Log]', {
      caseId: emergencyCase.caseId || emergencyCase.id,
      requesterId: requestingUserId,
      userRole,
      healthPackId: healthPack.id,
      sharedWithMembershipResult: shareRecord ? 'AUTHORIZED' : 'UNAUTHORIZED',
    });

    if (!shareRecord && userRole !== 'ADMIN') {
      throw new Error('Unauthorized access: HealthPack access not shared.');
    }

    // Decrypt AES-256-CBC hex payload strictly
    const decryptedString = decrypt(healthPack.encryptedData, healthPack.iv);
    const healthData = JSON.parse(decryptedString);

    // Fetch linked documents
    const documents = await prisma.medicalDocument.findMany({
      where: {
        OR: [
          { healthPackId: healthPack.id },
          { patientId: emergencyCase.patientId },
        ],
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        documentType: true,
        createdAt: true,
      },
    });

    const { decryptJSON } = require('../utils/crypto');

    let decryptedMedicalSummary = null;
    if (emergencyCase.medicalSummary) {
      try {
        if (emergencyCase.medicalSummary.iv && emergencyCase.medicalSummary.encryptedData) {
          decryptedMedicalSummary = decryptJSON(emergencyCase.medicalSummary.encryptedData, emergencyCase.medicalSummary.iv);
        } else {
          decryptedMedicalSummary = emergencyCase.medicalSummary;
        }
      } catch (err) {
        console.warn('[HealthPackService] Medical summary decryption warning:', err.message);
      }
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: requestingUserId,
        action: 'HEALTH_PACK_VIEWED',
        entity: 'HealthPack',
        entityId: healthPack.id,
        details: { event: 'HEALTH_PACK_DECRYPTED', caseId, hospitalName },
      },
    });

    // Fetch latest patient profile fields and merge live medical data with encrypted HealthPack & emergency summary
    const patientRecord = await prisma.patient.findUnique({
      where: { id: healthPack.patientId },
      select: {
        id: true,
        name: true,
        bloodGroup: true,
        allergies: true,
        medicalConditions: true,
        conditions: true,
        heartCondition: true,
        diabetesStatus: true,
        hypertensionStatus: true,
        medications: true,
      },
    });

    const isMeaningful = (v) => {
      if (v == null) return false;
      const s = String(v).trim();
      return s.length > 0 && s !== 'NOT_PROVIDED' && s !== 'UNKNOWN' && s !== 'None reported';
    };

    const project = (val1, val2, val3, fallback) => {
      if (isMeaningful(val1)) return String(val1).trim();
      if (isMeaningful(val2)) return String(val2).trim();
      if (isMeaningful(val3)) return String(val3).trim();
      return fallback;
    };

    const patientConditions = patientRecord?.conditions || patientRecord?.medicalConditions || null;
    const summaryConditions = decryptedMedicalSummary?.confirmedConditions || decryptedMedicalSummary?.conditions || null;

    const mergedHealthData = {
      ...healthData,
      bloodGroup: project(patientRecord?.bloodGroup, decryptedMedicalSummary?.bloodGroup, healthData.bloodGroup, healthData.bloodGroup || null),
      allergies: project(patientRecord?.allergies, decryptedMedicalSummary?.allergies, healthData.allergies, healthData.allergies && healthData.allergies !== 'NOT_PROVIDED' ? healthData.allergies : null),
      medications: project(patientRecord?.medications, decryptedMedicalSummary?.currentMedications || decryptedMedicalSummary?.medications, healthData.medications, healthData.medications && healthData.medications !== 'NOT_PROVIDED' ? healthData.medications : null),
      conditions: project(patientConditions, summaryConditions, healthData.conditions || healthData.medicalConditions, healthData.conditions && healthData.conditions !== 'NOT_PROVIDED' ? healthData.conditions : null),
      medicalConditions: project(patientConditions, summaryConditions, healthData.medicalConditions || healthData.conditions, healthData.medicalConditions && healthData.medicalConditions !== 'NOT_PROVIDED' ? healthData.medicalConditions : null),
      heartCondition: project(patientRecord?.heartCondition, decryptedMedicalSummary?.cardiacCondition || decryptedMedicalSummary?.heartCondition, healthData.heartCondition, healthData.heartCondition || 'UNKNOWN'),
      diabetesStatus: project(patientRecord?.diabetesStatus, decryptedMedicalSummary?.diabetesStatus, healthData.diabetesStatus, healthData.diabetesStatus || 'UNKNOWN'),
      hypertensionStatus: project(patientRecord?.hypertensionStatus, decryptedMedicalSummary?.hypertensionStatus, healthData.hypertensionStatus, healthData.hypertensionStatus || 'UNKNOWN'),
    };

    // Trigger async background refresh of encrypted HealthPack in DB if needed
    try {
      this.refreshHealthPackFromPatient(healthPack.patientId).catch(() => {});
    } catch (e) {}

    return {
      id: healthPack.id,
      patientId: healthPack.patientId,
      patient: {
        id: patientRecord?.id || healthPack.patientId,
        name: patientRecord?.name || 'Patient',
      },
      createdAt: healthPack.createdAt,
      expiresAt: shareRecord?.expiresAt || healthPack.expiresAt,
      healthData: mergedHealthData,
      documents,
      medicalSummary: decryptedMedicalSummary,
    };
  }
}

module.exports = new HealthPackService();
