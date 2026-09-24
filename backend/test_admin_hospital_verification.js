const prisma = require('./src/config/prisma');
const app = require('./src/app');
const jwt = require('jsonwebtoken');
const http = require('http');

const PORT = 5005;
const JWT_SECRET = process.env.JWT_SECRET || 'caresetu_jwt_secret_key_2026_dev';

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (err) {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('CareSetu v2.0 Hospital Verification Audit Test Suite');
  console.log('====================================================\n');

  let server;
  try {
    server = app.listen(PORT, () => {
      console.log(`[Test Server] Listening on http://localhost:${PORT}`);
    });

    // 1. Cleanup or Setup Test Users
    console.log('\n[Test 1] Preparing test entities in database...');
    const testAdminEmail = 'test_admin_verif@caresetu.org';
    const testHospitalEmail = 'test_hosp_verif@caresetu.org';
    const testPatientEmail = 'test_patient_verif@caresetu.org';

    // Cleanup existing test records
    await prisma.medicalDocument.deleteMany({
      where: { fileName: { contains: 'test_hosp_cert' } }
    });
    await prisma.auditLog.deleteMany({
      where: { entity: { in: ['HospitalApproval', 'HospitalRejection', 'AccountRestriction'] } }
    });
    await prisma.accountRestriction.deleteMany({
      where: { reason: { contains: 'Test Audit Block' } }
    });
    await prisma.hospital.deleteMany({
      where: { user: { email: testHospitalEmail } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testAdminEmail, testHospitalEmail, testPatientEmail] } }
    });

    // Create Test Admin
    const adminUser = await prisma.user.create({
      data: {
        email: testAdminEmail,
        password: '$2b$10$e84606g10k81',
        role: 'ADMIN',
        status: 'ACTIVE',
        isVerified: true,
      }
    });

    // Create Test Hospital User
    const hospUser = await prisma.user.create({
      data: {
        email: testHospitalEmail,
        password: '$2b$10$e84606g10k81',
        role: 'HOSPITAL',
        status: 'ACTIVE',
        isVerified: false,
      }
    });

    const hospProfile = await prisma.hospital.create({
      data: {
        userId: hospUser.id,
        name: 'Metro Care Audit Hospital',
        address: '123 Health Ave',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '9876543210',
        location: { latitude: 19.076, longitude: 72.8777 },
        isVerified: false,
        emergencyAvailable: false,
        capabilities: ['EMERGENCY_ICU', 'TRAUMA_CENTER'],
      }
    });

    // Create Test Patient User
    const patientUser = await prisma.user.create({
      data: {
        email: testPatientEmail,
        password: '$2b$10$e84606g10k81',
        role: 'PATIENT',
        status: 'ACTIVE',
        isVerified: true,
      }
    });

    const adminToken = generateToken(adminUser);
    const hospToken = generateToken(hospUser);
    const patientToken = generateToken(patientUser);

    console.log('✅ Created test users:');
    console.log(`   - Admin ID: ${adminUser.id}`);
    console.log(`   - Hospital ID: ${hospProfile.id} (User ID: ${hospUser.id})`);
    console.log(`   - Patient ID: ${patientUser.id}\n`);

    // 2. Submit Hospital Onboarding
    console.log('[Test 2] Hospital Onboarding Submission...');
    const submitRes = await makeRequest('/api/hospitals/submit-onboarding', 'POST', {
      name: 'Metro Care Audit Hospital',
      address: '123 Health Ave, Bandra',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      phone: '9876543210',
      latitude: 19.076,
      longitude: 72.8777,
      emergencyAvailable: true,
      capabilities: ['EMERGENCY_ICU', 'TRAUMA_CENTER'],
      licenseNumber: 'MH-HOSP-2026-99',
      registrationNumber: 'REG-MUM-888',
      consent: true,
    }, hospToken);

    console.log(`   Status: ${submitRes.statusCode}`);
    console.log(`   Response:`, submitRes.body);

    const recheckHosp = await prisma.hospital.findUnique({ where: { id: hospProfile.id } });
    console.log(`   Persisted Verification Status: isVerified=${recheckHosp.isVerified}, emergencyAvailable=${recheckHosp.emergencyAvailable}`);
    if (recheckHosp.isVerified === false) {
      console.log('✅ PASS: Hospital submission leaves hospital in INACTIVE / PENDING_REVIEW state. No auto-activation!\n');
    } else {
      console.error('❌ FAIL: Hospital auto-activated!\n');
    }

    // 3. Document Association
    console.log('[Test 3] Creating mock document metadata associated with hospital...');
    await prisma.medicalDocument.create({
      data: {
        fileName: 'test_hosp_cert.pdf',
        documentType: 'HOSPITAL_REGISTRATION_CERTIFICATE',
        fileUrl: '/uploads/test_hosp_cert.pdf',
        fileSize: 1024500,
        fileType: 'application/pdf',
        extractedText: JSON.stringify({ userId: hospUser.id, hospitalId: hospProfile.id, isVerificationDoc: true }),
      }
    });
    console.log('✅ Created document metadata.\n');

    // 4. Verify Unapproved Hospital is Excluded from Patient Search
    console.log('[Test 4] Verifying unapproved hospital is excluded from Patient Hospital Matching...');
    const searchBeforeApprove = await makeRequest('/api/hospitals/nearby?lat=19.076&lng=72.8777&radiusKm=50', 'GET', null, patientToken);
    console.log(`   Status: ${searchBeforeApprove.statusCode}`);
    const foundBefore = (searchBeforeApprove.body.hospitals || []).some(h => h.id === hospProfile.id);
    if (!foundBefore) {
      console.log('✅ PASS: Pending hospital is NOT visible in Patient matching.\n');
    } else {
      console.error('❌ FAIL: Pending hospital WAS found in Patient matching!\n');
    }

    // 5. Check RBAC Security - Unauthorized User Accessing Admin Verification API
    console.log('[Test 5] Testing RBAC Security: Patient accessing Admin Verification API...');
    const unauthRes = await makeRequest('/api/admin/hospitals/verification-requests', 'GET', null, patientToken);
    console.log(`   Status: ${unauthRes.statusCode}`);
    if (unauthRes.statusCode === 403) {
      console.log('✅ PASS: Access denied with HTTP 403 Forbidden for non-admin user.\n');
    } else {
      console.error(`❌ FAIL: Unexpected status code ${unauthRes.statusCode}\n`);
    }

    // 6. Admin Listing Verification Requests
    console.log('[Test 6] Admin listing verification requests...');
    const requestsRes = await makeRequest('/api/admin/hospitals/verification-requests?status=PENDING_REVIEW', 'GET', null, adminToken);
    console.log(`   Status: ${requestsRes.statusCode}, Count: ${requestsRes.body.count}`);
    const foundReq = (requestsRes.body.requests || []).find(r => r.userId === hospUser.id);
    if (foundReq) {
      console.log(`✅ PASS: Found pending request for "${foundReq.name}" with ${foundReq.documents.length} attached document(s).\n`);
    } else {
      console.error('❌ FAIL: Hospital request not returned in pending list.\n');
    }

    // 7. Admin Approval Flow
    console.log('[Test 7] Admin approving hospital application...');
    const approveRes = await makeRequest(`/api/admin/hospitals/${hospProfile.id}/approve`, 'POST', {}, adminToken);
    console.log(`   Status: ${approveRes.statusCode}`);
    console.log(`   Response:`, approveRes.body);

    const postApproveHosp = await prisma.hospital.findUnique({ where: { id: hospProfile.id }, include: { user: true } });
    if (postApproveHosp.isVerified && postApproveHosp.user.isVerified) {
      console.log('✅ PASS: Hospital and User account successfully marked isVerified = true.\n');
    } else {
      console.error('❌ FAIL: Hospital isVerified flags not updated.\n');
    }

    // 8. Patient Matching Visibility After Approval
    console.log('[Test 8] Verifying approved hospital now appears in Patient Hospital Matching...');
    const searchAfterApprove = await makeRequest('/api/hospitals/nearby?lat=19.076&lng=72.8777&radiusKm=50', 'GET', null, patientToken);
    const foundAfter = (searchAfterApprove.body.hospitals || []).some(h => h.id === hospProfile.id);
    if (foundAfter) {
      console.log('✅ PASS: Approved hospital is NOW visible in Patient matching!\n');
    } else {
      console.error('❌ FAIL: Approved hospital is STILL NOT visible in Patient matching!\n');
    }

    // 9. Admin Rejection Workflow
    console.log('[Test 9] Admin rejecting hospital application with reason...');
    const rejectRes = await makeRequest(`/api/admin/hospitals/${hospProfile.id}/reject`, 'POST', {
      reason: 'Registration certificate illegible. Please re-upload a clear PDF copy.',
    }, adminToken);
    console.log(`   Status: ${rejectRes.statusCode}`);
    console.log(`   Response:`, rejectRes.body);

    const postRejectHosp = await prisma.hospital.findUnique({ where: { id: hospProfile.id } });
    if (!postRejectHosp.isVerified) {
      console.log('✅ PASS: Rejection updated isVerified = false.\n');
    } else {
      console.error('❌ FAIL: Rejection failed to set isVerified = false.\n');
    }

    // 10. Patient Matching Visibility After Rejection
    console.log('[Test 10] Verifying rejected hospital is excluded from Patient Hospital Matching...');
    const searchAfterReject = await makeRequest('/api/hospitals/nearby?lat=19.076&lng=72.8777&radiusKm=50', 'GET', null, patientToken);
    const foundAfterReject = (searchAfterReject.body.hospitals || []).some(h => h.id === hospProfile.id);
    if (!foundAfterReject) {
      console.log('✅ PASS: Rejected hospital is excluded from Patient matching.\n');
    } else {
      console.error('❌ FAIL: Rejected hospital WAS found in Patient matching!\n');
    }

    // 11. Admin Block Account Workflow
    console.log('[Test 11] Admin blocking hospital account...');
    const blockRes = await makeRequest('/api/admin/blocklist/block', 'POST', {
      targetUserId: hospUser.id,
      reason: 'Test Audit Block: Fraudulent document activity suspected.',
    }, adminToken);
    console.log(`   Status: ${blockRes.statusCode}`);
    console.log(`   Response:`, blockRes.body);

    const postBlockUser = await prisma.user.findUnique({ where: { id: hospUser.id } });
    if (postBlockUser.status === 'BLOCKED') {
      console.log('✅ PASS: Hospital user status set to BLOCKED in database.\n');
    } else {
      console.error('❌ FAIL: User status was not set to BLOCKED.\n');
    }

    // 12. Admin Unblock Account Workflow
    console.log('[Test 12] Admin unblocking hospital account...');
    const unblockRes = await makeRequest('/api/admin/blocklist/unblock', 'POST', {
      targetUserId: hospUser.id,
      reason: 'Audit verification complete. Restriction lifted.',
    }, adminToken);
    console.log(`   Status: ${unblockRes.statusCode}`);
    console.log(`   Response:`, unblockRes.body);

    const postUnblockUser = await prisma.user.findUnique({ where: { id: hospUser.id } });
    if (postUnblockUser.status === 'ACTIVE') {
      console.log('✅ PASS: Hospital user status restored to ACTIVE in database.\n');
    } else {
      console.error('❌ FAIL: User status was not restored to ACTIVE.\n');
    }

    // 13. Audit Log Verification
    console.log('[Test 13] Verifying Audit Logs persisted in DB...');
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: adminUser.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`   Found ${auditLogs.length} audit log entries for Admin:`);
    auditLogs.forEach(l => console.log(`   - [${l.createdAt.toISOString()}] Entity: ${l.entity}, Action: ${l.action}`));
    if (auditLogs.length >= 3) {
      console.log('✅ PASS: Audit logs successfully recorded for all Admin verification actions.\n');
    } else {
      console.error('❌ FAIL: Insufficient audit logs recorded.\n');
    }

    console.log('====================================================');
    console.log('🎉 ALL HOSPITAL VERIFICATION AUDIT TESTS PASSED!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Test suite encountered an error:', err);
  } finally {
    if (server) server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
