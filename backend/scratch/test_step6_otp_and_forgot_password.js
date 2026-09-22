const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('STEP 6 AUTOMATED VERIFICATION SUITE');
  console.log('OTP Back Button & Dual-OTP Forgot Password System');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Generate unique test user credentials
  const timestamp = Date.now();
  const testUser = {
    name: 'Step6 Test User',
    email: `step6_${timestamp}@caresetu.com`,
    password: 'Password123!',
    phone: `98${String(timestamp).slice(-8)}`,
    role: 'PATIENT',
    age: 30,
    gender: 'Male',
  };

  try {
    // 1. Request OTP for registration
    console.log('1. Testing Registration OTP Request & Cancellation...');
    const regOtpRes = await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testUser.email,
        email: testUser.email,
        purpose: 'EMAIL_VERIFICATION',
      }),
    });
    const regOtpData = await regOtpRes.json();
    assert(regOtpRes.ok && regOtpData.success, 'Registration OTP request accepted');

    // Test Back button cancellation endpoint
    const cancelRes = await fetch(`${API_URL}/auth/cancel-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.email }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.ok && cancelData.success, 'Registration cancellation (Back button trigger) succeeded');

    // Verify registration now proceeds after verifying email & phone
    const emailOtpReq = await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.email, email: testUser.email, purpose: 'EMAIL_VERIFICATION' }),
    });
    const emailOtpData = await emailOtpReq.json();
    assert(emailOtpReq.ok && emailOtpData.devOtp, 'Email OTP generated with devOtp');

    const verifyEmail = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.email, otpCode: emailOtpData.devOtp, purpose: 'EMAIL_VERIFICATION' }),
    });
    assert(verifyEmail.ok, 'Email OTP verified successfully');

    const phoneOtpReq = await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.phone, phone: testUser.phone, purpose: 'PHONE_VERIFICATION' }),
    });
    const phoneOtpData = await phoneOtpReq.json();
    assert(phoneOtpReq.ok && phoneOtpData.devOtp, 'Phone OTP generated with devOtp');

    const verifyPhone = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.phone, otpCode: phoneOtpData.devOtp, purpose: 'PHONE_VERIFICATION' }),
    });
    assert(verifyPhone.ok, 'Phone OTP verified successfully');

    // Create user account
    const signupRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const signupData = await signupRes.json();
    assert(signupRes.ok && signupData.token, 'Test user account created successfully');

    // 2. Account Enumeration Protection Test
    console.log('\n2. Testing Account Enumeration Protection (Forgot Password)...');
    const nonExistentRes = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@caresetu.com', phone: '9876543210' }),
    });
    const nonExistentData = await nonExistentRes.json();
    assert(
      nonExistentRes.ok && nonExistentData.message.includes('If an account matching'),
      'Non-existent account returns non-revealing generic message'
    );

    // 3. Dual-OTP Forgot Password Request
    console.log('\n3. Testing 2-Step Dual OTP Forgot Password Flow...');
    const forgotRes = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, phone: testUser.phone }),
    });
    const forgotData = await forgotRes.json();
    assert(forgotRes.ok && forgotData.devEmailOtp && forgotData.devPhoneOtp, 'Dual OTPs (Email & SMS) dispatched successfully');

    const emailOtp = forgotData.devEmailOtp;
    const phoneOtp = forgotData.devPhoneOtp;

    // 4. Test Phone OTP verification BEFORE Email OTP (should fail)
    console.log('\n4. Testing Phone OTP verification without prior Email OTP...');
    const prematurePhoneVerify = await fetch(`${API_URL}/auth/verify-reset-phone-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, phone: testUser.phone, otpCode: phoneOtp }),
    });
    assert(!prematurePhoneVerify.ok, 'Phone verification fails if Email OTP was not verified first');

    // 5. Verify Step 1: Email OTP
    console.log('\n5. Testing Step 1: Verify Email OTP...');
    const verifyEmailReset = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUser.email, otpCode: emailOtp, purpose: 'PASSWORD_RESET_EMAIL' }),
    });
    assert(verifyEmailReset.ok, 'Step 1: Email OTP verified successfully');

    // 6. Verify Step 2: Phone OTP (gets resetToken)
    console.log('\n6. Testing Step 2: Verify Phone OTP & Issue Reset Token...');
    const verifyPhoneReset = await fetch(`${API_URL}/auth/verify-reset-phone-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, phone: testUser.phone, otpCode: phoneOtp }),
    });
    const verifyPhoneResetData = await verifyPhoneReset.json();
    if (!verifyPhoneReset.ok) {
      console.error('verifyPhoneReset Error details:', verifyPhoneResetData);
    }
    assert(
      verifyPhoneReset.ok && verifyPhoneResetData.resetToken,
      'Step 2: Phone OTP verified and single-use resetToken issued'
    );

    const resetToken = verifyPhoneResetData.resetToken;

    // 7. Reset Password with resetToken
    console.log('\n7. Testing Password Reset with Token...');
    const newPassword = 'NewSecretPassword99!';
    const resetRes = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        resetToken,
        newPassword,
        confirmPassword: newPassword,
      }),
    });
    const resetData = await resetRes.json();
    assert(resetRes.ok && resetData.success, 'Password reset succeeded');

    // 8. Test Single-Use Reset Token Reuse (should fail)
    console.log('\n8. Testing Reset Token Reuse...');
    const reuseRes = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        resetToken,
        newPassword: 'AnotherPassword123!',
        confirmPassword: 'AnotherPassword123!',
      }),
    });
    assert(!reuseRes.ok, 'Reusing previously consumed resetToken fails');

    // 9. Login Verification with Old vs New Password
    console.log('\n9. Verifying Login with New vs Old Password...');
    const oldLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    assert(!oldLoginRes.ok, 'Login with old password fails as expected');

    const newLoginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: newPassword }),
    });
    const newLoginData = await newLoginRes.json();
    assert(newLoginRes.ok && newLoginData.user, 'Login with new password succeeds!');

    // 10. Testing Forgot Password Cancel (Back Button)
    console.log('\n10. Testing Forgot Password Back Button Cancellation...');
    await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, phone: testUser.phone }),
    });
    const cancelForgotRes = await fetch(`${API_URL}/auth/cancel-forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, phone: testUser.phone }),
    });
    assert(cancelForgotRes.ok, 'Back button click cancels pending forgot password OTP session cleanly');
  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
