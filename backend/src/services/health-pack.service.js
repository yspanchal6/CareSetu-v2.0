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
  async shareHealthPackWithHospital(patientId, hospitalId, hospitalUserId) {
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

    const existingShare = await prisma.healthPackShare.findFirst({
      where: {
        healthPackId: healthPack.id,
        sharedWithHospitalId: hospitalId,
      },
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    if (existingShare) {
      // If active and not expired, return existing share
      if (existingShare.status === 'ACTIVE' && (!existingShare.expiresAt || new Date(existingShare.expiresAt) > new Date())) {
        return existingShare;
      }
      // Otherwise renew the share
      return await prisma.healthPackShare.update({
        where: { id: existingShare.id },
        data: {
          expiresAt,
          status: 'ACTIVE',
          sharedWithUserId: hospitalUserId || existingShare.sharedWithUserId,
          consentGranted: true,
        },
      });
    }

    const share = await prisma.healthPackShare.create({
      data: {
        healthPackId: healthPack.id,
        sharedWithHospitalId: hospitalId,
        sharedWithUserId: hospitalUserId,
        consentGranted: true,
        expiresAt,
        status: 'ACTIVE',
      },
    });

    return share;
  }

  /**
   * Decrypts and retrieves a HealthPack for an authorized hospital using caseId.
   */
  async getDecryptedHealthPackForCase(caseId, hospitalUserId, userRole = 'HOSPITAL') {
    const hospital = await prisma.hospital.findFirst({ where: { userId: hospitalUserId } });
    if (!hospital) {
      throw new Error('Hospital profile not found.');
    }

    // Find EmergencyCase by caseId or public caseId
    const emergencyCase = await prisma.emergencyCase.findFirst({
      where: { OR: [{ id: caseId }, { caseId }] },
    });

    if (!emergencyCase) {
      throw new Error('Emergency case not found.');
    }

    // Authorization check: Verify hospital is assigned or requested for this case
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
      if (request) {
        isRequestedHospital = true;
      }
    }

    if (!isAssignedHospital && !isRequestedHospital) {
      throw new Error('Unauthorized: Hospital is not assigned or requested for this emergency case.');
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
    if (healthPack.expiresAt && healthPack.expiresAt < new Date()) {
      throw new Error('Unauthorized access: HealthPack has expired.');
    }

    // Normalize shared_with values as string array of UUIDs
    let activeShares = (healthPack.shares || []).filter(
      (s) => s.status === 'ACTIVE' && (!s.expiresAt || new Date(s.expiresAt) > new Date())
    );

    let shared_with = activeShares.map((s) => String(s.sharedWithHospitalId || s.sharedWithUserId || '')).filter(Boolean);
    let isSharedWithMember = shared_with.includes(String(hospital.id)) || shared_with.includes(String(hospitalUserId));

    const inactiveCaseStatuses = ['CLOSED', 'CANCELLED', 'RESOLVED', 'EXPIRED', 'REJECTED'];
    const isCaseActive = !inactiveCaseStatuses.includes(String(emergencyCase.status).toUpperCase());

    // If hospital IS assigned/requested for an ACTIVE emergency case but share is missing/expired, grant/renew temporary HealthPack access
    if (!isSharedWithMember && (isAssignedHospital || isRequestedHospital) && isCaseActive) {
      await this.shareHealthPackWithHospital(emergencyCase.patientId, hospital.id, hospitalUserId);
      healthPack = await prisma.healthPack.findUnique({
        where: { id: healthPack.id },
        include: { shares: true },
      });
      activeShares = (healthPack.shares || []).filter(
        (s) => s.status === 'ACTIVE' && (!s.expiresAt || new Date(s.expiresAt) > new Date())
      );
      shared_with = activeShares.map((s) => String(s.sharedWithHospitalId || s.sharedWithUserId || '')).filter(Boolean);
      isSharedWithMember = shared_with.includes(String(hospital.id)) || shared_with.includes(String(hospitalUserId));
    }

    // Safe diagnostic log (DO NOT log keys, medical data, or tokens)
    console.log('[HealthPack Diagnostic Log]', {
      caseId: emergencyCase.caseId || emergencyCase.id,
      hospitalId: hospital.id,
      hospitalRole: userRole,
      healthPackId: healthPack.id,
      sharedWithMembershipResult: isSharedWithMember ? 'AUTHORIZED' : 'UNAUTHORIZED',
    });

    if (!isSharedWithMember) {
      await prisma.auditLog.create({
        data: {
          userId: hospitalUserId,
          action: 'HEALTH_PACK_VIEWED',
          entity: 'HealthPack',
          entityId: healthPack.id,
          details: { event: 'UNAUTHORIZED_ACCESS_ATTEMPT', caseId, reason: 'No active share record found for hospital' },
        },
      });
      throw new Error('Unauthorized access: HealthPack access expired or not shared.');
    }

    const shareRecord = activeShares.find(
      (s) => String(s.sharedWithHospitalId) === String(hospital.id) || String(s.sharedWithUserId) === String(hospitalUserId)
    );

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
        userId: hospitalUserId,
        action: 'HEALTH_PACK_VIEWED',
        entity: 'HealthPack',
        entityId: healthPack.id,
        details: { event: 'HEALTH_PACK_DECRYPTED', caseId, hospitalName: hospital.name },
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
