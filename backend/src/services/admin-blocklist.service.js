const prisma = require('../config/prisma');

/**
 * Check if a user is currently blocked/restricted.
 * Auto-expires restrictions if expiresAt has passed.
 */
async function isUserBlocked(userId) {
  if (!userId) return { isBlocked: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, role: true },
  });

  if (!user) return { isBlocked: false };

  // Look up active restriction
  const activeRestriction = await prisma.accountRestriction.findFirst({
    where: {
      targetUserId: userId,
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (activeRestriction) {
    // Check expiration
    if (activeRestriction.expiresAt && new Date(activeRestriction.expiresAt) < new Date()) {
      // Auto-expire restriction
      await prisma.accountRestriction.update({
        where: { id: activeRestriction.id },
        data: { status: 'EXPIRED' },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      });
      return { isBlocked: false };
    }

    return {
      isBlocked: true,
      restriction: activeRestriction,
      reason: activeRestriction.reason,
      expiresAt: activeRestriction.expiresAt,
    };
  }

  // Fallback: If user status is explicitly BLOCKED but no restriction record exists
  if (user.status === 'BLOCKED') {
    return {
      isBlocked: true,
      reason: 'Account restricted by administrator',
    };
  }

  return { isBlocked: false };
}

/**
 * Block a patient or hospital account.
 */
async function blockAccount({ adminUserId, targetUserId, reason, expiresAt }) {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    const err = new Error('Reason for blocking is required');
    err.status = 400;
    throw err;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      patient: { select: { id: true, name: true } },
      hospital: { select: { id: true, name: true } },
    },
  });

  if (!targetUser) {
    const err = new Error('Target account not found');
    err.status = 404;
    throw err;
  }

  if (targetUser.role === 'ADMIN') {
    const err = new Error('Cannot block an administrator account');
    err.status = 403;
    throw err;
  }

  // Check if already actively restricted
  const existing = await prisma.accountRestriction.findFirst({
    where: {
      targetUserId,
      status: 'ACTIVE',
    },
  });

  if (existing) {
    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      // Mark old expired
      await prisma.accountRestriction.update({
        where: { id: existing.id },
        data: { status: 'EXPIRED' },
      });
    } else {
      const err = new Error('Account is already actively restricted');
      err.status = 409;
      throw err;
    }
  }

  const targetType = targetUser.role === 'HOSPITAL' ? 'HOSPITAL' : 'PATIENT';

  // Perform blocking transaction
  const [restriction] = await prisma.$transaction([
    prisma.accountRestriction.create({
      data: {
        targetUserId,
        targetType,
        status: 'ACTIVE',
        reason: reason.trim(),
        createdBy: adminUserId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    }),
    prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'BLOCKED' },
    }),
    prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_ACTION',
        entity: 'AccountRestriction',
        details: {
          action: 'BLOCK_ACCOUNT',
          targetUserId,
          targetType,
          reason: reason.trim(),
          expiresAt: expiresAt || null,
        },
      },
    }),
  ]);

  return restriction;
}

/**
 * Unblock a patient or hospital account.
 */
async function unblockAccount({ adminUserId, targetUserId, reason }) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!targetUser) {
    const err = new Error('Target account not found');
    err.status = 404;
    throw err;
  }

  const activeRestriction = await prisma.accountRestriction.findFirst({
    where: {
      targetUserId,
      status: 'ACTIVE',
    },
  });

  // Update active restriction if present
  if (activeRestriction) {
    await prisma.accountRestriction.update({
      where: { id: activeRestriction.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: adminUserId,
      },
    });
  }

  // Restore user status to ACTIVE
  await prisma.user.update({
    where: { id: targetUserId },
    data: { status: 'ACTIVE' },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: 'ADMIN_ACTION',
      entity: 'AccountRestriction',
      details: {
        action: 'UNBLOCK_ACCOUNT',
        targetUserId,
        reason: reason ? reason.trim() : 'Unblocked by administrator',
      },
    },
  });

  return { success: true, targetUserId };
}

/**
 * Search/list all users with filtering.
 */
async function getUsers({ search, role, status }) {
  const where = {};

  if (role) where.role = role;
  if (status) where.status = status;

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { patient: { name: { contains: search, mode: 'insensitive' } } },
      { hospital: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      isVerified: true,
      lastLoginAt: true,
      createdAt: true,
      patient: {
        select: { id: true, name: true, phone: true, age: true, gender: true },
      },
      hospital: {
        select: { id: true, name: true, phone: true, address: true, isVerified: true },
      },
      restrictionsCreated: {
        where: { status: 'ACTIVE' },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Attach active restriction info if blocked
  const userIds = users.map((u) => u.id);
  const activeRestrictions = await prisma.accountRestriction.findMany({
    where: {
      targetUserId: { in: userIds },
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  const restrictionMap = new Map();
  activeRestrictions.forEach((r) => {
    if (!restrictionMap.has(r.targetUserId)) {
      restrictionMap.set(r.targetUserId, r);
    }
  });

  return users.map((u) => {
    const name = u.patient?.name || u.hospital?.name || u.email.split('@')[0];
    const activeRest = restrictionMap.get(u.id);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      name,
      isVerified: u.isVerified,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      patient: u.patient,
      hospital: u.hospital,
      activeRestriction: activeRest || null,
    };
  });
}

/**
 * Get blocklist history.
 */
async function getBlocklistHistory({ targetUserId, targetType, status }) {
  const where = {};
  if (targetUserId) where.targetUserId = targetUserId;
  if (targetType) where.targetType = targetType;
  if (status) where.status = status;

  const restrictions = await prisma.accountRestriction.findMany({
    where,
    include: {
      createdByUser: {
        select: { id: true, email: true, role: true },
      },
      revokedByUser: {
        select: { id: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Resolve target user names
  const targetIds = [...new Set(restrictions.map((r) => r.targetUserId))];
  const targetUsers = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: {
      id: true,
      email: true,
      role: true,
      patient: { select: { name: true } },
      hospital: { select: { name: true } },
    },
  });

  const targetMap = new Map();
  targetUsers.forEach((u) => {
    targetMap.set(u.id, {
      id: u.id,
      email: u.email,
      role: u.role,
      name: u.patient?.name || u.hospital?.name || u.email,
    });
  });

  return restrictions.map((r) => ({
    id: r.id,
    targetUserId: r.targetUserId,
    targetUser: targetMap.get(r.targetUserId) || { id: r.targetUserId, email: 'Unknown' },
    targetType: r.targetType,
    status: r.status,
    reason: r.reason,
    createdBy: r.createdBy,
    createdByUser: r.createdByUser,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    revokedBy: r.revokedBy,
    revokedByUser: r.revokedByUser,
  }));
}

/**
 * Get security and admin audit logs.
 */
async function getAuditLogs({ limit = 50 }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: ['ADMIN_ACTION', 'SECURITY_EVENT', 'PROFILE_UPDATED', 'LOGIN', 'LOGOUT'] },
    },
    include: {
      user: {
        select: { id: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return logs;
}

module.exports = {
  isUserBlocked,
  blockAccount,
  unblockAccount,
  getUsers,
  getBlocklistHistory,
  getAuditLogs,
};
