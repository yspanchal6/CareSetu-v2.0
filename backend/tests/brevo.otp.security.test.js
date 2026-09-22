const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const brevo = require('../src/services/providers/brevo.provider');
const otpService = require('../src/services/otp.service');
const prisma = require('../src/config/prisma');

async function runBrevoOtpSecurityTests() {
  console.log('==================================================');
  console.log('CARESETU BREVO & OTP SECURITY TEST SUITE');
  console.log('==================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // TEST 1: Missing Environment Variables Validation
    // ------------------------------------------------------------------
    const originalKey = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;

    const missingConfigResult = brevo.validateConfig();
    assert(missingConfigResult.valid === false, 'Detects missing BREVO_API_KEY safely');
    assert(
      missingConfigResult.errors.some((e) => e.includes('BREVO_API_KEY')),
      'Returns descriptive error for missing BREVO_API_KEY'
    );

    // Restore API key for remaining tests
    process.env.BREVO_API_KEY = originalKey;

    // ------------------------------------------------------------------
    // TEST 2: Email Masking Security (No secret or full email leak)
    // ------------------------------------------------------------------
    const masked = brevo.maskEmail('user.test@example.com');
    assert(masked === 'u***t@example.com', 'Masks recipient emails correctly in logs');
    assert(!masked.includes('user.test'), 'Does not leak full email prefix');

    // ------------------------------------------------------------------
    // TEST 3: Safe Error Mapping — Zero Secret / IP Leaks to Browser
    // ------------------------------------------------------------------
    const synthetic401Res = {
      status: 401,
      errorText: '{"message":"Server IP 152.58.37.157 is not authorized","code":"unauthorized"}',
    };

    // Verify 401 returns safe user message without IP/secret leak
    const mockFetch401 = async () => ({
      ok: false,
      status: 401,
      text: async () => synthetic401Res.errorText,
    });

    const originalFetch = global.fetch;
    global.fetch = mockFetch401;

    const send401Result = await brevo.sendEmail({
      to: 'synthetic.user@example.com',
      subject: 'Synthetic Test',
      text: 'Test',
    });

    assert(send401Result.success === false, 'Brevo 401 response sets success = false');
    assert(send401Result.deliveryState === 'AUTH_FAILURE', 'Brevo 401 sets deliveryState = AUTH_FAILURE');
    assert(
      send401Result.error === 'Email verification is temporarily unavailable. Please try again later.',
      'User-facing error for 401 is safe and sanitized'
    );
    assert(!send401Result.error.includes('152.58.37.157'), 'User-facing error DOES NOT leak server IP address');
    assert(!send401Result.error.includes('http'), 'User-facing error DOES NOT leak internal URL links');

    // ------------------------------------------------------------------
    // TEST 4: No Retry Policy for HTTP 401 / 403 / 429
    // ------------------------------------------------------------------
    let fetchAttempts = 0;
    global.fetch = async () => {
      fetchAttempts++;
      return {
        ok: false,
        status: 401,
        text: async () => '{"message":"Unauthorized"}',
      };
    };

    await brevo.sendEmail({ to: 'synthetic.user@example.com', subject: 'Test', text: 'Test' }, 3);
    assert(fetchAttempts === 1, 'HTTP 401 is fast-failed without retrying 3 times');

    // ------------------------------------------------------------------
    // TEST 5: HTTP 403 & HTTP 429 Error Mapping
    // ------------------------------------------------------------------
    global.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => 'Forbidden sender',
    });
    const send403Result = await brevo.sendEmail({ to: 'synthetic.user@example.com', subject: 'Test', text: 'Test' });
    assert(send403Result.deliveryState === 'FORBIDDEN', 'HTTP 403 maps to FORBIDDEN deliveryState');

    global.fetch = async () => ({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    const send429Result = await brevo.sendEmail({ to: 'synthetic.user@example.com', subject: 'Test', text: 'Test' });
    assert(send429Result.deliveryState === 'RATE_LIMIT', 'HTTP 429 maps to RATE_LIMIT deliveryState');

    // ------------------------------------------------------------------
    // TEST 6: Bounded Retry for HTTP 5xx Server Errors
    // ------------------------------------------------------------------
    fetchAttempts = 0;
    global.fetch = async () => {
      fetchAttempts++;
      return {
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      };
    };

    const send503Result = await brevo.sendEmail({ to: 'synthetic.user@example.com', subject: 'Test', text: 'Test' }, 2);
    assert(fetchAttempts === 3, 'HTTP 503 retries bounded number of times (1 initial + 2 retries)');
    assert(send503Result.deliveryState === 'PROVIDER_SERVER_ERROR', 'HTTP 503 retries exhausted returns PROVIDER_SERVER_ERROR');

    // ------------------------------------------------------------------
    // TEST 7: OTP Database Cleanup & Invalid Verification Protection
    // ------------------------------------------------------------------
    const syntheticEmail = `synthetic.test.${Date.now()}@example.com`;
    const purpose = 'EMAIL_VERIFICATION';

    // Mock fetch to simulate 401 failure
    global.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized IP',
    });

    let requestFailed = false;
    try {
      await otpService.requestOtp({ identifier: syntheticEmail, email: syntheticEmail, purpose });
    } catch (err) {
      requestFailed = true;
      assert(err.status === 401, 'Failed 401 email delivery throws 401 Unauthorized status');
      assert(
        err.message === 'Email verification is temporarily unavailable. Please try again later.',
        'Thrown error message is sanitized for client'
      );
    }
    assert(requestFailed === true, 'requestOtp throws on delivery failure');

    // Check database: OTP record MUST be deleted/cleared
    const undeliveredOtp = await prisma.otp.findFirst({
      where: { identifier: syntheticEmail, purpose },
    });
    assert(undeliveredOtp === null, 'Undelivered OTP record is deleted from database so it CANNOT be verified');

    // Verify verifyOtp fails cleanly if attempted
    let verifyFailed = false;
    try {
      await otpService.verifyOtp({ identifier: syntheticEmail, purpose, otp: '123456' });
    } catch (err) {
      verifyFailed = true;
      assert(err.message.includes('No active OTP found'), 'verifyOtp rejects verification when delivery failed');
    }
    assert(verifyFailed === true, 'OTP verification rejected for undelivered OTP');

    // ------------------------------------------------------------------
    // TEST 8: Valid Brevo Acceptance Response Handling
    // ------------------------------------------------------------------
    global.fetch = async () => ({
      ok: true,
      status: 201,
      json: async () => ({ messageId: 'synthetic-msg-12345' }),
    });

    const validResult = await brevo.sendEmail({ to: 'synthetic.user@example.com', subject: 'Test', text: 'Test' });
    assert(validResult.success === true, 'Provider 201 response returns success = true');
    assert(validResult.messageId === 'synthetic-msg-12345', 'Valid response captures provider messageId');
    assert(validResult.deliveryState === 'ACCEPTED_BY_PROVIDER', 'Valid response sets ACCEPTED_BY_PROVIDER state');

    // Restore fetch
    global.fetch = originalFetch;

    console.log('--------------------------------------------------');
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBrevoOtpSecurityTests();
