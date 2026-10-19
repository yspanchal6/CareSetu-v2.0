const prisma = require('../config/prisma');

/**
 * Portal C: Independent Clinic Controller
 * Strictly outpatient clinic profile, operating hours, and services.
 * Zero hospital emergency-management privileges or Health Pack decryption.
 */

exports.getClinicProfile = async (req, res, next) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, email: true, status: true, isActivated: true, createdAt: true }
        }
      }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'CLINIC_PROFILE_NOT_FOUND',
        message: 'No clinic profile found for this user.'
      });
    }

    res.json({
      success: true,
      clinic
    });
  } catch (error) {
    console.error('[ClinicController] Error fetching clinic profile:', error);
    next(error);
  }
};

exports.updateClinicProfile = async (req, res, next) => {
  try {
    const {
      address,
      city,
      state,
      pincode,
      phone,
      services,
      specialties,
      location,
      operatingHours
    } = req.body;

    const updated = await prisma.clinic.update({
      where: { userId: req.user.id },
      data: {
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(pincode && { pincode }),
        ...(phone && { phone }),
        ...(services && { services: Array.isArray(services) ? services : [services] }),
        ...(specialties && { specialties: Array.isArray(specialties) ? specialties : [specialties] }),
        ...(location && { location }),
        ...(operatingHours && { operatingHours })
      }
    });

    res.json({
      success: true,
      message: 'Clinic profile updated successfully',
      clinic: updated
    });
  } catch (error) {
    console.error('[ClinicController] Error updating clinic profile:', error);
    next(error);
  }
};

exports.getClinicStaff = async (req, res, next) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { userId: req.user.id }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'CLINIC_NOT_FOUND',
        message: 'Clinic not found.'
      });
    }

    // Outpatient staff list (stub or associated doctors)
    res.json({
      success: true,
      clinicId: clinic.id,
      staff: []
    });
  } catch (error) {
    console.error('[ClinicController] Error fetching clinic staff:', error);
    next(error);
  }
};

exports.getClinicAppointments = async (req, res, next) => {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { userId: req.user.id }
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'CLINIC_NOT_FOUND',
        message: 'Clinic not found.'
      });
    }

    // Outpatient consultation requests
    res.json({
      success: true,
      clinicId: clinic.id,
      appointments: []
    });
  } catch (error) {
    console.error('[ClinicController] Error fetching clinic appointments:', error);
    next(error);
  }
};

/**
 * GET /api/clinic/verification-status
 * Returns only the authenticated clinic's own verification status.
 * Omits internal reviewer identity (reviewedBy) for privacy & security.
 * Does NOT require prior approval.
 */
exports.getClinicVerificationStatus = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const clinic = await prisma.clinic.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        verificationStatus: true,
        rejectionReason: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!clinic) {
      return res.status(404).json({
        success: false,
        error: 'CLINIC_NOT_FOUND',
        message: 'Clinic not found.',
      });
    }

    return res.json({
      success: true,
      verificationStatus: clinic.verificationStatus,
      rejectionReason: clinic.rejectionReason,
      reviewedAt: clinic.reviewedAt,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        registrationNumber: clinic.registrationNumber,
        createdAt: clinic.createdAt,
        updatedAt: clinic.updatedAt,
      },
    });
  } catch (error) {
    console.error('[ClinicController] getClinicVerificationStatus error:', error);
    next(error);
  }
};

