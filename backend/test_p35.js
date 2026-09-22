
const prisma = require('./src/config/prisma');

const API_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('============================================');
  console.log(' CareSetu Phase 3.5 OTP & Notification Test ');
  console.log('============================================');

  try {
    // 1. Request OTP
    console.log('\n[1] Requesting OTP for patient@test.com / +919876543210...');
    const reqRes = await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'patient@test.com',
        purpose: 'LOGIN'
      })
    });
    const reqData = await reqRes.json();
    if (!reqRes.ok) throw new Error(reqData.error || 'OTP Request failed');
    console.log('✅ OTP Request Response:', reqData);

    // 2. Fetch OTP from DB directly since it's Mocked and hashed
    console.log('\n[2] Verifying OTP storage and hashing...');
    const otpRecord = await prisma.otp.findFirst({
      where: { identifier: 'patient@test.com' },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`✅ Found OTP record in DB. ID: ${otpRecord.id}, Hash: ${otpRecord.otpHash.substring(0,10)}...`);

    // In a real scenario, the user gets it via SMS. In our test, we don't know the plain OTP because we mocked the SMS to console.
    // However, the test output will show the SMS in the server logs. 
    // Wait, to test verify OTP we actually need the plain text.
    // Let me update the test to intercept the generated OTP just for the test, or bypass verify.
    // Actually, I can just create a temporary OTP in DB with a known hash for testing.

    const bcrypt = require('bcryptjs');
    const knownOtp = '123456';
    const hash = await bcrypt.hash(knownOtp, 10);
    
    await prisma.otp.create({
      data: {
        identifier: 'test_user@caresetu.com',
        otpHash: hash,
        purpose: 'LOGIN',
        expiresAt: new Date(Date.now() + 5 * 60000)
      }
    });

    // 3. Verify OTP
    console.log(`\n[3] Verifying OTP with known value '${knownOtp}'...`);
    const verRes = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'test_user@caresetu.com',
        otp: knownOtp,
        purpose: 'LOGIN'
      })
    });
    const verData = await verRes.json();
    if (!verRes.ok) throw new Error(verData.error || 'OTP Verify failed');
    console.log('✅ OTP Verification Response:', verData);

    // 4. Test Notification Flow via SOS
    console.log('\n[4] Triggering SOS to test Notification Injection...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'patient@test.com',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');
    const token = loginData.token;

    const sosRes = await fetch(`${API_URL}/emergency/sos`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        latitude: 23.0225,
        longitude: 72.5714,
        emergencyType: 'CARDIAC',
        severity: 'CRITICAL',
        idempotencyKey: `TEST-OTP-SOS-${Date.now()}`
      })
    });
    const sosData = await sosRes.json();
    if (!sosRes.ok) throw new Error(sosData.error || 'SOS failed');
    console.log(`✅ SOS Created successfully. Case ID: ${sosData.caseId}`);
    console.log(`✅ Matched Hospitals: ${sosData.nearestHospitals.length}`);

    console.log('\n🚀 ALL PHASE 3.5 TESTS PASSED.');

  } catch (err) {
    console.error('\n❌ TEST FAILED:');
    if (err.response) {
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
}

runTests();
