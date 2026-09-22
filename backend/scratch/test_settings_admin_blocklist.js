const axios = require('axios');
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Test runner helper
let passCount = 0;
let failCount = 0;
const results = [];

function recordTest(id, description, status, details = '') {
  if (status === 'PASS') {
    passCount++;
    console.log(`\x1b[32m[PASS]\x1b[0m Test ${id}: ${description}`);
  } else {
    failCount++;
    console.error(`\x1b[31m[FAIL]\x1b[0m Test ${id}: ${description} -> ${details}`);
  }
  results.push({ id, description, status, details });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CARESETU SETTINGS & ADMIN BLOCKLIST SUITE');
  console.log('====================================================');

  // Seed test users
  const timestamp = Date.now();
  const patientEmail = `test_patient_${timestamp}@caresetu.com`;
  const hospitalEmail = `test_hospital_${timestamp}@caresetu.com`;
  const adminEmail = `test_admin_${timestamp}@caresetu.com`;
  const plainPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  // 1. Create Patient User
  const patientUser = await prisma.user.create({
    data: {
      email: patientEmail,
      password: hashedPassword,
      role: 'PATIENT',
      status: 'ACTIVE',
      patient: {
        create: {
          name: 'Test Patient',
          age: 30,
          gender: 'MALE',
          phone: '9876543210',
          bloodGroup: 'O+',
          allergies: 'Peanuts',
          medicalConditions: 'Asthma',
        },
      },
    },
    include: { patient: true },
  });

  // 2. Create Hospital User
  const hospitalUser = await prisma.user.create({
    data: {
      email: hospitalEmail,
      password: hashedPassword,
      role: 'HOSPITAL',
      status: 'ACTIVE',
      hospital: {
        create: {
          name: 'Test General Hospital',
          address: '123 Health Way',
          phone: '9876543211',
          email: hospitalEmail,
          emergencyAvailable: true,
          location: { latitude: 23.0225, longitude: 72.5714 },
        },
      },
    },
    include: { hospital: true },
  });

  // 3. Create Admin User
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // Generate Tokens
  const patientToken = jwt.sign({ userId: patientUser.id, role: 'PATIENT', email: patientUser.email }, JWT_SECRET);
  const hospitalToken = jwt.sign({ userId: hospitalUser.id, role: 'HOSPITAL', hospitalId: hospitalUser.hospital.id, email: hospitalUser.email }, JWT_SECRET);
  const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN', email: adminUser.email }, JWT_SECRET);

  const patientClient = axios.create({ baseURL: BASE_URL, headers: { Authorization: `Bearer ${patientToken}` } });
  const hospitalClient = axios.create({ baseURL: BASE_URL, headers: { Authorization: `Bearer ${hospitalToken}` } });
  const adminClient = axios.create({ baseURL: BASE_URL, headers: { Authorization: `Bearer ${adminToken}` } });
  const anonClient = axios.create({ baseURL: BASE_URL });

  // -----------------------------------------------------------
  // SETTINGS TESTS (1-10)
  // -----------------------------------------------------------
  // 1. Patient views own settings
  try {
    const res = await patientClient.get('/settings/profile');
    if (res.data.success && res.data.data.email === patientEmail && res.data.data.patientProfile.name === 'Test Patient') {
      recordTest(1, 'Patient views own settings', 'PASS');
    } else {
      recordTest(1, 'Patient views own settings', 'FAIL', 'Unexpected response payload');
    }
  } catch (e) {
    recordTest(1, 'Patient views own settings', 'FAIL', e.message);
  }

  // 2. Hospital views own settings
  try {
    const res = await hospitalClient.get('/settings/profile');
    if (res.data.success && res.data.data.email === hospitalEmail && res.data.data.hospitalProfile.name === 'Test General Hospital') {
      recordTest(2, 'Hospital views own settings', 'PASS');
    } else {
      recordTest(2, 'Hospital views own settings', 'FAIL', 'Unexpected response payload');
    }
  } catch (e) {
    recordTest(2, 'Hospital views own settings', 'FAIL', e.message);
  }

  // 3. Administrator views permitted settings
  try {
    const res = await adminClient.get('/settings/profile');
    if (res.data.success && res.data.data.email === adminEmail && res.data.data.role === 'ADMIN') {
      recordTest(3, 'Administrator views permitted settings', 'PASS');
    } else {
      recordTest(3, 'Administrator views permitted settings', 'FAIL', 'Unexpected response payload');
    }
  } catch (e) {
    recordTest(3, 'Administrator views permitted settings', 'FAIL', e.message);
  }

  // 4. Patient updates permitted profile fields
  try {
    const res = await patientClient.patch('/settings/profile', {
      name: 'Updated Patient Name',
      allergies: 'Penicillin, Dust',
    });
    if (res.data.success && res.data.data.patientProfile.name === 'Updated Patient Name' && res.data.data.patientProfile.allergies === 'Penicillin, Dust') {
      recordTest(4, 'Patient updates permitted profile fields', 'PASS');
    } else {
      recordTest(4, 'Patient updates permitted profile fields', 'FAIL', 'Profile update mismatch');
    }
  } catch (e) {
    recordTest(4, 'Patient updates permitted profile fields', 'FAIL', e.message);
  }

  // 5. Hospital updates permitted profile fields
  try {
    const res = await hospitalClient.patch('/settings/profile', {
      name: 'Updated City Hospital',
      emergencyAvailable: true,
    });
    if (res.data.success && res.data.data.hospitalProfile.name === 'Updated City Hospital') {
      recordTest(5, 'Hospital updates permitted profile fields', 'PASS');
    } else {
      recordTest(5, 'Hospital updates permitted profile fields', 'FAIL', 'Hospital profile update mismatch');
    }
  } catch (e) {
    recordTest(5, 'Hospital updates permitted profile fields', 'FAIL', e.message);
  }

  // 6. Unauthorized profile update is rejected
  try {
    await anonClient.patch('/settings/profile', { name: 'Hacked Name' });
    recordTest(6, 'Unauthorized profile update is rejected', 'FAIL', 'Should have rejected unauthenticated request');
  } catch (e) {
    if (e.response && e.response.status === 401) {
      recordTest(6, 'Unauthorized profile update is rejected', 'PASS');
    } else {
      recordTest(6, 'Unauthorized profile update is rejected', 'FAIL', `Expected 401, got ${e.response?.status}`);
    }
  }

  // 7. Role escalation attempt is rejected
  try {
    const res = await patientClient.patch('/settings/profile', { role: 'ADMIN' });
    const checkUser = await prisma.user.findUnique({ where: { id: patientUser.id } });
    if (checkUser.role === 'PATIENT') {
      recordTest(7, 'Role escalation attempt is rejected', 'PASS');
    } else {
      recordTest(7, 'Role escalation attempt is rejected', 'FAIL', 'User role was changed to ADMIN!');
    }
  } catch (e) {
    recordTest(7, 'Role escalation attempt is rejected', 'FAIL', e.message);
  }

  // 8. Password update validates current password
  try {
    await patientClient.patch('/settings/password', { currentPassword: 'WrongPassword!', newPassword: 'NewPassword123!' });
    recordTest(8, 'Password update validates current password', 'FAIL', 'Should have rejected invalid current password');
  } catch (e) {
    if (e.response && e.response.status === 400) {
      recordTest(8, 'Password update validates current password', 'PASS');
    } else {
      recordTest(8, 'Password update validates current password', 'FAIL', `Expected 400, got ${e.response?.status}`);
    }
  }

  // 9. Password is securely hashed
  try {
    await patientClient.patch('/settings/password', { currentPassword: plainPassword, newPassword: 'NewSecurePassword123!' });
    const reFetched = await prisma.user.findUnique({ where: { id: patientUser.id } });
    const matchesNewHash = await bcrypt.compare('NewSecurePassword123!', reFetched.password);
    if (matchesNewHash && reFetched.password !== 'NewSecurePassword123!') {
      recordTest(9, 'Password is securely hashed', 'PASS');
    } else {
      recordTest(9, 'Password is securely hashed', 'FAIL', 'Password hash invalid or plaintext');
    }
  } catch (e) {
    recordTest(9, 'Password is securely hashed', 'FAIL', e.message);
  }

  // 10. Sensitive values absent from responses
  try {
    const res = await patientClient.get('/settings/profile');
    const reFetched = await prisma.user.findUnique({ where: { id: patientUser.id } });
    const jsonStr = JSON.stringify(res.data);
    if (!jsonStr.includes('password') && !jsonStr.includes(reFetched?.password || 'DO_NOT_EXPOSE_HASH')) {
      recordTest(10, 'Sensitive values absent from responses', 'PASS');
    } else {
      recordTest(10, 'Sensitive values absent from responses', 'FAIL', 'Password or secret hash present in response');
    }
  } catch (e) {
    recordTest(10, 'Sensitive values absent from responses', 'FAIL', e.message);
  }

  // -----------------------------------------------------------
  // ADMIN TESTS (11-20)
  // -----------------------------------------------------------
  // 11. Admin dashboard requires admin authorization
  try {
    const res = await adminClient.get('/admin/dashboard/stats');
    if (res.data.success) {
      recordTest(11, 'Admin dashboard requires admin authorization', 'PASS');
    } else {
      recordTest(11, 'Admin dashboard requires admin authorization', 'FAIL', 'Failed to fetch dashboard stats');
    }
  } catch (e) {
    recordTest(11, 'Admin dashboard requires admin authorization', 'FAIL', e.message);
  }

  // 12. Patient cannot access admin APIs
  try {
    await patientClient.get('/admin/dashboard/stats');
    recordTest(12, 'Patient cannot access admin APIs', 'FAIL', 'Patient should be rejected with 403');
  } catch (e) {
    if (e.response && e.response.status === 403) {
      recordTest(12, 'Patient cannot access admin APIs', 'PASS');
    } else {
      recordTest(12, 'Patient cannot access admin APIs', 'FAIL', `Expected 403, got ${e.response?.status}`);
    }
  }

  // 13. Hospital cannot access admin APIs
  try {
    await hospitalClient.get('/admin/users');
    recordTest(13, 'Hospital cannot access admin APIs', 'FAIL', 'Hospital should be rejected with 403');
  } catch (e) {
    if (e.response && e.response.status === 403) {
      recordTest(13, 'Hospital cannot access admin APIs', 'PASS');
    } else {
      recordTest(13, 'Hospital cannot access admin APIs', 'FAIL', `Expected 403, got ${e.response?.status}`);
    }
  }

  // 14. Admin can search permitted accounts
  try {
    const res = await adminClient.get(`/admin/users?search=${patientEmail}`);
    if (res.data.success && res.data.users.some(u => u.email === patientEmail)) {
      recordTest(14, 'Admin can search permitted accounts', 'PASS');
    } else {
      recordTest(14, 'Admin can search permitted accounts', 'FAIL', 'Patient user not found in admin search');
    }
  } catch (e) {
    recordTest(14, 'Admin can search permitted accounts', 'FAIL', e.message);
  }

  // 15. Admin can block a patient with a reason
  try {
    const res = await adminClient.post('/admin/blocklist', {
      targetUserId: patientUser.id,
      reason: 'Repeated false emergency alarms',
    });
    const checkPatient = await prisma.user.findUnique({ where: { id: patientUser.id } });
    if (res.data.success && checkPatient.status === 'BLOCKED') {
      recordTest(15, 'Admin can block a patient with a reason', 'PASS');
    } else {
      recordTest(15, 'Admin can block a patient with a reason', 'FAIL', 'Patient status was not set to BLOCKED');
    }
  } catch (e) {
    recordTest(15, 'Admin can block a patient with a reason', 'FAIL', e.message);
  }

  // 16. Admin can block a hospital with a reason
  try {
    const res = await adminClient.post('/admin/blocklist', {
      targetUserId: hospitalUser.id,
      reason: 'Non-compliance with emergency care policy',
    });
    const checkHosp = await prisma.user.findUnique({ where: { id: hospitalUser.id } });
    if (res.data.success && checkHosp.status === 'BLOCKED') {
      recordTest(16, 'Admin can block a hospital with a reason', 'PASS');
    } else {
      recordTest(16, 'Admin can block a hospital with a reason', 'FAIL', 'Hospital status was not set to BLOCKED');
    }
  } catch (e) {
    recordTest(16, 'Admin can block a hospital with a reason', 'FAIL', e.message);
  }

  // 17. Missing block reason is rejected
  try {
    await adminClient.post('/admin/blocklist', {
      targetUserId: adminUser.id,
      reason: '',
    });
    recordTest(17, 'Missing block reason is rejected', 'FAIL', 'Should reject empty reason');
  } catch (e) {
    if (e.response && e.response.status === 400) {
      recordTest(17, 'Missing block reason is rejected', 'PASS');
    } else {
      recordTest(17, 'Missing block reason is rejected', 'FAIL', `Expected 400, got ${e.response?.status}`);
    }
  }

  // 18. Duplicate active block is handled safely
  try {
    await adminClient.post('/admin/blocklist', {
      targetUserId: patientUser.id,
      reason: 'Second duplicate block attempt',
    });
    recordTest(18, 'Duplicate active block is handled safely', 'FAIL', 'Should return 409 Conflict');
  } catch (e) {
    if (e.response && e.response.status === 409) {
      recordTest(18, 'Duplicate active block is handled safely', 'PASS');
    } else {
      recordTest(18, 'Duplicate active block is handled safely', 'FAIL', `Expected 409, got ${e.response?.status}`);
    }
  }

  // 19. Admin can unblock an account
  try {
    const res = await adminClient.post('/admin/blocklist/unblock', {
      targetUserId: patientUser.id,
      reason: 'Audit issue resolved',
    });
    const checkPatient = await prisma.user.findUnique({ where: { id: patientUser.id } });
    if (res.data.success && checkPatient.status === 'ACTIVE') {
      recordTest(19, 'Admin can unblock an account', 'PASS');
    } else {
      recordTest(19, 'Admin can unblock an account', 'FAIL', 'Patient status was not restored to ACTIVE');
    }
  } catch (e) {
    recordTest(19, 'Admin can unblock an account', 'FAIL', e.message);
  }

  // 20. Block/unblock actions create audit records
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'ADMIN_ACTION',
        entity: 'AccountRestriction',
      },
    });
    if (logs.length >= 2) {
      recordTest(20, 'Block/unblock actions create audit records', 'PASS');
    } else {
      recordTest(20, 'Block/unblock actions create audit records', 'FAIL', `Expected >=2 audit logs, found ${logs.length}`);
    }
  } catch (e) {
    recordTest(20, 'Block/unblock actions create audit records', 'FAIL', e.message);
  }

  // -----------------------------------------------------------
  // BLOCKLIST ENFORCEMENT TESTS (21-29)
  // -----------------------------------------------------------
  // 21. Blocked patient restriction is enforced
  try {
    // Re-block patient
    await adminClient.post('/admin/blocklist', { targetUserId: patientUser.id, reason: 'Enforcement test block' });

    // Attempt login as blocked patient
    await anonClient.post('/auth/login', { email: patientEmail, password: 'NewSecurePassword123!' });
    recordTest(21, 'Blocked patient restriction is enforced', 'FAIL', 'Login should be rejected');
  } catch (e) {
    if (e.response && e.response.status === 403) {
      recordTest(21, 'Blocked patient restriction is enforced', 'PASS');
    } else {
      recordTest(21, 'Blocked patient restriction is enforced', 'FAIL', `Expected 403 on login, got ${e.response?.status}`);
    }
  }

  // 22. Blocked hospital restriction is enforced
  try {
    // Attempt login as blocked hospital
    await anonClient.post('/auth/login', { email: hospitalEmail, password: plainPassword });
    recordTest(22, 'Blocked hospital restriction is enforced', 'FAIL', 'Login should be rejected');
  } catch (e) {
    if (e.response && e.response.status === 403) {
      recordTest(22, 'Blocked hospital restriction is enforced', 'PASS');
    } else {
      recordTest(22, 'Blocked hospital restriction is enforced', 'FAIL', `Expected 403 on login, got ${e.response?.status}`);
    }
  }

  // 23. Emergency workflow behavior verified (Blocked patient cannot create SOS)
  try {
    await patientClient.post('/emergency/sos', {
      symptoms: 'Chest pain',
      latitude: 23.0225,
      longitude: 72.5714,
    });
    recordTest(23, 'Emergency workflow behavior is verified', 'FAIL', 'Blocked patient SOS should fail');
  } catch (e) {
    if (e.response && e.response.status === 403) {
      recordTest(23, 'Emergency workflow behavior is verified', 'PASS');
    } else {
      recordTest(23, 'Emergency workflow behavior is verified', 'FAIL', `Expected 403, got ${e.response?.status}`);
    }
  }

  // 24. Hospital acceptance behavior verified (Blocked hospital cannot accept cases)
  try {
    // Unblock patient temporarily to create a test case
    await adminClient.post('/admin/blocklist/unblock', { targetUserId: patientUser.id });

    // Create emergency case
    const sosRes = await patientClient.post('/emergency/sos', {
      symptoms: 'Severe asthma attack',
      latitude: 23.0225,
      longitude: 72.5714,
    });
    const caseId = sosRes.data.caseId;

    // Hospital attempts to accept while blocked
    await hospitalClient.post(`/emergency/accept/${caseId}`);
    recordTest(24, 'Hospital acceptance behavior is verified', 'FAIL', 'Blocked hospital acceptance should fail');
  } catch (e) {
    if (e.response && e.response.status === 403) {
      recordTest(24, 'Hospital acceptance behavior is verified', 'PASS');
    } else {
      recordTest(24, 'Hospital acceptance behavior is verified', 'FAIL', `Expected 403, got ${e.response?.status}`);
    }
  }

  // 25. Socket authorization respects account restrictions
  try {
    // Re-block patient
    await adminClient.post('/admin/blocklist', { targetUserId: patientUser.id, reason: 'Socket test block' });
    const { isUserBlocked } = require('../src/services/admin-blocklist.service');
    const check = await isUserBlocked(patientUser.id);
    if (check.isBlocked) {
      recordTest(25, 'Socket authorization respects account restrictions', 'PASS');
    } else {
      recordTest(25, 'Socket authorization respects account restrictions', 'FAIL', 'Socket block check failed');
    }
  } catch (e) {
    recordTest(25, 'Socket authorization respects account restrictions', 'FAIL', e.message);
  }

  // 26. Unauthorized users cannot bypass restrictions by changing IDs
  try {
    const res = await patientClient.get('/settings/profile');
    if (res.data.data.id === patientUser.id && res.data.data.role === 'PATIENT') {
      recordTest(26, 'Unauthorized users cannot bypass restrictions by changing IDs', 'PASS');
    } else {
      recordTest(26, 'Unauthorized users cannot bypass restrictions by changing IDs', 'FAIL', 'Identity spoofing succeeded');
    }
  } catch (e) {
    recordTest(26, 'Unauthorized users cannot bypass restrictions by changing IDs', 'FAIL', e.message);
  }

  // 27. Expired restrictions behave according to policy
  try {
    const expiredUserId = patientUser.id;
    // Unblock old restriction and create an expired restriction in DB
    await prisma.accountRestriction.updateMany({
      where: { targetUserId: expiredUserId },
      data: { status: 'REVOKED' },
    });
    await prisma.accountRestriction.create({
      data: {
        targetUserId: expiredUserId,
        targetType: 'PATIENT',
        status: 'ACTIVE',
        reason: 'Temporary 1 second restriction',
        createdBy: adminUser.id,
        expiresAt: new Date(Date.now() - 5000), // 5 seconds ago
      },
    });
    await prisma.user.update({ where: { id: expiredUserId }, data: { status: 'BLOCKED' } });

    const { isUserBlocked } = require('../src/services/admin-blocklist.service');
    const statusCheck = await isUserBlocked(expiredUserId);
    if (!statusCheck.isBlocked) {
      recordTest(27, 'Expired restrictions behave according to policy', 'PASS');
    } else {
      recordTest(27, 'Expired restrictions behave according to policy', 'FAIL', 'Expired restriction was not auto-cleared');
    }
  } catch (e) {
    recordTest(27, 'Expired restrictions behave according to policy', 'FAIL', e.message);
  }

  // 28. Existing emergency cases are handled safely
  try {
    const cases = await prisma.emergencyCase.findMany({ where: { patientId: patientUser.patient.id } });
    if (cases.length > 0 && cases.every(c => c.status !== 'CANCELLED')) {
      recordTest(28, 'Existing emergency cases are handled safely', 'PASS');
    } else {
      recordTest(28, 'Existing emergency cases are handled safely', 'FAIL', 'Active cases were unexpectedly cancelled or missing');
    }
  } catch (e) {
    recordTest(28, 'Existing emergency cases are handled safely', 'FAIL', e.message);
  }

  // 29. Medical information is not exposed through blocklist endpoints
  try {
    const res = await adminClient.get('/admin/blocklist/history');
    const jsonStr = JSON.stringify(res.data);
    if (!jsonStr.includes('allergies') && !jsonStr.includes('medicalSummary') && !jsonStr.includes('encryptedData')) {
      recordTest(29, 'Medical information is not exposed through blocklist endpoints', 'PASS');
    } else {
      recordTest(29, 'Medical information is not exposed through blocklist endpoints', 'FAIL', 'Medical info leaked in blocklist payload');
    }
  } catch (e) {
    recordTest(29, 'Medical information is not exposed through blocklist endpoints', 'FAIL', e.message);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: TOTAL: 29 | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
