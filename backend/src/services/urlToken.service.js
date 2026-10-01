const prisma = require('../config/prisma');
const { generateOpaqueToken, hashToken, encryptPayload, decryptPayload } = require('../utils/urlCrypto');
const logger = require('../utils/logger');

/**
 * Service managing secure Opaque Token Generation, SHA-256 Storage, Validation,
 * Expiration, One-Time Consumption, and Revocation for CareSetu.
 */

class UrlTokenService {
  /**
   * Create an opaque public share token for a resource
   * Stores SHA-256 hash in database; returns raw token to client once.
   */
  static async createShareToken({
    resourceType,
    resourceId,
    allowedAction = 'VIEW',
    expiresInHours = 24,
    isOneTime = false,
    maxUses = null,
    createdByUserId = null,
  }) {
    if (!resourceType || !resourceId) {
      const error = new Error('resourceType and resourceId are required.');
      error.status = 400;
      throw error;
    }

    const validResourceTypes = ['HEALTH_PACK', 'EMERGENCY_CASE', 'MEDICAL_DOCUMENT', 'GOVERNMENT_RECORD'];
    if (!validResourceTypes.includes(resourceType)) {
      const error = new Error(`Invalid resourceType. Allowed: ${validResourceTypes.join(', ')}`);
      error.status = 400;
      throw error;
    }

    const validActions = ['VIEW', 'DOWNLOAD', 'SHARE', 'EMERGENCY_READ'];
    if (!validActions.includes(allowedAction)) {
      const error = new Error(`Invalid allowedAction. Allowed: ${validActions.join(', ')}`);
      error.status = 400;
      throw error;
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);

    const tokenRecord = await prisma.urlShareToken.create({
      data: {
        tokenHash,
        resourceType,
        resourceId,
        allowedAction,
        expiresAt,
        isOneTime: Boolean(isOneTime),
        maxUses: isOneTime ? 1 : (maxUses ? Number(maxUses) : null),
        createdByUserId: createdByUserId || null,
      },
    });

    logger.info('[UrlTokenService] Created share token', {
      tokenId: tokenRecord.id,
      resourceType,
      resourceId,
      expiresAt: expiresAt.toISOString(),
      isOneTime,
    });

    return {
      rawToken,
      shareTokenId: tokenRecord.id,
      resourceType: tokenRecord.resourceType,
      resourceId: tokenRecord.resourceId,
      allowedAction: tokenRecord.allowedAction,
      expiresAt: tokenRecord.expiresAt,
      isOneTime: tokenRecord.isOneTime,
      maxUses: tokenRecord.maxUses,
    };
  }

  /**
   * Validate raw token format, DB SHA-256 hash lookup, expiration, and scope
   */
  static async validateToken(rawToken, requiredResourceType = null, requiredAction = null) {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) {
      const error = new Error('Invalid or malformed token format.');
      error.status = 400;
      throw error;
    }

    const tokenHash = hashToken(rawToken);

