const healthPackService = require('../services/health-pack.service');
const emergencyRepository = require('../repositories/emergency.repository');
const prisma = require('../config/prisma');

const createHealthPack = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const body = req.body;

    // Extract payload structure: allow either { healthData: {...} } or flat object
    const healthData = body.healthData || {
      bloodGroup: body.bloodGroup,
      allergies: body.allergies,
      medications: body.medications,
      conditions: body.conditions || body.medicalConditions,
      heartCondition: body.heartCondition || 'UNKNOWN',
      diabetesStatus: body.diabetesStatus || 'UNKNOWN',
      hypertensionStatus: body.hypertensionStatus || 'UNKNOWN',
      surgeries: body.surgeries,
      notes: body.notes,
      documentIds: body.documentIds,
    };

    if (!healthData) {
      return res.status(400).json({ success: false, error: 'Health data payload is required.' });
    }

    const patient = await emergencyRepository.getPatientByUserId(userId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient profile not found.' });
    }

    const healthPack = await healthPackService.createHealthPack(patient.id, healthData);

    return res.status(201).json({
      success: true,
      message: 'Health Pack encrypted and stored successfully.',
      data: {
        id: healthPack.id,
        createdAt: healthPack.createdAt,
        expiresAt: healthPack.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMyHealthPack = async (req, res, next) => {
  try {
    const { userId } = req.user;

    const patient = await emergencyRepository.getPatientByUserId(userId);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient profile not found.' });
    }

    const { decrypt } = require('../utils/crypto');

    const healthPack = await prisma.healthPack.findFirst({
      where: { patientId: patient.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!healthPack) {
      return res.status(404).json({ success: false, error: 'No active Health Pack found.' });
    }

    const decryptedString = decrypt(healthPack.encryptedData, healthPack.iv);
    const healthData = JSON.parse(decryptedString);

    const documents = await prisma.medicalDocument.findMany({
      where: { patientId: patient.id },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        documentType: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: healthPack.id,
        patientId: healthPack.patientId,
        createdAt: healthPack.createdAt,
        expiresAt: healthPack.expiresAt,
        healthData,
        documents,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getCaseHealthPack = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { caseId } = req.params;

    try {
      const data = await healthPackService.getDecryptedHealthPackForCase(caseId, userId, req.user.role);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (authError) {
      if (authError.message.includes('Unauthorized') || authError.message.includes('expired')) {
        return res.status(403).json({ success: false, error: authError.message });
      }
      if (authError.message.includes('not found')) {
        return res.status(404).json({ success: false, error: authError.message });
      }
      throw authError;
    }
  } catch (error) {
    next(error);
  }
};

const getSharedHealthPack = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { packId } = req.params;

    const hospital = await prisma.hospital.findFirst({ where: { userId } });
    if (!hospital) {
      return res.status(404).json({ success: false, error: 'Hospital profile not found.' });
    }

    try {
      const healthPackData = await healthPackService.getDecryptedHealthPack(packId, userId, hospital.id);
      return res.status(200).json({
        success: true,
        data: healthPackData,
      });
    } catch (authError) {
      if (authError.message.includes('Unauthorized') || authError.message.includes('expired')) {
        return res.status(403).json({ success: false, error: authError.message });
      }
      if (authError.message.includes('not found')) {
        return res.status(404).json({ success: false, error: authError.message });
      }
      throw authError;
    }
  } catch (error) {
    next(error);
  }
};

const shareHealthPack = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { caseId, hospitalId } = req.body;

    if (!caseId || !hospitalId) {
      return res.status(400).json({ success: false, error: 'caseId and hospitalId are required.' });
    }

    if (prisma.auditLog) {
      try {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'HEALTH_PACK_SHARED',
            entity: 'HealthPack',
            entityId: caseId,
            details: { hospitalId, caseId },
          },
        });
      } catch (e) {
        console.warn('[ShareHealthPack] AuditLog warning:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Health Pack shared securely with hospital.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createHealthPack,
  getMyHealthPack,
  getCaseHealthPack,
  getSharedHealthPack,
  shareHealthPack,
};
