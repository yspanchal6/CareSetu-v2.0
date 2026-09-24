const prisma = require('./src/config/prisma');
const { updateHospitalProfile, submitHospitalOnboarding } = require('./src/controllers/hospital.controller');
const { getActiveHospitalsInRadius } = require('./src/repositories/emergency.repository');

async function runVerificationTests() {
  console.log('=== STARTING HOSPITAL SUBMISSION & PATIENT RANGE VERIFICATION TESTS ===\n');
  let testPassCount = 0;
  let testFailCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testPassCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testFailCount++;
    }
  }

  try {
    // 1. Find or create a test hospital user & profile
    const testEmail = 'test_hosp_verification_' + Date.now() + '@caresetu.local';
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'dummy_hash',
        role: 'HOSPITAL',
        status: 'ACTIVE'
      }
    });

    const testHospital = await prisma.hospital.create({
      data: {
        userId: testUser.id,
        name: 'Test Range Verification Hospital',
        address: '123 Healthcare Ave, MG Road',
        phone: '9876543210',
        city: 'New Delhi',
        state: 'Delhi',
        location: { latitude: 28.6139, longitude: 77.2090 },
        emergencyAvailable: true,
        isVerified: false
      }
    });

    assert(testHospital.isVerified === false, 'New hospital initialized as unverified (isVerified = false)');

    // 2. Test Invalid Coordinate Validation
    console.log('\n--- Test Case 1: Hospital Coordinate Range Validation ---');
    let mockReqInvalidCoords = {
      user: { id: testUser.id, role: 'HOSPITAL' },
      body: {
        name: 'Test Hospital',
        address: 'Address 1',
        city: 'Delhi',
        state: 'Delhi',
        phone: '9999999999',
        latitude: 195.0, // Invalid lat (>90)
        longitude: 77.2,
        isFinalSubmit: true
      }
    };
    let mockRes1 = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; }
    };
    await updateHospitalProfile(mockReqInvalidCoords, mockRes1);
    assert(mockRes1.statusCode === 400, 'Rejects latitude > 90 with HTTP 400');
    assert(mockRes1.responseData.error?.includes('latitude'), 'Returns clear latitude validation message');

    // 3. Test Successful Onboarding Submission Transaction & Audit Log
    console.log('\n--- Test Case 2: Hospital Onboarding Final Submission Transaction ---');
    let mockReqSubmit = {
      user: { id: testUser.id, role: 'HOSPITAL' },
      body: {
        name: 'Test Range Verification Hospital',
        address: '123 Healthcare Ave, MG Road',
        city: 'New Delhi',
        state: 'Delhi',
        latitude: 28.6139,
        longitude: 77.2090,
        phone: '9876543210',
        capabilities: ['Trauma Center', 'ICU'],
        consentAgreed: true,
        idempotencyKey: 'idemp_key_' + Date.now()
      }
    };
    let mockResSubmit = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.responseData = data; return this; }
    };

    await submitHospitalOnboarding(mockReqSubmit, mockResSubmit);
    assert(mockResSubmit.statusCode === undefined || mockResSubmit.statusCode === 200, 'Onboarding submission returned HTTP 200 OK');
    assert(mockResSubmit.responseData?.success === true, 'Response payload has success: true');
    assert(mockResSubmit.responseData?.verificationStatus === 'PENDING_REVIEW', 'Status set to PENDING_REVIEW');
    assert(mockResSubmit.responseData?.onboardingStatus === 'SUBMITTED', 'Onboarding status set to SUBMITTED');

    // Check Database Audit Log
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: testUser.id, action: 'PROFILE_UPDATED' }
    });
    assert(auditLogs.length > 0, 'Audit log created for onboarding submission');

    // 4. Test Range-Based Visibility (Pending hospital excluded)
    console.log('\n--- Test Case 3: Range-Based Hospital Visibility Exclusion of Pending Hospitals ---');
    const nearbyUnverified = await getActiveHospitalsInRadius(28.6139, 77.2090, 50);
    const unverifiedMatch = nearbyUnverified.find(h => h.id === testHospital.id);
    assert(!unverifiedMatch, 'Unverified / PENDING_REVIEW hospital is EXCLUDED from patient search results');

    // 5. Test Range-Based Visibility (Approved hospital inclusion & radius filter)
    console.log('\n--- Test Case 4: Range-Based Hospital Search for Approved Hospitals ---');
    // Approve the hospital in DB
    await prisma.hospital.update({
      where: { id: testHospital.id },
      data: { isVerified: true }
    });

    const nearbyWithin50km = await getActiveHospitalsInRadius(28.6139, 77.2090, 50);
    const verifiedMatch50 = nearbyWithin50km.find(h => h.id === testHospital.id);
    assert(!!verifiedMatch50, 'Approved hospital IS INCLUDED when within 50 km radius');

    const nearbyWithin1km = await getActiveHospitalsInRadius(28.6239, 77.2090, 0.001); // 1 meter radius query from 1.1 km away
    const verifiedMatch1m = nearbyWithin1km.find(h => h.id === testHospital.id);
    assert(!verifiedMatch1m, 'Approved hospital outside tiny 1m search radius is correctly filtered out');

    // Cleanup
    await prisma.auditLog.deleteMany({ where: { userId: testUser.id } });
    await prisma.hospital.delete({ where: { id: testHospital.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('\nCleaned up test data.');

  } catch (err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    await prisma.$disconnect();
    console.log(`\n=== SUMMARY: Passed: ${testPassCount}, Failed: ${testFailCount} ===`);
  }
}

runVerificationTests();
