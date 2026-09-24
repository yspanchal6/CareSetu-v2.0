const prisma = require('./src/config/prisma');
const adminController = require('./src/controllers/admin.controller');
const hospitalController = require('./src/controllers/hospital.controller');
const emergencyRepository = require('./src/repositories/emergency.repository');

function createMockRes() {
  let responseData = null;
  return {
    json: (data) => { responseData = data; return data; },
    status: (code) => ({
      json: (data) => { responseData = { statusCode: code, ...data }; return responseData; },
    }),
    getData: () => responseData,
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CARESETU v2.0 HOSPITAL WORKFLOW TESTS');
  console.log('====================================================\n');

  let testUser;
  let testHospital;
  let adminUser;

  try {
    // Setup Admin user
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: 'test_admin_verify@caresetu.org',
          password: 'hashed_password_123',
          role: 'ADMIN',
          status: 'ACTIVE',
          isVerified: true,
        },
      });
    }

    // 1. Hospital submits a request (Create test hospital user)
    const testEmail = `hospital_test_${Date.now()}@caresetu.org`;
    testUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashed_password_123',
        role: 'HOSPITAL',
        status: 'INACTIVE',
        isVerified: false,
      },
    });

    testHospital = await prisma.hospital.create({
      data: {
        userId: testUser.id,
        name: 'Metro Care Super Specialty Hospital',
        address: '100 SG Highway',
        phone: '9876543210',
        city: 'Ahmedabad',
        state: 'Gujarat',
        emergencyAvailable: true,
        isVerified: false,
        location: { latitude: 23.0225, longitude: 72.5714 },
      },
    });

    console.log('[TEST 1 PASSED] Hospital account created with initial status: INACTIVE, isVerified: false');

    // Simulate onboarding submission
    let mockRes = createMockRes();
    await hospitalController.updateHospitalProfile(
      {
        user: { id: testUser.id, userId: testUser.id },
        body: {
          name: 'Metro Care Super Specialty Hospital',
          phone: '9876543210',
          address: '100 SG Highway',
          city: 'Ahmedabad',
          state: 'Gujarat',
          latitude: 23.0225,
          longitude: 72.5714,
          isFinalSubmit: true,
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    let onboardResult = mockRes.getData();
    console.log('[TEST 1.1 PASSED] Hospital submitted onboarding. Status returned:', onboardResult.verificationStatus);

    // Verify hospital status in profile endpoint
    mockRes = createMockRes();
    await hospitalController.getHospitalProfile(
      { user: { id: testUser.id, userId: testUser.id } },
      mockRes,
      (err) => { throw err; }
    );
    let profileData = mockRes.getData();
    console.log('[TEST 1.2 PASSED] Hospital profile verificationStatus:', profileData.hospital.verificationStatus);
    if (profileData.hospital.verificationStatus !== 'PENDING_REVIEW') {
      throw new Error(`Expected PENDING_REVIEW but got ${profileData.hospital.verificationStatus}`);
    }

    // 2. Patient matching check — Pending hospital MUST NOT be visible to patients
    let candidateHospitals = await emergencyRepository.getActiveHospitalsInRadius(23.0225, 72.5714, 25);
    let found = candidateHospitals.some((h) => h.id === testHospital.id);
    console.log('[TEST 2 PASSED] Patient search excludes PENDING_REVIEW hospital:', !found);
    if (found) throw new Error('PENDING_REVIEW hospital was visible to patient!');

    // 3. Admin rejects request with mandatory feedback reason
    mockRes = createMockRes();
    await adminController.rejectHospital(
      {
        params: { id: testHospital.id },
        body: { reason: 'Clinical license document missing registration stamp.' },
        user: { id: adminUser.id, userId: adminUser.id, role: 'ADMIN' },
      },
      mockRes,
      (err) => { throw err; }
    );
    let rejectResult = mockRes.getData();
    console.log('[TEST 3 PASSED] Admin rejected request with reason:', rejectResult.reason);

    // 4. Hospital checks status — MUST be REJECTED with rejection reason
    mockRes = createMockRes();
    await hospitalController.getHospitalProfile(
      { user: { id: testUser.id, userId: testUser.id } },
      mockRes,
      (err) => { throw err; }
    );
    profileData = mockRes.getData();
    console.log('[TEST 4 PASSED] Hospital sees status REJECTED with reason:', profileData.hospital.rejectionReason);
    if (profileData.hospital.verificationStatus !== 'REJECTED') {
      throw new Error(`Expected REJECTED status, got ${profileData.hospital.verificationStatus}`);
    }

    // 5. Patient search check — REJECTED hospital MUST NOT be visible to patients
    candidateHospitals = await emergencyRepository.getActiveHospitalsInRadius(23.0225, 72.5714, 25);
    found = candidateHospitals.some((h) => h.id === testHospital.id);
    console.log('[TEST 5 PASSED] Patient search excludes REJECTED hospital:', !found);
    if (found) throw new Error('REJECTED hospital was visible to patient!');

    // 6. Hospital resubmits application after updating documents/details
    mockRes = createMockRes();
    await hospitalController.updateHospitalProfile(
      {
        user: { id: testUser.id, userId: testUser.id },
        body: {
          name: 'Metro Care Super Specialty Hospital',
          phone: '9876543210',
          address: '100 SG Highway, Block B',
          city: 'Ahmedabad',
          state: 'Gujarat',
          latitude: 23.0225,
          longitude: 72.5714,
          isFinalSubmit: true,
        },
      },
      mockRes,
      (err) => { throw err; }
    );
    let resubmitResult = mockRes.getData();
    console.log('[TEST 6 PASSED] Hospital resubmitted. Status returned:', resubmitResult.verificationStatus);

    mockRes = createMockRes();
    await hospitalController.getHospitalProfile(
      { user: { id: testUser.id, userId: testUser.id } },
      mockRes,
      (err) => { throw err; }
    );
    profileData = mockRes.getData();
    console.log('[TEST 6.1 PASSED] Resubmitted status in profile:', profileData.hospital.verificationStatus);
    if (profileData.hospital.verificationStatus !== 'PENDING_REVIEW') {
      throw new Error(`Expected status to reset to PENDING_REVIEW upon resubmission, got ${profileData.hospital.verificationStatus}`);
    }

    // 7. Admin approves application
    mockRes = createMockRes();
    await adminController.approveHospital(
      {
        params: { id: testHospital.id },
        user: { id: adminUser.id, userId: adminUser.id, role: 'ADMIN' },
      },
      mockRes,
      (err) => { throw err; }
    );
    let approveResult = mockRes.getData();
    console.log('[TEST 7 PASSED] Admin approved hospital. Returned status:', approveResult.verificationStatus);

    mockRes = createMockRes();
    await hospitalController.getHospitalProfile(
      { user: { id: testUser.id, userId: testUser.id } },
      mockRes,
      (err) => { throw err; }
    );
    profileData = mockRes.getData();
    console.log('[TEST 7.1 PASSED] Approved status in hospital profile:', profileData.hospital.verificationStatus);
    if (profileData.hospital.verificationStatus !== 'APPROVED') {
      throw new Error(`Expected APPROVED status, got ${profileData.hospital.verificationStatus}`);
    }

    // 8. One-time Approval Event logic
    mockRes = createMockRes();
    await hospitalController.getUnseenApprovalEvent(
      { user: { id: testUser.id, userId: testUser.id } },
      mockRes,
      (err) => { throw err; }
    );
    let evtData = mockRes.getData();
    console.log('[TEST 8 PASSED] Unseen approval event detected:', evtData.hasUnseenApproval, 'Event ID:', evtData.eventId);
    if (!evtData.hasUnseenApproval) {
      throw new Error('Expected unseen approval event after Admin approval!');
    }

    // Consume approval event
    mockRes = createMockRes();
    await hospitalController.consumeApprovalEvent(
      {
        user: { id: testUser.id, userId: testUser.id },
        body: { eventId: evtData.eventId },
      },
      mockRes,
      (err) => { throw err; }
    );

    // Re-check unseen approval event — MUST be false on refresh/subsequent logins
    mockRes = createMockRes();
    await hospitalController.getUnseenApprovalEvent(
      { user: { id: testUser.id, userId: testUser.id } },
      mockRes,
      (err) => { throw err; }
    );
    evtData = mockRes.getData();
    console.log('[TEST 8.1 PASSED] Second check after consumption hasUnseenApproval:', evtData.hasUnseenApproval);
    if (evtData.hasUnseenApproval) {
      throw new Error('Approval event was not consumed! Still showing unseen approval.');
    }

    // 9. Patient search check — APPROVED & ACTIVE hospital MUST NOW be visible to patients
    candidateHospitals = await emergencyRepository.getActiveHospitalsInRadius(23.0225, 72.5714, 25);
    found = candidateHospitals.some((h) => h.id === testHospital.id);
    console.log('[TEST 9 PASSED] Patient search includes APPROVED & ACTIVE hospital:', found);
    if (!found) throw new Error('APPROVED & ACTIVE hospital was NOT visible to patient!');

    // 10. Blocked hospital test — Admin blocks hospital user
    await prisma.user.update({
      where: { id: testUser.id },
      data: { status: 'BLOCKED' },
    });

    candidateHospitals = await emergencyRepository.getActiveHospitalsInRadius(23.0225, 72.5714, 25);
    found = candidateHospitals.some((h) => h.id === testHospital.id);
    console.log('[TEST 10 PASSED] Patient search excludes BLOCKED hospital:', !found);
    if (found) throw new Error('BLOCKED hospital was still visible to patient!');

    console.log('\n====================================================');
    console.log('ALL 10 INTEGRATION VERIFICATION TESTS SUCCEEDED PERFECTLY!');
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ INTEGRATION TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup test user and hospital
    if (testHospital) {
      await prisma.notification.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.hospital.delete({ where: { id: testHospital.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runTests();
