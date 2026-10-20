const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const otpDispatcher = require('../src/services/otp-dispatcher.service');
const msg91Provider = require('../src/services/providers/msg91.provider');
const twoFactorProvider = require('../src/services/providers/twofactor.provider');
const brevoProvider = require('../src/services/providers/brevo.provider');

async function runOtpFallbackTests() {
  console.log('==================================================');
  console.log('  CARESETU MULTI-PROVIDER OTP FALLBACK TEST SUITE ');
  console.log('==================================================\n');

  // Save original methods
  const origMsg91Send = msg91Provider.sendOtp;
  const origTwoFactorSend = twoFactorProvider.sendOtp;
  const origBrevoSend = brevoProvider.sendEmail;

  try {
    // ------------------------------------------------------------------
    // TEST 1: Primary Success (MSG91 succeeds)
    // ------------------------------------------------------------------
    console.log('[TEST 1] Primary SMS Provider (MSG91) succeeds');
    msg91Provider.sendOtp = async (phone, otp) => ({
      success: true,
      provider: 'msg91',
      deliveryState: 'ACCEPTED_BY_PROVIDER',
      messageId: 'msg91-tx-12345',
    });
    twoFactorProvider.sendOtp = async () => {
      throw new Error('2Factor should not be called when MSG91 succeeds');
    };
    brevoProvider.sendEmail = async () => {
      throw new Error('Brevo should not be called when MSG91 succeeds');
    };

    const res1 = await otpDispatcher.dispatchOtp({
      phone: '9876543210',
      email: 'test@caresetu.local',
      otp: '123456',
      purpose: 'LOGIN',
    });

    assert(res1.delivered === true, 'Test 1: OTP reported as delivered');
    assert(res1.finalDeliveryInfo.provider === 'msg91', 'Test 1: Delivered via msg91');
    assert(res1.finalDeliveryInfo.channel === 'sms', 'Test 1: Delivered via sms');
    assert(res1.auditTrail.length === 1, 'Test 1: Only MSG91 was called');
    console.log('  ✅ PASS: Primary SMS provider delivered OTP without triggering fallback.\n');

    // ------------------------------------------------------------------
    // TEST 2: Primary Fails, Secondary (2Factor) Succeeds
    // ------------------------------------------------------------------
    console.log('[TEST 2] Primary SMS (MSG91) fails -> Fallback to Secondary (2Factor) succeeds');
    msg91Provider.sendOtp = async () => ({
      success: false,
      provider: 'msg91',
      deliveryState: 'REJECTED_BY_PROVIDER',
      error: 'MSG91 gateway timeout',
    });
    twoFactorProvider.sendOtp = async (phone, otp) => ({
      success: true,
      provider: '2factor',
      deliveryState: 'ACCEPTED_BY_PROVIDER',
      messageId: '2factor-sess-9988',
    });
    brevoProvider.sendEmail = async () => {
      throw new Error('Brevo should not be called when 2Factor succeeds');
    };

    const res2 = await otpDispatcher.dispatchOtp({
      phone: '9876543210',
      email: 'test@caresetu.local',
      otp: '123456',
      purpose: 'LOGIN',
    });

    assert(res2.delivered === true, 'Test 2: OTP reported as delivered');
    assert(res2.finalDeliveryInfo.provider === '2factor', 'Test 2: Delivered via 2factor');
    assert(res2.auditTrail.length === 2, 'Test 2: Both MSG91 and 2Factor recorded in audit');
    assert(res2.auditTrail[0].provider === 'msg91' && !res2.auditTrail[0].success, 'Test 2: MSG91 marked failed');
    assert(res2.auditTrail[1].provider === '2factor' && res2.auditTrail[1].success, 'Test 2: 2Factor marked success');
    console.log('  ✅ PASS: Automatically fell back from MSG91 to 2Factor.\n');

    // ------------------------------------------------------------------
    // TEST 3: Both SMS Providers Fail -> Fallback to Brevo Email Succeeds
    // ------------------------------------------------------------------
    console.log('[TEST 3] Both SMS providers fail -> Fallback to Brevo (Email) succeeds');
    msg91Provider.sendOtp = async () => ({
      success: false,
      provider: 'msg91',
      deliveryState: 'QUOTA_EXCEEDED',
      error: 'MSG91 quota exceeded',
    });
    twoFactorProvider.sendOtp = async () => ({
      success: false,
      provider: '2factor',
      deliveryState: 'REJECTED_BY_PROVIDER',
      error: '2Factor template not approved',
    });
    brevoProvider.sendEmail = async () => ({
      success: true,
      provider: 'brevo',
      deliveryState: 'ACCEPTED_BY_PROVIDER',
      messageId: 'brevo-msg-5544',
    });

    const res3 = await otpDispatcher.dispatchOtp({
      phone: '9876543210',
      email: 'verified.patient@caresetu.local',
      otp: '123456',
      purpose: 'LOGIN',
    });

    assert(res3.delivered === true, 'Test 3: OTP reported as delivered');
    assert(res3.finalDeliveryInfo.provider === 'brevo', 'Test 3: Delivered via brevo');
    assert(res3.finalDeliveryInfo.channel === 'email', 'Test 3: Channel is email');
    assert(res3.auditTrail.length === 3, 'Test 3: All 3 providers recorded in audit');
    console.log('  ✅ PASS: Successfully fell back to verified email via Brevo.\n');

    // ------------------------------------------------------------------
    // TEST 4: Both SMS Fail and No Verified Email Exists -> Clean Rejection
    // ------------------------------------------------------------------
    console.log('[TEST 4] Both SMS providers fail and NO verified email provided');
    msg91Provider.sendOtp = async () => ({ success: false, provider: 'msg91', error: 'Fail' });
    twoFactorProvider.sendOtp = async () => ({ success: false, provider: '2factor', error: 'Fail' });
    let brevoCalled = false;
    brevoProvider.sendEmail = async () => { brevoCalled = true; };

    const res4 = await otpDispatcher.dispatchOtp({
      phone: '9876543210',
      email: null, // No email securely associated
      otp: '123456',
      purpose: 'LOGIN',
    });

    assert(res4.delivered === false, 'Test 4: Delivery reported as false');
    assert(brevoCalled === false, 'Test 4: Brevo never called without verified email');
    assert(res4.auditTrail.length === 2, 'Test 4: Only SMS providers evaluated');
    console.log('  ✅ PASS: Securely rejected delivery without dispatching to arbitrary email.\n');

    // ------------------------------------------------------------------
    // TEST 5: All Providers Fail -> Clean Failure Handled Safely
    // ------------------------------------------------------------------
    console.log('[TEST 5] All providers fail (MSG91, 2Factor, Brevo)');
    msg91Provider.sendOtp = async () => ({ success: false, provider: 'msg91', error: 'Down' });
    twoFactorProvider.sendOtp = async () => ({ success: false, provider: '2factor', error: 'Down' });
    brevoProvider.sendEmail = async () => ({ success: false, provider: 'brevo', error: 'Down' });

    const res5 = await otpDispatcher.dispatchOtp({
      phone: '9876543210',
      email: 'test@caresetu.local',
      otp: '123456',
      purpose: 'LOGIN',
    });

    assert(res5.delivered === false, 'Test 5: Delivered is false');
    assert(res5.finalDeliveryInfo === null, 'Test 5: No final delivery info');
    assert(res5.auditTrail.length === 3, 'Test 5: All 3 attempts audited');
    console.log('  ✅ PASS: Handled catastrophic outage across all providers safely.\n');

    // ------------------------------------------------------------------
    // TEST 6: Phone Masking & Privacy Checks
    // ------------------------------------------------------------------
    console.log('[TEST 6] Phone masking & privacy audit');
    const masked1 = msg91Provider.maskPhone('9876543210');
    const masked2 = twoFactorProvider.maskPhone('+919876543210');
    assert(masked1 === '+91 98*** **210', `Masked phone format correct: ${masked1}`);
    assert(masked2 === '+91 98*** **210', `Masked phone format correct: ${masked2}`);
    console.log('  ✅ PASS: Phone numbers strictly masked in logs.\n');

    // ------------------------------------------------------------------
    // TEST 7: Phone Normalization for DLT
    // ------------------------------------------------------------------
    console.log('[TEST 7] Indian mobile number normalization');
    assert(msg91Provider.normalizePhone('+919876543210') === '9876543210', 'Normalized +91');
    assert(msg91Provider.normalizePhone('09876543210') === '9876543210', 'Normalized leading zero');
    assert(msg91Provider.normalizePhone('9876543210') === '9876543210', 'Normalized 10 digits');
    console.log('  ✅ PASS: Indian phone numbers properly formatted for DLT gateway.\n');

    console.log('==================================================');
    console.log('  ALL 7 MULTI-PROVIDER OTP FALLBACK TESTS PASSED  ');
    console.log('==================================================');
  } finally {
    // Restore original methods
    msg91Provider.sendOtp = origMsg91Send;
    twoFactorProvider.sendOtp = origTwoFactorSend;
    brevoProvider.sendEmail = origBrevoSend;
  }
}

runOtpFallbackTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
