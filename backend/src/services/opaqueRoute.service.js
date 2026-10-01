const crypto = require('crypto');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * CareSetu Opaque Route Mapping Service
 * Maps opaque random route identifiers (e.g., /app/a8F3kL9xQ2mR7vT1) to target application destinations.
 */
class OpaqueRouteService {
  /**
   * Create an opaque route alias for a target destination path
   */
  static async createOpaqueRoute({ targetPath, userId = null, role = null, expiresInHours = 48 }) {
    if (!targetPath || typeof targetPath !== 'string' || !targetPath.startsWith('/')) {
      const error = new Error('A valid target path starting with "/" is required.');
      error.status = 400;
      throw error;
    }

    // Generate 16-byte (32 hex char) cryptographically secure opaque ID
    const opaqueId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);

    const record = await prisma.opaqueRoute.create({
      data: {
        opaqueId,
        targetPath,
        userId: userId || null,
        role: role || null,
        expiresAt,
      },
    });

    logger.info('[OpaqueRouteService] Created opaque route mapping', {
      opaqueId: record.opaqueId,
      targetPath: record.targetPath,
      expiresAt: record.expiresAt.toISOString(),
    });

    return {
      opaqueId: record.opaqueId,
      targetPath: record.targetPath,
      expiresAt: record.expiresAt,
      opaqueUrl: `/app/${record.opaqueId}`,
    };
  }

  /**
   * Resolve an opaque route ID back to the target destination path with RBAC verification
   */
  static async resolveOpaqueRoute(opaqueId, requestingUser = null) {
    if (!opaqueId || typeof opaqueId !== 'string' || opaqueId.length < 16) {
      const error = new Error('Invalid or malformed opaque route ID.');
      error.status = 400;
      throw error;
    }

    const routeRecord = await prisma.opaqueRoute.findUnique({
      where: { opaqueId },
    });

    if (!routeRecord) {
      const error = new Error('Opaque route not found.');
      error.status = 404;
      throw error;
    }

    // Check expiration
    if (new Date() > new Date(routeRecord.expiresAt)) {
      const error = new Error('Opaque route has expired.');
      error.status = 410;
      throw error;
    }

    // Enforce bound user check if specified
    if (routeRecord.userId && requestingUser && requestingUser.id !== routeRecord.userId && requestingUser.userId !== routeRecord.userId) {
      const error = new Error('Unauthorized to access this route alias.');
      error.status = 403;
      throw error;
    }

    // Enforce role check if specified
    if (routeRecord.role && requestingUser && requestingUser.role !== routeRecord.role) {
      const error = new Error('Insufficient role permissions for target route.');
      error.status = 403;
      throw error;
    }

    return {
      opaqueId: routeRecord.opaqueId,
      targetPath: routeRecord.targetPath,
      expiresAt: routeRecord.expiresAt,
    };
  }

  /**
   * Prune expired opaque route mappings
   */
  static async cleanupExpiredOpaqueRoutes() {
    const result = await prisma.opaqueRoute.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    logger.info('[OpaqueRouteService] Pruned expired opaque routes', { deletedCount: result.count });
    return { deletedCount: result.count };
  }
}

module.exports = OpaqueRouteService;