    const tokenRecord = await prisma.urlShareToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      const error = new Error('Share link token not found.');
      error.status = 404;
      throw error;
    }

    // Check Revocation
    if (tokenRecord.revokedAt) {
      const error = new Error('Share link token has been revoked.');
      error.status = 410;
      throw error;
    }

    // Check Expiration
    if (new Date() > new Date(tokenRecord.expiresAt)) {
      const error = new Error('Share link token has expired.');
      error.status = 410;
      throw error;
    }

    // Check Max Uses
    if (tokenRecord.maxUses !== null && tokenRecord.usedCount >= tokenRecord.maxUses) {
      const error = new Error('Share link token maximum usage limit exceeded.');
      error.status = 410;
      throw error;
    }

    // Check Scope & Resource Type
    if (requiredResourceType && tokenRecord.resourceType !== requiredResourceType) {
      const error = new Error('Token resource scope mismatch.');
      error.status = 403;
      throw error;
    }

    if (requiredAction && tokenRecord.allowedAction !== requiredAction) {
      const error = new Error('Token action scope mismatch.');
      error.status = 403;
      throw error;
    }

    return {
      valid: true,
      tokenRecord: {
        id: tokenRecord.id,
        resourceType: tokenRecord.resourceType,
        resourceId: tokenRecord.resourceId,
        allowedAction: tokenRecord.allowedAction,
        expiresAt: tokenRecord.expiresAt,
        usedCount: tokenRecord.usedCount,
        maxUses: tokenRecord.maxUses,
        isOneTime: tokenRecord.isOneTime,
        createdByUserId: tokenRecord.createdByUserId,
      },
    };
  }

  /**
   * Atomically consume token (increments usedCount, sets revokedAt if one-time/maxUses reached)
   * Uses Prisma transaction for safety against concurrent replay.
   */
  static async consumeToken(rawToken, requiredResourceType = null, requiredAction = null) {
    const { tokenRecord } = await this.validateToken(rawToken, requiredResourceType, requiredAction);
    const tokenHash = hashToken(rawToken);

    return await prisma.$transaction(async (tx) => {
      // Re-fetch inside transaction for concurrency safety
      const current = await tx.urlShareToken.findUnique({
        where: { tokenHash },
      });

      if (!current || current.revokedAt || new Date() > new Date(current.expiresAt)) {
        const error = new Error('Token is no longer valid or active.');
        error.status = 410;
        throw error;
      }

      if (current.maxUses !== null && current.usedCount >= current.maxUses) {
        const error = new Error('One-time or max-use token limit reached.');
        error.status = 410;
        throw error;
      }

      const newUsedCount = current.usedCount + 1;
      const shouldRevoke = current.isOneTime || (current.maxUses !== null && newUsedCount >= current.maxUses);

      const updated = await tx.urlShareToken.update({
        where: { tokenHash },
        data: {
          usedCount: newUsedCount,
          revokedAt: shouldRevoke ? new Date() : current.revokedAt,
        },
      });

      logger.info('[UrlTokenService] Consumed token', {
        tokenId: updated.id,
        resourceType: updated.resourceType,
        resourceId: updated.resourceId,
        usedCount: updated.usedCount,
        revoked: Boolean(updated.revokedAt),
      });

      return {
        consumed: true,
        tokenRecord: {
          id: updated.id,
          resourceType: updated.resourceType,
          resourceId: updated.resourceId,
          allowedAction: updated.allowedAction,
          usedCount: updated.usedCount,
          revokedAt: updated.revokedAt,
        },
      };
    });
  }

  /**
   * Revoke an active share token by ID
   */
  static async revokeToken(tokenId, requestingUserId, isAdmin = false) {
    const token = await prisma.urlShareToken.findUnique({
      where: { id: tokenId },
    });

    if (!token) {
      const error = new Error('Token record not found.');
      error.status = 404;
      throw error;
    }

    if (!isAdmin && token.createdByUserId && token.createdByUserId !== requestingUserId) {
      const error = new Error('Unauthorized to revoke this token.');
      error.status = 403;
      throw error;
    }

    const updated = await prisma.urlShareToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    return {
      revoked: true,
      tokenId: updated.id,
      revokedAt: updated.revokedAt,
    };
  }

  /**
   * Reversible AES-256-GCM encryption wrapper
   */
  static createEncryptedPayload(payloadObj) {
    return encryptPayload(payloadObj);
  }

  /**
   * Reversible AES-256-GCM decryption wrapper
   */
  static decryptEncryptedPayload(encryptedStr) {
    return decryptPayload(encryptedStr);
  }

  /**
   * Safe cleanup mechanism for expired share tokens
   * Deletes ONLY tokens where expiresAt is strictly in the past. Active or unexpired tokens are untouched.
   */
  static async cleanupExpiredTokens() {
    const result = await prisma.urlShareToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    logger.info('[UrlTokenService] Expired share tokens pruned', { deletedCount: result.count });

    return {
      success: true,
      deletedCount: result.count,
    };
  }
}

module.exports = UrlTokenService;
