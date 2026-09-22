/**
 * CareSetu — Patient Profile & Emergency SOS Fix Test Suite
 *
 * Verifies:
 * 1. Patient with valid profile -> SOS succeeds (201).
 * 2. Patient user with missing profile -> auto-creates profile & SOS succeeds (201).
 * 3. Doctor attempting Patient SOS -> forbidden (403).
 * 4. Hospital attempting Patient SOS -> forbidden (403).
 * 5. Duplicate SOS request (idempotency key) -> returns existing case (idempotent).
 * 6. Invalid authentication -> unauthorized (401).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const emergencyController = require('../src/controllers/emergency.controller');
const emergencyService = require('../src/services/emergency.service');
const { seedTestPatient, TEST_EMAIL } = require('../scripts/seed-test-patient');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function runPatientProfileSOSTests() {
  console.log('==================================================');
  console.log('CARESETU PATIENT PROFILE & EMERGENCY SOS TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details}`);
      failed++;
    }
  }

  try {
    // ------------------------------------------------------------------
    // SETUP: Ensure Test Patient exists with profile
    // ------------------------------------------------------------------
    await seedTestPatient();
    const patientUser = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      include: { patient: true },
    });

    assert(patientUser !== null, 'Test Patient user exists in database');
    assert(patientUser.patient !== null, 'Test Patient profile is attached');

    // ------------------------------------------------------------------
    // TEST 1: Patient with valid profile -> SOS succeeds
    // ------------------------------------------------------------------
    let test1Status = null;
    let test1Body = null;
    const idempotencyKey1 = `test-sos-${Date.now()}-1`;

    const req1 = {
      user: { userId: patientUser.id, role: 'PATIENT' },
      body: {
        symptoms: 'Chest pain and shortness of breath',
        latitude: 23.0225,
        longitude: 72.5714,
        emergencyType: 'CARDIAC',
        severity: 'CRITICAL',
        idempotencyKey: idempotencyKey1,
      },
    };
    const res1 = {
      status(code) { test1Status = code; return this; },
      json(data) { test1Body = data; return this; },
    };

    await emergencyController.createSOS(req1, res1, (err) => { if (err) throw err; });

    assert(test1Status === 201, 'Test 1: HTTP 201 Created for Patient SOS with valid profile');
    assert(test1Body?.success === true, 'Test 1: Response contains success: true');
    assert(typeof test1Body?.caseId === 'string', 'Test 1: Returned caseId string');

    // Verify DB record created
    const createdCase1 = await prisma.emergencyCase.findUnique({
      where: { id: test1Body.caseId },
      include: { patient: true },
    });
    assert(createdCase1 !== null, 'Test 1: EmergencyCase persisted in database');
    assert(createdCase1.patient.userId === patientUser.id, 'Test 1: EmergencyCase linked to correct authenticated Patient');
    assert(createdCase1.location !== null, 'Test 1: EmergencyCase location stored in database');

    // ------------------------------------------------------------------
    // TEST 2: Patient without profile -> auto-creates profile & SOS succeeds
    // ------------------------------------------------------------------
    const noProfileEmail = `test.noprofile.${Date.now()}@caresetu.local`;
    const noProfileUser = await prisma.user.create({
      data: {
        email: noProfileEmail,
        password: '$2b$10$abcdefghijklmnopqrstuuu', // mock hash
        role: 'PATIENT',
        status: 'ACTIVE',
        isVerified: true,
        name: 'No Profile Patient',
      },
    });

    let test2Status = null;
    let test2Body = null;
    const req2 = {
      user: { userId: noProfileUser.id, role: 'PATIENT' },
      body: {
        symptoms: 'Severe dizziness and high fever',
        latitude: 23.0300,
        longitude: 72.5800,
        emergencyType: 'MEDICAL',
        severity: 'URGENT',
      },
    };
    const res2 = {
      status(code) { test2Status = code; return this; },
      json(data) { test2Body = data; return this; },
    };

    await emergencyController.createSOS(req2, res2, (err) => { if (err) throw err; });

    assert(test2Status === 201, 'Test 2: HTTP 201 Created for Patient user without initial profile (auto-created)');
    const autoCreatedPatient = await prisma.patient.findUnique({ where: { userId: noProfileUser.id } });
    assert(autoCreatedPatient !== null, 'Test 2: Patient profile auto-created idempotently');

    // Clean up temporary test user & patient
    await prisma.emergencyCase.deleteMany({ where: { patientId: autoCreatedPatient.id } });
    await prisma.patient.delete({ where: { id: autoCreatedPatient.id } });
    await prisma.user.delete({ where: { id: noProfileUser.id } });

    // ------------------------------------------------------------------
    // TEST 3: Doctor attempting Patient SOS -> forbidden (403)
    // ------------------------------------------------------------------
    const doctorUser = await prisma.user.findFirst({ where: { role: 'DOCTOR' } }) ||
      await prisma.user.create({
        data: {
          email: `doc.test.${Date.now()}@caresetu.local`,
          password: 'mock',
          role: 'DOCTOR',
          status: 'ACTIVE',
          name: 'Dr. Test',
        },
      });

    let test3Status = null;
    let test3Error = null;
    const req3 = {
      user: { userId: doctorUser.id, role: 'DOCTOR' },
      body: { latitude: 23.0225, longitude: 72.5714 },
    };
    const res3 = {
      status(code) { test3Status = code; return this; },
      json(data) { test3Error = data; return this; },
    };

    await emergencyController.createSOS(req3, res3, (err) => {
      test3Status = err.status || 500;
      test3Error = { error: err.message };
    });

    assert(test3Status === 403, 'Test 3: HTTP 403 Forbidden when DOCTOR attempts Patient SOS');

    // ------------------------------------------------------------------
    // TEST 4: Hospital attempting Patient SOS -> forbidden (403)
    // ------------------------------------------------------------------
    const hospitalUser = await prisma.user.findFirst({ where: { role: 'HOSPITAL' } }) ||
      await prisma.user.create({
        data: {
          email: `hosp.test.${Date.now()}@caresetu.local`,
          password: 'mock',
          role: 'HOSPITAL',
          status: 'ACTIVE',
          name: 'Test Hospital User',
        },
      });

    let test4Status = null;
    let test4Error = null;
    const req4 = {
      user: { userId: hospitalUser.id, role: 'HOSPITAL' },
      body: { latitude: 23.0225, longitude: 72.5714 },
    };
    const res4 = {
      status(code) { test4Status = code; return this; },
      json(data) { test4Error = data; return this; },
    };

    await emergencyController.createSOS(req4, res4, (err) => {
      test4Status = err.status || 500;
      test4Error = { error: err.message };
    });

    assert(test4Status === 403, 'Test 4: HTTP 403 Forbidden when HOSPITAL attempts Patient SOS');

    // ------------------------------------------------------------------
    // TEST 5: Duplicate SOS request -> idempotent behavior
    // ------------------------------------------------------------------
    const duplicateIdempotencyKey = `idempotent-key-${Date.now()}`;
    const req5a = {
      user: { userId: patientUser.id, role: 'PATIENT' },
      body: {
        symptoms: 'Duplicate test symptoms',
        latitude: 23.0225,
        longitude: 72.5714,
        idempotencyKey: duplicateIdempotencyKey,
      },
    };
    let test5aBody = null;
    const res5a = {
      status() { return this; },
      json(data) { test5aBody = data; return this; },
    };

    await emergencyController.createSOS(req5a, res5a, (err) => { if (err) throw err; });

    // Second call with same idempotency key
    const req5b = {
      user: { userId: patientUser.id, role: 'PATIENT' },
      body: {
        symptoms: 'Duplicate test symptoms',
        latitude: 23.0225,
        longitude: 72.5714,
        idempotencyKey: duplicateIdempotencyKey,
      },
    };
    let test5bBody = null;
    const res5b = {
      status() { return this; },
      json(data) { test5bBody = data; return this; },
    };

    await emergencyController.createSOS(req5b, res5b, (err) => { if (err) throw err; });

    assert(test5aBody?.caseId === test5bBody?.caseId, 'Test 5: Duplicate SOS request with identical idempotency key returned existing case ID');

    // ------------------------------------------------------------------
    // TEST 6: Invalid authentication -> 401 Unauthorized
    // ------------------------------------------------------------------
    let test6Status = null;
    let test6Body = null;
    const req6 = {
      user: null, // missing auth user
      body: { latitude: 23.0225, longitude: 72.5714 },
    };
    const res6 = {
      status(code) { test6Status = code; return this; },
      json(data) { test6Body = data; return this; },
    };

    await emergencyController.createSOS(req6, res6, (err) => {
      test6Status = err.status || 500;
      test6Body = { error: err.message };
    });

    assert(test6Status === 401, 'Test 6: HTTP 401 Unauthorized returned when req.user is unauthenticated/null');

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPatientProfileSOSTests();
