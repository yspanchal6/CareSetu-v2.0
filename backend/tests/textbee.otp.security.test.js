const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const textbee = require('../src/services/providers/textbee.provider');
const otpService = require('../src/services/otp.service');
const prisma = require('../src/config/prisma');

async function runTextBeeOtpSecurityTests() {
  console.log('==================================================');
  console.log('CARESETU TEXTBEE SMS & DEV FALLBACK TEST SUITE');
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

  const originalEnv = process.env.NODE_ENV;
  const originalDevFlag = process.env.DEV_OTP_MODE;
  const originalFetch = global.fetch;

  try {
    // ------------------------------------------------------------------
    // TEST 1: Phone Masking Security in Logs
    // ------------------------------------------------------------------
    const maskedPhone = textbee.maskPhone('+919876543210');
    assert(maskedPhone === '+91 98*** **210', 'Masks phone numbers cleanly in server logs');
    assert(!maskedPhone.includes('76543'), 'Does not leak full middle digits of phone number');

    // ------------------------------------------------------------------
    // TEST 2: DEV_OTP_MODE Enforcement Rules
    // ------------------------------------------------------------------
    // Rule 2A: DEV_OTP_MODE enabled in development
    process.env.NODE_ENV = 'development';
    process.env.DEV_OTP_MODE = 'true';
    assert(textbee.isDevOtpModeAllowed() === true, 'isDevOtpModeAllowed returns true when NODE_ENV=development and DEV_OTP_MODE=true');

    // Rule 2B: DEV_OTP_MODE disabled when DEV_OTP_MODE=false
    process.env.DEV_OTP_MODE = 'false';
    assert(textbee.isDevOtpModeAllowed() === false, 'isDevOtpModeAllowed returns false when DEV_OTP_MODE=false');

    // Rule 2C: DEV_OTP_MODE strictly FORBIDDEN in production
    process.env.NODE_ENV = 'production';
    process.env.DEV_OTP_MODE = 'true';
    assert(textbee.isDevOtpModeAllowed() === false, 'isDevOtpModeAllowed strictly FORBIDDEN when NODE_ENV=production');

    // Restore env for provider tests
    process.env.NODE_ENV = 'development';
    process.env.DEV_OTP_MODE = 'false';

    // ------------------------------------------------------------------
    // TEST 3: TextBee HTTP 429 Quota Exceeded Error Handling
    // ------------------------------------------------------------------
    global.fetch = async () => ({
      ok: false,
      status: 429,
      text: async () => '{"message":"Your account has used its 300 messages for the last 30 days."}',
    });

    const send429Result = await textbee.sendSMS('9876543210', 'CareSetu Test OTP: 123456');

    assert(send429Result.success === false, 'TextBee 429 quota error sets success = false');
    assert(send429Result.deliveryState === 'QUOTA_EXCEEDED', 'TextBee 429 sets deliveryState = QUOTA_EXCEEDED');
    assert(
      send429Result.error === 'SMS verification is temporarily unavailable due to rate limits. Please try again later.',
      'User-facing error for 429 is safe and sanitized'
    );
    assert(!send429Result.error.includes('300 messages'), 'User-facing error DOES NOT leak internal quota numbers');

    // ------------------------------------------------------------------
    // TEST 4: No Retry for 429 / 401 / 403
    // ------------------------------------------------------------------
    let fetchAttempts = 0;
    global.fetch = async () => {
      fetchAttempts++;
      return {
        ok: false,
        status: 429,
        text: async () => 'Quota exceeded',
      };
    };

    await textbee.sendSMS('9876543210', 'Test', 3);
    assert(fetchAttempts === 1, 'HTTP 429 fast-fails without retrying 3 times');

    global.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized API key',
    });
    const send401Result = await textbee.sendSMS('9876543210', 'Test');
    assert(send401Result.deliveryState === 'AUTH_FAILURE', 'HTTP 401 maps to AUTH_FAILURE');

    // ------------------------------------------------------------------
    // TEST 5: HTTP 5xx Bounded Retries
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

    const send503Result = await textbee.sendSMS('9876543210', 'Test', 2);
    assert(fetchAttempts === 3, 'HTTP 503 retries bounded number of times (1 initial + 2 retries)');
    assert(send503Result.deliveryState === 'PROVIDER_SERVER_ERROR', 'HTTP 503 retries exhausted returns PROVIDER_SERVER_ERROR');

    // ------------------------------------------------------------------
    // TEST 6: OTP Database Cleanup & Invalid Verification Protection
    // ------------------------------------------------------------------
    const syntheticPhone = `99${Date.now().toString().slice(-8)}`;
    const purpose = 'PHONE_VERIFICATION';

    global.fetch = async () => ({
      ok: false,
      status: 429,
      text: async () => 'Quota exceeded',
    });

    let requestFailed = false;
    try {
      await otpService.requestOtp({ identifier: syntheticPhone, phone: syntheticPhone, purpose });
    } catch (err) {
      requestFailed = true;
      assert(err.status === 502, 'Failed SMS delivery throws 502 Bad Gateway');
      assert(
        err.message.includes('rate limits'),
        'Thrown error message is sanitized user error'
      );
    }
    assert(requestFailed === true, 'requestOtp throws on SMS delivery failure');

    // Check database: OTP record MUST be deleted/cleared
    const undeliveredOtp = await prisma.otp.findFirst({
      where: { identifier: syntheticPhone, purpose },
    });
    assert(undeliveredOtp === null, 'Undelivered SMS OTP record is deleted from database so it CANNOT be verified');

    // Verify verifyOtp rejects verification
    let verifyFailed = false;
    try {
      await otpService.verifyOtp({ identifier: syntheticPhone, purpose, otp: '123456' });
    } catch (err) {
      verifyFailed = true;
      assert(err.message.includes('No active OTP found'), 'verifyOtp rejects verification when SMS delivery failed');
    }
    assert(verifyFailed === true, 'OTP verification rejected for undelivered SMS OTP');

    // ------------------------------------------------------------------
    // TEST 7: Valid TextBee Acceptance Response Handling
    // ------------------------------------------------------------------
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { _id: 'textbee-msg-998877' } }),
    });

    const validResult = await textbee.sendSMS('9876543210', 'Test');
    assert(validResult.success === true, 'Provider 200 response returns success = true');
    assert(validResult.messageId === 'textbee-msg-998877', 'Valid response captures provider messageId');
    assert(validResult.deliveryState === 'ACCEPTED_BY_PROVIDER', 'Valid response sets ACCEPTED_BY_PROVIDER state');

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
    process.env.NODE_ENV = originalEnv;
    process.env.DEV_OTP_MODE = originalDevFlag;
    global.fetch = originalFetch;
    await prisma.$disconnect();
  }
}

runTextBeeOtpSecurityTests();
