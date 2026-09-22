const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');

/**
 * Get profile details for authenticated user based on role.
 */
async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      isVerified: true,
      lastLoginAt: true,
      createdAt: true,
      notificationPreferences: true,
      patient: {
        select: {
          id: true,
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
        },
      },
      hospital: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          city: true,
          state: true,
          capabilities: true,
          emergencyAvailable: true,
          isVerified: true,
          hasEmergencyDepartment: true,
          hasICU: true,
          hasTraumaUnit: true,
          hasCardiology: true,
          hasNeurology: true,
          hasAmbulance: true,
          location: true,
        },
      },
    },
  });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  // Sanitize and structure output
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    isVerified: user.isVerified,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    notificationPreferences: user.notificationPreferences || {
      emailAlerts: true,
      smsAlerts: true,
      pushNotifications: true,
      emergencyAlerts: true,
    },
    patientProfile: user.patient || null,
    hospitalProfile: user.hospital || null,
  };
}

/**
 * Update permitted profile fields.
 * Explicitly rejects mass assignment of security-critical fields.
 */
async function updateProfile(userId, updateData) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      patient: true,
      hospital: true,
    },
  });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  // Prevent modification of protected fields and credentials requiring OTP
  delete updateData.role;
  delete updateData.status;
  delete updateData.isVerified;
  delete updateData.id;
  delete updateData.userId;
  delete updateData.password;
  delete updateData.createdAt;
  delete updateData.email;
  delete updateData.phone;

  if (user.role === 'PATIENT') {
    const patientFields = {};
    if (updateData.name !== undefined) patientFields.name = String(updateData.name).trim();
    if (updateData.age !== undefined) patientFields.age = Number(updateData.age);
    if (updateData.gender !== undefined) patientFields.gender = String(updateData.gender).trim();
    if (updateData.phone !== undefined) patientFields.phone = String(updateData.phone).trim();
    if (updateData.bloodGroup !== undefined) patientFields.bloodGroup = String(updateData.bloodGroup).trim();
    if (updateData.allergies !== undefined) patientFields.allergies = String(updateData.allergies);
    if (updateData.medicalConditions !== undefined) patientFields.medicalConditions = String(updateData.medicalConditions);
    if (updateData.conditions !== undefined) patientFields.conditions = String(updateData.conditions);
    if (updateData.heartCondition !== undefined) patientFields.heartCondition = String(updateData.heartCondition);
    if (updateData.diabetesStatus !== undefined) patientFields.diabetesStatus = String(updateData.diabetesStatus);
    if (updateData.hypertensionStatus !== undefined) patientFields.hypertensionStatus = String(updateData.hypertensionStatus);
    if (updateData.medications !== undefined) patientFields.medications = String(updateData.medications);
    if (updateData.emergencyContacts !== undefined) patientFields.emergencyContacts = updateData.emergencyContacts;
    if (updateData.location !== undefined) patientFields.location = updateData.location;

    if (user.patient) {
      await prisma.patient.update({
        where: { id: user.patient.id },
        data: patientFields,
      });
    }
  } else if (user.role === 'HOSPITAL') {
    const hospitalFields = {};
    if (updateData.name !== undefined) hospitalFields.name = String(updateData.name).trim();
    if (updateData.address !== undefined) hospitalFields.address = String(updateData.address).trim();
    if (updateData.phone !== undefined) hospitalFields.phone = String(updateData.phone).trim();
    if (updateData.email !== undefined) hospitalFields.email = String(updateData.email).trim();
    if (updateData.city !== undefined) hospitalFields.city = String(updateData.city).trim();
    if (updateData.state !== undefined) hospitalFields.state = String(updateData.state).trim();
    if (updateData.capabilities !== undefined && Array.isArray(updateData.capabilities)) {
      hospitalFields.capabilities = updateData.capabilities;
    }
    if (updateData.emergencyAvailable !== undefined) hospitalFields.emergencyAvailable = Boolean(updateData.emergencyAvailable);
    if (updateData.hasEmergencyDepartment !== undefined) hospitalFields.hasEmergencyDepartment = Boolean(updateData.hasEmergencyDepartment);
    if (updateData.hasICU !== undefined) hospitalFields.hasICU = Boolean(updateData.hasICU);
    if (updateData.hasTraumaUnit !== undefined) hospitalFields.hasTraumaUnit = Boolean(updateData.hasTraumaUnit);
    if (updateData.hasCardiology !== undefined) hospitalFields.hasCardiology = Boolean(updateData.hasCardiology);
    if (updateData.hasNeurology !== undefined) hospitalFields.hasNeurology = Boolean(updateData.hasNeurology);
    if (updateData.hasAmbulance !== undefined) hospitalFields.hasAmbulance = Boolean(updateData.hasAmbulance);
    if (updateData.location !== undefined) hospitalFields.location = updateData.location;

    if (user.hospital) {
      await prisma.hospital.update({
        where: { id: user.hospital.id },
        data: hospitalFields,
      });
    }
  }

  // Update root User fields if provided
  if (updateData.name && !user.patient && !user.hospital) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: String(updateData.name).trim() },
    });
  }

  // Audit Log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PROFILE_UPDATED',
      details: { updatedFields: Object.keys(updateData) },
    },
  });

  return getProfile(userId);
}

const jwt = require('jsonwebtoken');
const { validatePasswordStrength, normalizeEmail } = require('../utils/auth-security');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Change user password securely.
 */
async function updatePassword(userId, { currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword || !newPassword) {
    const err = new Error('Both currentPassword and newPassword are required.');
    err.status = 400;
    throw err;
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    const err = new Error('New password and password confirmation do not match.');
    err.status = 400;
    throw err;
  }

  const passwordCheck = validatePasswordStrength(newPassword);
  if (!passwordCheck.isValid) {
    const err = new Error(passwordCheck.message);
    err.status = 400;
    throw err;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, password: true, hospital: { select: { id: true } } },
  });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const isValidCurrent = await bcrypt.compare(currentPassword, user.password);
  if (!isValidCurrent) {
    const err = new Error('Current password is incorrect.');
    err.status = 400;
    throw err;
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedNewPassword },
  });

  // Audit Log
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'SECURITY_EVENT',
      details: { event: 'PASSWORD_CHANGED' },
    },
  });

  // Rotate token after password change
  const rotatedToken = jwt.sign(
    {
      userId: user.id,
      email: normalizeEmail(user.email),
      role: user.role,
      hospitalId: user.hospital?.id || undefined,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    success: true,
    message: 'Password updated successfully',
    token: rotatedToken,
  };
}

/**
 * Update notification preferences.
 */
async function updateNotifications(userId, preferences) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      notificationPreferences: preferences,
    },
  });

  return { success: true, notificationPreferences: preferences };
}

module.exports = {
  getProfile,
  updateProfile,
  updatePassword,
  updateNotifications,
};
