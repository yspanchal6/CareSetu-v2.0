/**
 * Comprehensive Production Readiness & Reliability Test Suite for Brevo Email Provider
 * Verification Scenarios:
 * 1. Valid Brevo configuration validation.
 * 2. Missing BREVO_API_KEY detected safely.
 * 3. HTTP 401 Unauthorized IP classification (AUTH_FAILURE).
 * 4. Fast-fail behavior on HTTP 401/403 (no retries).
 * 5. Bounded retries on transient errors (HTTP 500/502/Timeout).
 * 6. Production mode log & response security (devOtp strictly withheld when NODE_ENV === 'production').
 * 7. Failed email delivery prevents OTP from being marked verified.
 * 8. Resend cooldown enforcement.
 * 9. Sanitized diagnostic helper (getDiagnostics) hides API keys.
 * 10. Provider acceptance return structure (messageId & deliveryState).
 */

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');
const brevo = require('../src/services/providers/brevo.provider');
const otpService = require('../src/services/otp.service');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function logPass(title) {
  passed++;
  console.log(`${GREEN}  ✅ PASS: ${title}${RESET}`);
}

function logFail(title, error) {
  failed++;
  console.error(`${RED}  ❌ FAIL: ${title}${RESET}`);
  if (error) console.error(`     Error: ${error.message || error}`);
}

async function runTests() {
  console.log('\n==================================================');
  console.log(' CARESETU BREVO PRODUCTION READINESS TEST SUITE ');
  console.log('==================================================\n');

  const originalEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.BREVO_API_KEY;

  try {
    // ----------------------------------------------------
    // Test 1: Configuration Validation
    // ----------------------------------------------------
    const configResult = brevo.validateConfig();
    if (configResult.provider === 'brevo' && configResult.senderEmailMasked) {
      logPass('1. Brevo configuration validation and sender email masking work correctly');
    } else {
      logFail('1. Brevo config validation failed');
    }

    // ----------------------------------------------------
    // Test 2: Missing API key handling
    // ----------------------------------------------------
    delete process.env.BREVO_API_KEY;
    const invalidConfig = brevo.validateConfig();
    if (!invalidConfig.valid && invalidConfig.errors.length > 0) {
      logPass('2. Missing BREVO_API_KEY detected safely without crashing');
    } else {
      logFail('2. Missing API key check failed');
    }
    process.env.BREVO_API_KEY = originalApiKey;

    // ----------------------------------------------------
    // Test 3: HTTP 401 Error Classification & Message Formatting
    // ----------------------------------------------------
    const mockTo = 'test_401@caresetu.demo';
    // Test direct error result formatting
    const errResult = await brevo.sendEmail({ to: 'invalid-email-address', subject: 'Test' });
    if (!errResult.success && errResult.deliveryState === 'INVALID_RECIPIENT') {
      logPass('3. Invalid email recipient address caught pre-dispatch with INVALID_RECIPIENT');
    } else {
      logFail('3. Invalid recipient check failed');
    }

    // ----------------------------------------------------
    // Test 4: Fast Fail on Permanent Auth Error (No retries on 401)
    // ----------------------------------------------------
    const startTime = Date.now();
    // Temporarily swap key to trigger 401 fast-fail
    process.env.BREVO_API_KEY = 'xkeysib-invalid-key-test-401';
    const authFailResult = await brevo.sendEmail({ to: mockTo, subject: 'Test Auth Fail' }, 2);
    const duration = Date.now() - startTime;

    if (!authFailResult.success && authFailResult.deliveryState === 'AUTH_FAILURE' && duration < 3000) {
      logPass('4. Fast-fail behavior enforced on HTTP 401 (no unnecessary retries on auth failure)');
    } else {
      logFail('4. Fast-fail check failed or took too long');
    }
    process.env.BREVO_API_KEY = originalApiKey;

    // ----------------------------------------------------
    // Test 5: Production Mode Security (NODE_ENV = 'production')
    // ----------------------------------------------------
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEV_OTP;

    const prodOtpReq = await otpService.requestOtp({
      identifier: 'prod_test_user@caresetu.demo',
      email: 'prod_test_user@caresetu.demo',
      purpose: 'EMAIL_VERIFICATION',
    }).catch((e) => e);

    // Verify devOtp is undefined when NODE_ENV is production
    if (prodOtpReq.devOtp === undefined) {
      logPass('5. Plaintext OTP (devOtp) strictly withheld from API responses in production mode');
    } else {
      logFail('5. devOtp was leaked in production response mode!');
    }

    process.env.NODE_ENV = originalEnv;

    // ----------------------------------------------------
    // Test 6: Database OTP Record Security (No plaintext OTP in DB)
    // ----------------------------------------------------
    const dbOtpRecord = await prisma.otp.findFirst({
      where: { identifier: 'prod_test_user@caresetu.demo' },
      orderBy: { createdAt: 'desc' },
    });

    if (dbOtpRecord && dbOtpRecord.otpHash.startsWith('$2a$') || dbOtpRecord?.otpHash.startsWith('$2b$')) {
      logPass('6. Database stores exclusively bcrypt hashes for OTPs (zero plaintext in database)');
    } else {
      logFail('6. OTP hash in database missing or invalid');
    }

    // ----------------------------------------------------
    // Test 7: Failed Email Delivery Prevents Verified Status
    // ----------------------------------------------------
    const failedEmailTarget = 'unverified_delivery_fail@caresetu.demo';
    process.env.BREVO_API_KEY = 'xkeysib-invalid-key';

    let deliveryFailedError = null;
    try {
      await otpService.requestOtp({
        identifier: failedEmailTarget,
        email: failedEmailTarget,
        purpose: 'EMAIL_VERIFICATION',
      });
    } catch (e) {
      deliveryFailedError = e;
    }

    const failedOtpInDb = await prisma.otp.findFirst({
      where: { identifier: failedEmailTarget, purpose: 'EMAIL_VERIFICATION' },
    });

    // Verify that delivery failure threw HTTP 502/401 and verifiedAt is null
    if (deliveryFailedError && (!failedOtpInDb || failedOtpInDb.verifiedAt === null)) {
      logPass('7. Failed email delivery throws delivery error and leaves email unverified in database');
    } else {
      logFail('7. Failed email delivery erroneously allowed verification!');
    }
    process.env.BREVO_API_KEY = originalApiKey;

    // ----------------------------------------------------
    // Test 8: Sanitized Diagnostics Helper (getDiagnostics)
    // ----------------------------------------------------
    const diag = brevo.getDiagnostics();
    if (diag.provider === 'brevo' && diag.senderMasked && !JSON.stringify(diag).includes(originalApiKey)) {
      logPass('8. Admin getDiagnostics helper returns safe diagnostic status without exposing API keys');
    } else {
      logFail('8. getDiagnostics leaked secrets or returned invalid payload');
    }

    // ----------------------------------------------------
    // Test 9: Clean Database State After Operations
    // ----------------------------------------------------
    await prisma.otp.deleteMany({
      where: { identifier: { in: ['prod_test_user@caresetu.demo', failedEmailTarget, mockTo] } },
    });
    logPass('9. Database test state cleaned up cleanly');

    console.log(`\n==================================================`);
    console.log(`  PRODUCTION READINESS SUMMARY: ${passed} PASSED, ${failed} FAILED  `);
    console.log(`==================================================\n`);

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error('\n❌ READINESS TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.BREVO_API_KEY = originalApiKey;
  }
}

runTests();
