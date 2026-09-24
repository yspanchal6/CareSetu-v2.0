const { z } = require('zod');
const prisma = require('../config/prisma');
const { sanitizeUserResponse } = require('../utils/auth-security');
const healthPackService = require('../services/health-pack.service');

const phoneSchema = z.string().trim().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number').or(z.literal(''));

const patientProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  gender: z.string().trim().min(1).max(50).optional(),
  phone: phoneSchema.optional(),
  bloodGroup: z.string().trim().max(20).optional(),
  allergies: z.string().max(5000).optional(),
  medicalConditions: z.string().max(5000).optional(),
  conditions: z.string().max(5000).optional(),
  heartCondition: z.string().max(100).optional(),
  diabetesStatus: z.string().max(100).optional(),
  hypertensionStatus: z.string().max(100).optional(),
  medications: z.string().max(5000).optional(),
  emergencyContacts: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    phone: phoneSchema,
    relation: z.string().trim().min(1).max(50),
  })).max(10).optional(),
  location: z.any().optional(),
});

const patientSelect = {
  id: true,
  userId: true,
  name: true,
  age: true,
  gender: true,
  phone: true,
  bloodGroup: true,
  allergies: true,
  medicalConditions: true,
  conditions: true,
  heartCondition: true,
  diabetesStatus: true,
  hypertensionStatus: true,
  medications: true,
  emergencyContacts: true,
  location: true,
};

exports.getProfile = async (req, res, next) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.userId },
      select: patientSelect,
    });

    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient profile not found.' });
    }

    return res.json({ success: true, patient });
  } catch (err) {
    return next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const input = patientProfileSchema.parse(req.body || {});
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const patientFields = {};
    for (const field of [
      'name', 'age', 'gender', 'phone', 'bloodGroup', 'allergies',
      'medicalConditions', 'conditions', 'heartCondition', 'diabetesStatus',
      'hypertensionStatus', 'medications', 'emergencyContacts', 'location',
    ]) {
      if (input[field] !== undefined) patientFields[field] = input[field];
    }

    const { patient, updatedUserRecord } = await prisma.$transaction(async (tx) => {
      const existing = await tx.patient.findUnique({ where: { userId: user.id } });
      let updated;

      if (existing) {
        updated = await tx.patient.update({
          where: { id: existing.id },
          data: patientFields,
          select: patientSelect,
        });
      } else {
        updated = await tx.patient.create({
          data: {
            name: input.name || user.name || 'Patient',
            age: input.age ?? 0,
            gender: input.gender || 'UNSPECIFIED',
            phone: input.phone || '',
            ...patientFields,
            user: { connect: { id: user.id } },
          },
          select: patientSelect,
        });
      }

      const isComplete = Boolean(
        updated.name &&
        String(updated.name).trim().length >= 2 &&
        Number(updated.age) > 0 &&
        updated.gender &&
        String(updated.gender).toUpperCase() !== 'UNSPECIFIED'
      );

      let uRecord;
      if (isComplete) {
        uRecord = await tx.user.update({
          where: { id: user.id },
          data: { isVerified: true },
          include: { patient: { select: patientSelect } },
        });
      } else {
        uRecord = await tx.user.findUnique({
          where: { id: user.id },
          include: { patient: { select: patientSelect } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'PROFILE_UPDATED',
          details: { updatedFields: Object.keys(patientFields), isComplete },
        },
      });

      return { patient: updated, updatedUserRecord: uRecord };
    });

    const safeUser = sanitizeUserResponse(updatedUserRecord);

    // Keep the patient's active encrypted HealthPack in sync with profile changes.
    try {
      await healthPackService.refreshHealthPackFromPatient(patient.id);
    } catch (hpErr) {
      console.warn('[PatientProfile] HealthPack profile sync warning:', hpErr.message);
    }

    return res.json({
      success: true,
      message: 'Patient profile updated successfully.',
      patient,
      user: safeUser,
    });

  } catch (err) {
    return next(err);
  }
};