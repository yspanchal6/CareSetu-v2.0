/**
 * CareSetu Registration Data Cleanup Service
 * Handles automatic expiration and cleanup of abandoned registration data and temporary OTP records.
 */

const prisma = require('../config/prisma');

// Configurable expiry window for pending registration data (default 15 minutes)
const PENDING_REGISTRATION_EXPIRY_MINUTES = parseInt(process.env.PENDING_REGISTRATION_EXPIRY_MINUTES || '15', 10);

class RegistrationCleanupService {
  /**
   * Sweeps and deletes expired or abandoned pending registration OTP records.
   * Ensures idempotency and database safety.
   */
  async cleanupAbandonedRegistrations() {
    try {
      const cutoffTime = new Date(Date.now() - PENDING_REGISTRATION_EXPIRY_MINUTES * 60 * 1000);
      const now = new Date();

      // Delete registration OTPs that have passed their explicit expiration OR creation cutoff
      const deleteResult = await prisma.otp.deleteMany({
        where: {
          purpose: { in: ['EMAIL_VERIFICATION', 'PHONE_VERIFICATION'] },
          OR: [
            { expiresAt: { lt: now } },
            { createdAt: { lt: cutoffTime } },
          ],
        },
      });

      if (deleteResult.count > 0) {
        console.log(`[REGISTRATION_CLEANUP] Swept ${deleteResult.count} abandoned/expired registration record(s).`);
      }

      return {
        success: true,
        deletedCount: deleteResult.count,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      console.error('[REGISTRATION_CLEANUP] Error during background cleanup:', error.message);
      return {
        success: false,
        error: error.message,
        deletedCount: 0,
      };
    }
  }

  /**
   * Explicitly cancels pending registration data for a given identifier (email or phone).
   * Verifies that the identifier does NOT belong to an active registered user before deleting.
   */
  async cancelPendingRegistration(identifier) {
    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      throw new Error('Identifier (email or phone) is required for cancellation.');
    }

    const normalized = identifier.trim().toLowerCase();

    // Safety check: ensure identifier does not belong to an existing registered user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { patient: { phone: identifier.trim() } },
          { hospital: { phone: identifier.trim() } },
        ],
      },
    });

    if (existingUser) {
      const err = new Error('Cannot cancel registration data for an existing registered user account.');
      err.status = 400;
      throw err;
    }

    // Delete pending OTP verification records for this unregistered identifier
    const deleteResult = await prisma.otp.deleteMany({
      where: {
        identifier: { in: [identifier.trim(), normalized] },
        purpose: { in: ['EMAIL_VERIFICATION', 'PHONE_VERIFICATION'] },
      },
    });

    console.log(`[REGISTRATION_CLEANUP] Explicitly cancelled ${deleteResult.count} pending record(s) for ${identifier.trim()}`);

    return {
      success: true,
      deletedCount: deleteResult.count,
      message: 'Pending registration data cleaned up successfully.',
    };
  }

  /**
   * Starts periodic background sweeper (runs every 60 seconds by default)
   */
  startSweeper(intervalMs = 60000) {
    console.log(`[REGISTRATION_CLEANUP] Initializing background sweeper (Interval: ${intervalMs / 1000}s, Expiry: ${PENDING_REGISTRATION_EXPIRY_MINUTES}m)`);
    
    // Initial cleanup on server start
    this.cleanupAbandonedRegistrations().catch(() => {});

    // Periodic interval sweeper
    const timer = setInterval(() => {
      this.cleanupAbandonedRegistrations().catch(() => {});
    }, intervalMs);

    // Unref timer so node process can exit cleanly during tests
    if (timer && timer.unref) {
      timer.unref();
    }

    return timer;
  }
}

module.exports = new RegistrationCleanupService();
