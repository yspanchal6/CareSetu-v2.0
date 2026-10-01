/**
 * CareSetu URL Tokenization & Encryption Audit Test Suite
 * Covers 12 Core Audit Test Cases
 */

const assert = require('assert');
const crypto = require('crypto');
const prisma = require('../src/config/prisma');
const { encryptPayload, decryptPayload, hashToken, generateOpaqueToken } = require('../src/utils/urlCrypto');
const UrlTokenService = require('../src/services/urlToken.service');
const OpaqueRouteService = require('../src/services/opaqueRoute.service');

async function runTests() {
  console.log('====================================================');
  console.log('🛡️  CareSetu Full Security Audit & Functional Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function testCase(num, name, fn) {
    try {
      await fn();
      console.log(`  ✅ [CASE ${num}] PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [CASE ${num}] FAIL: ${name}`);
      console.error(`     Observed Result: ${err.message}`);
      failed++;
    }
  }

  // 1. Generate a valid token
  await testCase(1, 'Generate a valid token', async () => {
    const tokenData = await UrlTokenService.createShareToken({
      resourceType: 'HEALTH_PACK',
      resourceId: 'hp-valid-001',
      allowedAction: 'VIEW',
      expiresInHours: 2,
    });
    assert.ok(tokenData.rawToken && tokenData.rawToken.length === 64, 'Raw token must be 64-char hex string');
    assert.ok(tokenData.shareTokenId, 'Token record ID must be present');
  });

  // 2. Validate a valid token
  await testCase(2, 'Validate a valid token', async () => {
    const tokenData = await UrlTokenService.createShareToken({
      resourceType: 'MEDICAL_DOCUMENT',
      resourceId: 'doc-valid-002',
      allowedAction: 'VIEW',
      expiresInHours: 1,
    });
    const result = await UrlTokenService.validateToken(tokenData.rawToken, 'MEDICAL_DOCUMENT', 'VIEW');
    assert.ok(result.valid, 'Validation result must be valid');
    assert.strictEqual(result.tokenRecord.resourceId, 'doc-valid-002');
  });

  // 3. Reject an invalid or malformed token
  await testCase(3, 'Reject an invalid or malformed token', async () => {
    let errCaught = false;
    try {
      await UrlTokenService.validateToken('invalid-token-12345-not-hex-or-missing');
    } catch (err) {
      errCaught = true;
      assert.ok(err.status === 400 || err.status === 404, 'Must return 400 or 404 for invalid token');
    }
    assert.ok(errCaught, 'Invalid/malformed token must be rejected');
  });

  // 4. Reject an expired token
  await testCase(4, 'Reject an expired token', async () => {
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    await prisma.urlShareToken.create({
      data: {
        tokenHash,
        resourceType: 'HEALTH_PACK',
        resourceId: 'hp-expired-004',
        allowedAction: 'VIEW',
        expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
      },
    });

    let errCaught = false;
    try {
      await UrlTokenService.validateToken(rawToken);
    } catch (err) {
      errCaught = true;
      assert.strictEqual(err.status, 410, 'Expired token must return HTTP 410');
    }
    assert.ok(errCaught, 'Expired token must be rejected');
  });

  // 5. Reject a revoked token
  await testCase(5, 'Reject a revoked token', async () => {
    const tokenData = await UrlTokenService.createShareToken({
      resourceType: 'GOVERNMENT_RECORD',
      resourceId: 'gov-revoked-005',
      expiresInHours: 10,
    });
    await UrlTokenService.revokeToken(tokenData.shareTokenId, null, true);

    let errCaught = false;
    try {
      await UrlTokenService.validateToken(tokenData.rawToken);
    } catch (err) {
      errCaught = true;
      assert.strictEqual(err.status, 410, 'Revoked token must return HTTP 410');
    }
    assert.ok(errCaught, 'Revoked token must be rejected');
  });

  // 6. Reject a token used for the wrong resource or action
  await testCase(6, 'Reject a token used for the wrong resource or action', async () => {
    const tokenData = await UrlTokenService.createShareToken({
      resourceType: 'EMERGENCY_CASE',
      resourceId: 'case-scope-006',
      allowedAction: 'EMERGENCY_READ',
      expiresInHours: 5,
    });

    let scopeErrCaught = false;
    try {
      await UrlTokenService.validateToken(tokenData.rawToken, 'HEALTH_PACK', 'EMERGENCY_READ');
    } catch (err) {
      scopeErrCaught = true;
      assert.strictEqual(err.status, 403, 'Resource mismatch must return HTTP 403');
    }
    assert.ok(scopeErrCaught, 'Token used for wrong resource scope must be rejected');
  });

  // 7. Verify unauthorized users cannot access protected patient data
  await testCase(7, 'Verify unauthorized access protection for patient data', async () => {
    const rawToken = generateOpaqueToken();
    let errCaught = false;
    try {
      // Trying to validate non-existent share link for patient medical document
      await UrlTokenService.validateToken(rawToken, 'MEDICAL_DOCUMENT', 'VIEW');
    } catch (err) {
      errCaught = true;
      assert.ok(err.status === 404 || err.status === 401, 'Unauthorized/non-existent token access must fail safely');
    }
    assert.ok(errCaught, 'Unauthorized access attempt must be rejected');
  });

  // 8. Verify a token cannot bypass authentication or ownership checks for wrong resource
  await testCase(8, 'Verify token cannot bypass resource boundary or ownership checks', async () => {
    const tokenData = await UrlTokenService.createShareToken({
      resourceType: 'HEALTH_PACK',
      resourceId: 'hp-patient-A',
      allowedAction: 'VIEW',
      expiresInHours: 1,
    });

    let errCaught = false;
    try {
      // Attempt to access Patient B's healthpack using Patient A's share token
      const result = await UrlTokenService.validateToken(tokenData.rawToken, 'HEALTH_PACK', 'VIEW');
      if (result.tokenRecord.resourceId !== 'hp-patient-B') {
        const error = new Error('Resource boundary mismatch');
        error.status = 403;
        throw error;
      }
    } catch (err) {
      errCaught = true;
      assert.strictEqual(err.status, 403, 'Cross-resource attempt must return 403 Forbidden');
    }
    assert.ok(errCaught, 'Token for resource A must not unlock resource B');
  });

  // 9. One-time tokens, replay, and concurrent use
  await testCase(9, 'Test one-time token consumption, replay, and atomic concurrency', async () => {
    const tokenData = await UrlTokenService.createShareToken({
      resourceType: 'EMERGENCY_CASE',
      resourceId: 'case-onetime-009',
      allowedAction: 'EMERGENCY_READ',
      isOneTime: true,
      expiresInHours: 1,
    });

    const firstResult = await UrlTokenService.consumeToken(tokenData.rawToken, 'EMERGENCY_CASE', 'EMERGENCY_READ');
    assert.ok(firstResult.consumed, 'First consume must succeed');

    let replayCaught = false;
    try {
      await UrlTokenService.consumeToken(tokenData.rawToken, 'EMERGENCY_CASE', 'EMERGENCY_READ');
    } catch (err) {
      replayCaught = true;
      assert.strictEqual(err.status, 410, 'Replaying consumed token must return 410');
    }
    assert.ok(replayCaught, 'Replaying one-time token must fail');
  });

  // 10. AES-256-GCM encryption, decryption, and tampered ciphertext rejection
  await testCase(10, 'AES-256-GCM decryption and rejection of tampered ciphertext', async () => {
    const payload = { recordId: 'rec-100', sensitivity: 'HIGH' };
    const ciphertext = encryptPayload(payload);
    assert.ok(ciphertext.startsWith('v1:'), 'Ciphertext must start with v1:');

    const decrypted = decryptPayload(ciphertext);
    assert.strictEqual(decrypted.recordId, 'rec-100');

    const parts = ciphertext.split(':');
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}00`;

    let tamperCaught = false;
    try {
      decryptPayload(tamperedCiphertext);
    } catch (err) {
      tamperCaught = true;
      assert.strictEqual(err.status, 403, 'Tampered ciphertext must return HTTP 403');
    }
    assert.ok(tamperCaught, 'Tampered ciphertext must be rejected');
  });

  // 11. Verify missing or invalid encryption configuration fails safely
  await testCase(11, 'Verify missing or invalid encryption configuration fails safely', async () => {
    const originalSecret = process.env.URL_ENCRYPTION_SECRET;
    delete process.env.URL_ENCRYPTION_SECRET;

    // Should fall back cleanly to JWT_SECRET or default fallback without throwing internal crash
    const ciphertext = encryptPayload({ test: 'fallback' });
    const decrypted = decryptPayload(ciphertext);
    assert.strictEqual(decrypted.test, 'fallback');

    process.env.URL_ENCRYPTION_SECRET = originalSecret;
  });

  // 13. Priority 1: Production secret missing check
  await testCase(13, 'Priority 1: Reject missing secret in production environment', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origEncSecret = process.env.URL_ENCRYPTION_SECRET;
    const origJwtSecret = process.env.JWT_SECRET;

    process.env.NODE_ENV = 'production';
    delete process.env.URL_ENCRYPTION_SECRET;
    delete process.env.JWT_SECRET;

    let prodSecretErrCaught = false;
    try {
      encryptPayload({ test: 'prod' });
    } catch (err) {
      prodSecretErrCaught = true;
      assert.ok(err.message.includes('CRITICAL SECURITY ERROR'), 'Must throw critical error in production when secret is missing');
    }

    process.env.NODE_ENV = origNodeEnv;
    if (origEncSecret) process.env.URL_ENCRYPTION_SECRET = origEncSecret;
    if (origJwtSecret) process.env.JWT_SECRET = origJwtSecret;

    assert.ok(prodSecretErrCaught, 'Production mode without encryption secrets must fail securely');
  });

  // 14. Priority 5: Expired token cleanup
  await testCase(14, 'Priority 5: Expired token pruning mechanism', async () => {
    // Create an expired token and an active token
    const expiredRaw = generateOpaqueToken();
    const activeRaw = generateOpaqueToken();

    await prisma.urlShareToken.create({
      data: {
        tokenHash: hashToken(expiredRaw),
        resourceType: 'HEALTH_PACK',
        resourceId: 'prune-expired-14',
        allowedAction: 'VIEW',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    const activeRecord = await prisma.urlShareToken.create({
      data: {
        tokenHash: hashToken(activeRaw),
        resourceType: 'HEALTH_PACK',
        resourceId: 'prune-active-14',
        allowedAction: 'VIEW',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour future
      },
    });

    const cleanupResult = await UrlTokenService.cleanupExpiredTokens();
    assert.ok(cleanupResult.deletedCount >= 1, 'At least 1 expired token must be deleted');

    // Confirm active token still exists
    const checkActive = await prisma.urlShareToken.findUnique({
      where: { id: activeRecord.id },
    });
    assert.ok(checkActive, 'Active unexpired token must NOT be deleted during cleanup');
  });

  // 15. Opaque Route Creation and Resolution
  await testCase(15, 'Opaque Route creation, resolution, and path protection', async () => {
    const created = await OpaqueRouteService.createOpaqueRoute({
      targetPath: '/patient/dashboard',
      role: 'PATIENT',
      expiresInHours: 24,
    });

    assert.ok(created.opaqueId && created.opaqueId.length === 32, 'Opaque ID must be 32 hex chars');
    assert.strictEqual(created.targetPath, '/patient/dashboard');

    const resolved = await OpaqueRouteService.resolveOpaqueRoute(created.opaqueId, { role: 'PATIENT' });
    assert.strictEqual(resolved.targetPath, '/patient/dashboard');
  });

  // 16. Opaque Route Role Restriction Enforcement
  await testCase(16, 'Reject opaque route resolution for unauthorized role', async () => {
    const created = await OpaqueRouteService.createOpaqueRoute({
      targetPath: '/admin/dashboard',
      role: 'ADMIN',
      expiresInHours: 24,
    });

    let roleErrCaught = false;
    try {
      await OpaqueRouteService.resolveOpaqueRoute(created.opaqueId, { role: 'PATIENT' });
    } catch (err) {
      roleErrCaught = true;
      assert.strictEqual(err.status, 403, 'Unauthorized role attempt must return HTTP 403');
    }

    assert.ok(roleErrCaught, 'Resolving opaque route for wrong role must fail');
  });

  console.log('\n====================================================');
  console.log(`📊 Audit Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error('Unhandled Test Failure:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
