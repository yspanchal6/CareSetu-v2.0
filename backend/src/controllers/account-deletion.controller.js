const prisma = require('../config/prisma');
const brevoProvider = require('../services/providers/brevo.provider');

/**
 * SUBMIT ACCOUNT DELETION / TERMINATION
 * Patient: Direct permanent termination (No admin approval required).
 * Hospital / Doctor: Admin-controlled approval flow (Creates PENDING request).
 */
exports.submitDeletionRequest = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patient: { select: { name: true, phone: true } },
        hospital: { select: { name: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    if (user.role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        error: 'Administrators cannot submit deletion requests for their own account via this workflow.',
      });
    }

    const { reason, confirmationText } = req.body || {};

    if (!confirmationText || String(confirmationText).trim().toUpperCase() !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: "To confirm account deletion, you must type 'DELETE' exactly.",
      });
    }

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a deletion reason of at least 5 characters.',
      });
    }

    if (trimmedReason.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Deletion reason cannot exceed 1000 characters.',
      });
    }

    const nameSnapshot = user.name || user.patient?.name || user.hospital?.name || user.email.split('@')[0];
    const usernameSnapshot = user.email.split('@')[0];
    const emailSnapshot = user.email;
    const userRole = user.role;

    // ============================================================
    // 1. PATIENT ROLE — DIRECT IMMEDIATE TERMINATION
    // ============================================================
    if (userRole === 'PATIENT') {
      await prisma.$transaction(async (tx) => {
        // Create administrative termination audit record with snapshots
        await tx.accountDeletionRequest.create({
          data: {
            userId: null, // User row is deleted next, so userId is set to null
            role: userRole,
            nameSnapshot,
            usernameSnapshot,
            emailSnapshot,
            reason: trimmedReason,
            status: 'TERMINATED',
            terminatedAt: new Date(),
          },
        });

        // Cleanup patient owned data
        const pat = await tx.patient.findUnique({ where: { userId: user.id } });
        if (pat) {
          await tx.hospitalRequest.deleteMany({
            where: { emergencyCase: { patientId: pat.id } },
          });
          await tx.emergencyCase.deleteMany({
            where: { patientId: pat.id },
          });
          await tx.medicalDocument.deleteMany({
            where: { patientId: pat.id },
          });
          await tx.healthPack.deleteMany({
            where: { patientId: pat.id },
          });
          await tx.patientLocation.deleteMany({
            where: { patientId: pat.id },
          });
          await tx.patient.delete({ where: { id: pat.id } });
        }

        // Delete user account
        await tx.user.delete({ where: { id: user.id } });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId: null,
            action: 'ADMIN_ACTION',
            entity: 'User',
            entityId: user.id,
            details: {
              action: 'PATIENT_DIRECT_TERMINATION',
              email: emailSnapshot,
              reason: trimmedReason,
            },
          },
        });
      });

      // Dispatch termination email
      try {
        await brevoProvider.sendEmail({
          to: emailSnapshot,
          subject: 'CareSetu Account Permanently Terminated',
          text: `Dear ${nameSnapshot}, your CareSetu account has been permanently terminated according to your deletion request.`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #0f172a;">CareSetu Account Permanently Terminated</h2>
              <p>Dear <strong>${nameSnapshot}</strong>,</p>
              <p>Your CareSetu patient account has been permanently terminated according to your deletion request.</p>
              <p>All active medical profiles, health packs, and personal documents have been removed from our active databases.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">CareSetu Healthcare Platform</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn('[AccountDeletion] Failed to send patient termination email:', emailErr.message);
      }

      return res.status(200).json({
        success: true,
        terminated: true,
        message: 'Your account has been permanently terminated.',
      });
    }

    // ============================================================
    // 2. HOSPITAL / DOCTOR ROLE — ADMIN APPROVAL REQUIRED
    // ============================================================

    // Check for duplicate pending requests
    const existingPending = await prisma.accountDeletionRequest.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        error: `You already have an active account deletion request pending review submitted on ${new Date(
          existingPending.createdAt
        ).toLocaleDateString()}.`,
        request: existingPending,
      });
    }

    const request = await prisma.accountDeletionRequest.create({
      data: {
        userId: user.id,
        role: userRole,
        nameSnapshot,
        usernameSnapshot,
        emailSnapshot,
        reason: trimmedReason,
        status: 'PENDING',
        requestedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADMIN_ACTION',
        entity: 'AccountDeletionRequest',
        entityId: request.id,
        details: { action: 'DELETION_REQUESTED', role: userRole, reason: trimmedReason },
      },
    });

    return res.status(201).json({
      success: true,
      terminated: false,
      message: 'Your account deletion request has been submitted for administrator review.',
      request,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET CURRENT USER'S LATEST DELETION REQUEST
 */
exports.getMyDeletionRequest = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const request = await prisma.accountDeletionRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      request: request || null,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * ADMIN: GET ALL ACCOUNT DELETION & TERMINATION RECORDS
 */
exports.getAdminDeletionRequests = async (req, res, next) => {
  try {
    const requests = await prisma.accountDeletionRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // Format output cleanly with normalized fields and snapshots
    const formatted = requests.map((r) => {
      const name = r.nameSnapshot || r.user?.name || r.emailSnapshot?.split('@')[0] || r.user?.email?.split('@')[0] || 'User';
      const email = r.emailSnapshot || r.user?.email || 'N/A';
      const username = r.usernameSnapshot || (email !== 'N/A' ? email.split('@')[0] : 'N/A');

      return {
        id: r.id,
        userId: r.userId,
        name,
        username,
        email,
        nameSnapshot: r.nameSnapshot || name,
        usernameSnapshot: r.usernameSnapshot || username,
        emailSnapshot: r.emailSnapshot || email,
        role: r.role,
        reason: r.reason,
        status: r.status,
        adminReason: r.adminReason,
        requestedAt: r.requestedAt || r.createdAt,
        reviewedAt: r.reviewedAt,
        terminatedAt: r.terminatedAt,
        createdAt: r.createdAt,
        user: r.user,
      };
    });

    return res.json({
      success: true,
      requests: formatted,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * ADMIN: APPROVE AND PERMANENTLY TERMINATE HOSPITAL / DOCTOR ACCOUNT
 */
exports.approveDeletionRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user.userId;

    const delReq = await prisma.accountDeletionRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!delReq) {
      return res.status(404).json({ success: false, error: 'Deletion request not found.' });
    }

    if (delReq.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Deletion request has already been ${delReq.status.toLowerCase()}.`,
      });
    }

    if (delReq.userId && delReq.userId === adminUserId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot approve a deletion request for your own administrator account.',
      });
    }

    const targetEmail = delReq.emailSnapshot || delReq.user?.email;
    const targetName = delReq.nameSnapshot || delReq.user?.name || targetEmail?.split('@')[0];
    const targetRole = delReq.role;
    const targetUserId = delReq.userId;

    // Transactionally update request & delete account data
    await prisma.$transaction(async (tx) => {
      // 1. Mark status as TERMINATED
      await tx.accountDeletionRequest.update({
        where: { id: delReq.id },
        data: {
          status: 'TERMINATED',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          terminatedAt: new Date(),
          userId: null, // Disconnect relation so record stays when user is deleted
        },
      });

      if (targetUserId) {
        // 2. Role-specific cleanup
        if (targetRole === 'HOSPITAL') {
          const hosp = await tx.hospital.findUnique({ where: { userId: targetUserId } });
          if (hosp) {
            await tx.emergencyCase.updateMany({
              where: { hospitalId: hosp.id },
              data: { hospitalId: null },
            });
            await tx.hospitalRequest.deleteMany({
              where: { hospitalId: hosp.id },
            });
            await tx.hospital.delete({ where: { id: hosp.id } });
          }
        } else if (targetRole === 'PATIENT') {
          const pat = await tx.patient.findUnique({ where: { userId: targetUserId } });
          if (pat) {
            await tx.hospitalRequest.deleteMany({
              where: { emergencyCase: { patientId: pat.id } },
            });
            await tx.emergencyCase.deleteMany({
              where: { patientId: pat.id },
            });
            await tx.medicalDocument.deleteMany({
              where: { patientId: pat.id },
            });
            await tx.healthPack.deleteMany({
              where: { patientId: pat.id },
            });
            await tx.patientLocation.deleteMany({
              where: { patientId: pat.id },
            });
            await tx.patient.delete({ where: { id: pat.id } });
          }
        }

        // Delete user account
        await tx.user.delete({ where: { id: targetUserId } });
      }

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_ACTION',
          entity: 'User',
          entityId: targetUserId || delReq.id,
          details: {
            action: 'ACCOUNT_PERMANENTLY_TERMINATED',
            targetEmail,
            targetRole,
            requestId: delReq.id,
          },
        },
      });
    });

    // 4. Send termination email via Brevo
    try {
      await brevoProvider.sendEmail({
        to: targetEmail,
        subject: 'CareSetu Account Permanently Terminated',
        text: `Dear ${targetName}, your request to permanently delete your CareSetu account (${targetRole}) has been approved. Your account has now been permanently terminated.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #0f172a;">CareSetu Account Permanently Terminated</h2>
            <p>Dear <strong>${targetName}</strong>,</p>
            <p>Your request to permanently delete your CareSetu account (<strong>${targetRole}</strong>) has been approved by an administrator.</p>
            <p>Your account has now been permanently terminated and associated data removed.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">CareSetu Healthcare Platform</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.warn('[AccountDeletion] Failed to send termination approval email:', emailErr.message);
    }

    return res.json({
      success: true,
      message: 'Account permanently terminated successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * ADMIN: REJECT DELETION REQUEST (HOSPITAL / DOCTOR)
 */
exports.rejectDeletionRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user.userId;
    const { adminReason } = req.body || {};

    const trimmedAdminReason = String(adminReason || '').trim();
    if (!trimmedAdminReason || trimmedAdminReason.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid rejection reason.',
      });
    }

    if (trimmedAdminReason.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason cannot exceed 1000 characters.',
      });
    }

    const delReq = await prisma.accountDeletionRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!delReq) {
      return res.status(404).json({ success: false, error: 'Deletion request not found.' });
    }

    if (delReq.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: `Deletion request has already been ${delReq.status.toLowerCase()}.`,
      });
    }

    const updated = await prisma.accountDeletionRequest.update({
      where: { id: delReq.id },
      data: {
        status: 'REJECTED',
        adminReason: trimmedAdminReason,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      },
    });

    const targetEmail = delReq.emailSnapshot || delReq.user?.email;
    const targetName = delReq.nameSnapshot || delReq.user?.name || targetEmail?.split('@')[0];

    // In-app notification for target user if account exists
    if (delReq.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: delReq.userId,
            type: 'SYSTEM',
            title: 'Account Deletion Request Update',
            message: `Your account deletion request was rejected. Reason: ${trimmedAdminReason}`,
          },
        });
      } catch (notifErr) {
        console.warn('[AccountDeletion] Notification create warn:', notifErr.message);
      }
    }

    // Send rejection email via Brevo
    try {
      await brevoProvider.sendEmail({
        to: targetEmail,
        subject: 'CareSetu Account Deletion Request Update',
        text: `Dear ${targetName}, your account deletion request was rejected. Reason: ${trimmedAdminReason}. Your account remains active.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #0f172a;">CareSetu Account Deletion Request Update</h2>
            <p>Dear <strong>${targetName}</strong>,</p>
            <p>Your account deletion request (<strong>${delReq.role}</strong>) was reviewed and <strong>rejected</strong> by an administrator.</p>
            <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #f59e0b; border-radius: 4px; margin: 15px 0;">
              <strong>Reason:</strong>
              <p style="margin: 5px 0 0 0; color: #334155;">${trimmedAdminReason}</p>
            </div>
            <p>Your account remains fully active.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">CareSetu Platform</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.warn('[AccountDeletion] Failed to send rejection email:', emailErr.message);
    }

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_ACTION',
        entity: 'AccountDeletionRequest',
        entityId: delReq.id,
        details: { action: 'DELETION_REQUEST_REJECTED', targetEmail, adminReason: trimmedAdminReason },
      },
    });

    return res.json({
      success: true,
      message: 'Account deletion request rejected successfully.',
      request: updated,
    });
  } catch (err) {
    return next(err);
  }
};
