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
   * Automatically shares the patient's HealthPack with the accepting hospital.
   */
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
        status: 'ACTIVE',
      },
    });
    if (existingShare) return existingShare;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const share = await prisma.healthPackShare.create({
      data: {
        healthPackId: healthPack.id,
        sharedWithHospitalId: hospitalId,
        sharedWithUserId: hospitalUserId,
        consentGranted: true,
        expiresAt,
      },
    });

    return share;
  }

  /**
   * Decrypts and retrieves a HealthPack for an authorized hospital using caseId.
   */
  async getDecryptedHealthPackForCase(caseId, hospitalUserId) {
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
    if (emergencyCase.hospitalId !== hospital.id) {
      const request = await prisma.hospitalRequest.findFirst({
        where: { emergencyCaseId: emergencyCase.id, hospitalId: hospital.id },
      });
      if (!request) {
        throw new Error('Unauthorized: Hospital is not assigned or requested for this emergency case.');
      }
    }

    // Retrieve active HealthPack for the patient
    const healthPack = await prisma.healthPack.findFirst({
      where: { patientId: emergencyCase.patientId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!healthPack) {
      throw new Error('No active HealthPack found for this patient.');
    }

    // Verify HealthPackShare / Consent exists and is ACTIVE and not expired
    const share = await prisma.healthPackShare.findFirst({
      where: {
        healthPackId: healthPack.id,
        sharedWithHospitalId: hospital.id,
        status: 'ACTIVE',
        consentGranted: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!share) {
      await prisma.auditLog.create({
        data: {
          userId: hospitalUserId,
          action: 'HEALTH_PACK_VIEWED',
          entity: 'HealthPack',
          entityId: healthPack.id,
          details: `UNAUTHORIZED ACCESS ATTEMPT: No active share for case ${caseId}`,
        },
      });
      throw new Error('Unauthorized access: HealthPack access expired or not shared.');
    }

    // Decrypt AES-256-GCM data
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
        details: `Hospital ${hospital.name} decrypted HealthPack for case ${caseId}`,
      },
    });

    return {
      id: healthPack.id,
      patientId: healthPack.patientId,
      createdAt: healthPack.createdAt,
      expiresAt: share.expiresAt,
      healthData,
      documents,
      medicalSummary: decryptedMedicalSummary,
    };
  }
}

module.exports = new HealthPackService();
