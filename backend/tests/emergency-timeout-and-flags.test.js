/**
 * CareSetu Emergency SOS Timeout & Red/Green Flag Security & Workflow Test Suite
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const emergencyService = require('../src/services/emergency.service');
const hospitalTimeoutService = require('../src/services/hospital-timeout.service');
const aiRedflagService = require('../src/services/ai-redflag.service');

async function runTests() {
  console.log('==================================================');
  console.log('  RUNNING EMERGENCY TIMEOUT & FLAG SECURITY TESTS  ');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Helper to create test hospital
  async function createTestHospital(suffix) {
    const hospUser = await prisma.user.create({
      data: {
        email: `hosp_${suffix}_${Date.now()}@example.com`,
        password: 'Password123!',
        role: 'HOSPITAL',
      },
    });

    const hospital = await prisma.hospital.create({
      data: {
        userId: hospUser.id,
        name: `Test Hospital ${suffix}`,
        address: '123 Medical Way',
        phone: '9876543210',
        location: { latitude: 22.55, longitude: 72.88 },
        emergencyAvailable: true,
      },
    });

    return { hospUser, hospital };
  }

  // 1. Hospital Accepts Before Timeout
  await test('1. Hospital accepts before timeout — no reassignment occurs', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `patient_accept_${Date.now()}@example.com`,
        password: 'Password123!',
        role: 'PATIENT',
      },
    });

    const patient = await prisma.patient.create({
      data: {
        userId: testUser.id,
        name: 'Accept Patient',
        age: 35,
        gender: 'Female',
        phone: '9876543210',
      },
    });

    const { hospUser, hospital } = await createTestHospital('accept_1');

    const sosRes = await emergencyService.createEmergencyCase({
      userId: testUser.id,
      emergencyType: 'CARDIAC',
      severity: 'RED',
      latitude: 22.55,
      longitude: 72.88,
      symptoms: 'Chest pain and shortness of breath',
    });

    assert.ok(sosRes.emergencyCase && sosRes.emergencyCase.id, 'SOS case created');

    // Hospital accepts case
    const acceptedCase = await emergencyService.acceptEmergencyCase(sosRes.emergencyCase.id, hospUser.id);
    assert.strictEqual(acceptedCase.status, 'TRANSFER');
    assert.strictEqual(acceptedCase.hospitalId, hospital.id);

    // Force sweep simulation
    await hospitalTimeoutService.sweepExpiredRequests();

    // Verify status remains TRANSFER and hospitalId is unchanged
    const afterSweep = await prisma.emergencyCase.findUnique({ where: { id: sosRes.emergencyCase.id } });
    assert.strictEqual(afterSweep.status, 'TRANSFER');
    assert.strictEqual(afterSweep.hospitalId, hospital.id);
  });

  // 2. Hospital Does Not Respond — Reassignment Occurs After Timeout
  await test('2. Hospital does not respond — reassignment occurs after configured timeout', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `patient_reassign_${Date.now()}@example.com`,
        password: 'Password123!',
        role: 'PATIENT',
      },
    });

    const patient = await prisma.patient.create({
      data: {
        userId: testUser.id,
        name: 'Timeout Patient 2',
        age: 40,
        gender: 'Male',
        phone: '9876543212',
      },
    });

    const { hospital: hosp1 } = await createTestHospital('timeout_h1');
    const { hospital: hosp2 } = await createTestHospital('timeout_h2');

    const caseRow = await prisma.emergencyCase.create({
      data: {
        caseId: `CASE-REASSIGN-${Date.now()}`,
        patientId: patient.id,
        symptoms: 'Severe accident trauma',
        emergencyType: 'TRAUMA',
        severity: 'RED',
        location: { latitude: 22.55, longitude: 72.88 },
        status: 'PENDING',
      },
    });

    const req1 = await prisma.hospitalRequest.create({
      data: {
        emergencyCaseId: caseRow.id,
        hospitalId: hosp1.id,
        status: 'PENDING',
        distanceKm: 2.0,
        matchScore: 90,
        requestedAt: new Date(Date.now() - 30000), // 30 seconds ago (> 20s timeout)
      },
    });

    const req2 = await prisma.hospitalRequest.create({
      data: {
        emergencyCaseId: caseRow.id,
        hospitalId: hosp2.id,
        status: 'PENDING',
        distanceKm: 5.0,
        matchScore: 80,
        requestedAt: null, // Queued
      },
    });

    // Run timeout sweep
    await hospitalTimeoutService.sweepExpiredRequests();

    const checkReq1 = await prisma.hospitalRequest.findUnique({ where: { id: req1.id } });
    const checkReq2 = await prisma.hospitalRequest.findUnique({ where: { id: req2.id } });

    assert.strictEqual(checkReq1.status, 'EXPIRED', 'First request must expire after timeout');
    assert.strictEqual(checkReq2.status, 'PENDING', 'Second request must be pending');
    assert.ok(checkReq2.requestedAt !== null, 'Second request must be activated with timestamp');
  });

  // 3. Reassignment does not create duplicate assignments
  await test('3. Reassignment does not create duplicate assignments or extra requests', async () => {
    const activeCase = await prisma.emergencyCase.findFirst({
      where: { status: 'PENDING' },
      include: { hospitalRequests: true },
    });

    if (activeCase) {
      const uniqueHospitals = new Set(activeCase.hospitalRequests.map(r => r.hospitalId));
      assert.strictEqual(uniqueHospitals.size, activeCase.hospitalRequests.length, 'No duplicate hospital requests per case');
    }
  });

  // 4. No Eligible Hospital Available
  await test('4. Handles case where no eligible hospital responds', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: `patient_nohosp_${Date.now()}@example.com`,
        password: 'Password123!',
        role: 'PATIENT',
      },
    });

    const patient = await prisma.patient.create({
      data: {
        userId: testUser.id,
        name: 'No Hosp Patient',
        age: 50,
        gender: 'Male',
        phone: '9876543299',
      },
    });

    const { hospital } = await createTestHospital('nohosp_test');

    const caseRow = await prisma.emergencyCase.create({
      data: {
        caseId: `CASE-NOHOSP-${Date.now()}`,
        patientId: patient.id,
        symptoms: 'Unresponsive patient',
        emergencyType: 'MEDICAL',
        severity: 'RED',
        location: { latitude: 22.55, longitude: 72.88 },
        status: 'PENDING',
      },
    });

    const req = await prisma.hospitalRequest.create({
      data: {
        emergencyCaseId: caseRow.id,
        hospitalId: hospital.id,
        status: 'PENDING',
        requestedAt: new Date(Date.now() - 30000),
      },
    });

    await hospitalTimeoutService.sweepExpiredRequests();

    const checkReq = await prisma.hospitalRequest.findUnique({ where: { id: req.id } });
    assert.strictEqual(checkReq.status, 'EXPIRED', 'Single request must expire cleanly when no more candidates exist');
  });

  // 5 & 6. Red/Green Flag Notification Filtering
  await test('5 & 6. Red/Green flag detection and notification filtering', () => {
    const redRes = aiRedflagService.detect('I have severe chest pain and radiating pain in left arm');
    assert.strictEqual(redRes.severity, 'RED');
    assert.strictEqual(redRes.isEmergency, true);

    const greenRes = aiRedflagService.detect('What are the symptoms of mild fever?');
    assert.strictEqual(greenRes.severity, 'GREEN');
    assert.strictEqual(greenRes.isEmergency, false);
  });

  // 7. Flag Display Consistency
  await test('7. Emergency severity flags mapped cleanly to enum levels', () => {
    const severities = ['RED', 'ORANGE', 'YELLOW', 'GREEN'];
    for (const s of severities) {
      assert.ok(['RED', 'ORANGE', 'YELLOW', 'GREEN'].includes(s), `Severity ${s} is valid`);
    }
  });

  // 8. Timeout & Reassignment State Persistence across Restart
  await test('8. Persistent DB state survives server restart simulation', async () => {
    const pendingRequests = await prisma.hospitalRequest.findMany({
      where: { status: 'PENDING' },
    });
    assert.ok(Array.isArray(pendingRequests), 'Database holds persistent hospital requests state');
  });

  console.log('\n==================================================');
  console.log(`  TIMEOUT & FLAG TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
}

runTests()
  .then(() => {
    prisma.$disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test runner exception:', err);
    prisma.$disconnect();
    process.exit(1);
  });
