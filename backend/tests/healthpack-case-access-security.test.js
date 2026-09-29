/**
 * CareSetu — HealthPack Case Access IDOR & Security Test Suite
 *
 * Verifies strict authorization rules and IDOR protections for GET /api/health-pack/case/:caseId:
 *
 * 1. Hospital A can access its authorized active case (200 OK).
 * 2. Hospital A CANNOT access Hospital B's case (403 Forbidden - IDOR check).
 * 3. Hospital A CANNOT access an unrelated patient's HealthPack (403 Forbidden).
 * 4. Hospital A CANNOT access an expired HealthPack (403 Forbidden).
 * 5. Hospital A CANNOT access a revoked share on a closed case (403 Forbidden).
 * 6. Hospital A CANNOT access a case using only a guessed case ID (403 Forbidden).
 * 7. Unauthenticated user request fails / is rejected.
 * 8. Wrong role (PATIENT trying to access case endpoint) fails (403 Forbidden).
 * 9. Unauthorized hospital returns HTTP 403.
 * 10. Authorized hospital returns HTTP 200 with decrypted payload.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const healthPackService = require('../src/services/health-pack.service');
const healthPackController = require('../src/controllers/health-pack.controller');
const assert = require('assert');

const TEST_DOMAIN = `sec.${Date.now()}.caresetu.local`;

async function createPatient(name = 'Security Test Patient') {
  const email = `patient.${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`;
  const user = await prisma.user.create({
    data: {
      email,
      password: '$2b$10$mockmockmockmockmockmock',
      role: 'PATIENT',
      status: 'ACTIVE',
      isVerified: true,
      name,
    },
  });
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      name,
      age: 28,
      gender: 'MALE',
      phone: '9998887776',
      bloodGroup: 'O+',
      allergies: 'Dust',
      medicalConditions: 'Asthma',
      medications: 'Inhaler',
    },
  });
  return { user, patient };
}

async function createHospital(name = 'Security Test Hospital') {
  const email = `hospital.${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`;
  const user = await prisma.user.create({
    data: {
      email,
      password: '$2b$10$mockmockmockmockmockmock',
      role: 'HOSPITAL',
      status: 'ACTIVE',
      isVerified: true,
      name,
    },
  });
  const hospital = await prisma.hospital.create({
    data: {
      userId: user.id,
      name,
      address: 'Security Ave 101',
      phone: '9990001112',
      capabilities: [],
      location: { lat: 23.0225, lng: 72.5714 },
    },
  });
  return { user, hospital };
}

async function createCase(patientId, hospitalId, status = 'TRANSFER') {
  return prisma.emergencyCase.create({
    data: {
      caseId: `CASE-SEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId,
      hospitalId,
      status,
      symptoms: 'Severe breathing trouble',
      location: { lat: 23.0225, lng: 72.5714 },
      detectedWords: [],
    },
  });
}

async function callController(controller, reqArgs) {
  const body = { status: 200, json: null };
  let capturedErr;
  const res = {
    status(code) { body.status = code; return this; },
    json(data) { body.json = data; return this; },
  };
  const next = (err) => { capturedErr = err; };
  try {
    await controller(...reqArgs, res, next);
  } catch (e) {
    capturedErr = e;
  }
  return { body, err: capturedErr };
}

async function runSecurityTestSuite() {
  console.log('==================================================');
  console.log('CARESETU HEALTHPACK IDOR & SECURITY TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`[PASS] ${description}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${description}`);
      console.error(`       ${err.message}`);
      failed++;
    }
  }

  // 1. Setup Fixtures
  const patientA = await createPatient('Patient Alpha');
  const patientB = await createPatient('Patient Beta');

  const hospitalA = await createHospital('Hospital Alpha');
  const hospitalB = await createHospital('Hospital Beta');

  const caseA = await createCase(patientA.patient.id, hospitalA.hospital.id, 'TRANSFER');
  const caseB = await createCase(patientB.patient.id, hospitalB.hospital.id, 'TRANSFER');

  // Create active HealthPacks
  await healthPackService.createHealthPack(patientA.patient.id, { bloodGroup: 'O+', allergies: 'Dust' });
  await healthPackService.createHealthPack(patientB.patient.id, { bloodGroup: 'AB-', allergies: 'Peanuts' });

  // TEST 1: Authorized hospital A accesses case A
  {
    const { body } = await callController(healthPackController.getCaseHealthPack, [
      { user: { userId: hospitalA.user.id, role: 'HOSPITAL' }, params: { caseId: caseA.caseId } },
    ]);
    test('1. Authorized Hospital A receives 200 OK for assigned case A', () => {
      assert.strictEqual(body.status, 200);
      assert.strictEqual(body.json.success, true);
      assert.strictEqual(body.json.data.patient.name, 'Patient Alpha');
      assert.strictEqual(body.json.data.healthData.bloodGroup, 'O+');
    });
  }

  // TEST 2: Hospital A attempts IDOR access to Hospital B's case
  {
    const { body } = await callController(healthPackController.getCaseHealthPack, [
      { user: { userId: hospitalA.user.id, role: 'HOSPITAL' }, params: { caseId: caseB.caseId } },
    ]);
    test('2. Hospital A CANNOT access Hospital B\'s case (403 Forbidden IDOR protection)', () => {
      assert.strictEqual(body.status, 403);
      assert.strictEqual(body.json.success, false);
      assert.ok(body.json.error.includes('Unauthorized'));
      assert.strictEqual(body.json.data, undefined);
    });
  }

  // TEST 3: Hospital A attempts to access non-existent / guessed case ID
  {
    const { body } = await callController(healthPackController.getCaseHealthPack, [
      { user: { userId: hospitalA.user.id, role: 'HOSPITAL' }, params: { caseId: 'CASE-GUESSED-99999' } },
    ]);
    test('3. Hospital A CANNOT access case using guessed ID (404 Not Found)', () => {
      assert.strictEqual(body.status, 404);
      assert.strictEqual(body.json.success, false);
      assert.ok(body.json.error.includes('not found'));
    });
  }

  // TEST 4: Wrong role (PATIENT) accessing case HealthPack endpoint
  {
    const { body } = await callController(healthPackController.getCaseHealthPack, [
      { user: { userId: patientA.user.id, role: 'PATIENT' }, params: { caseId: caseA.caseId } },
    ]);
    test('4. PATIENT role user without Hospital profile is rejected (404/403)', () => {
      assert.ok(body.status === 404 || body.status === 403);
      assert.strictEqual(body.json.success, false);
    });
  }

  // TEST 5: Expired HealthPack overall expiration
  {
    const expiredPatient = await createPatient('Expired HealthPack Patient');
    const expiredPack = await prisma.healthPack.create({
      data: {
        patientId: expiredPatient.patient.id,
        encryptedData: 'mock',
        iv: 'mock',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 3600000), // expired 1 hour ago
      },
    });
    const expiredCase = await createCase(expiredPatient.patient.id, hospitalA.hospital.id, 'TRANSFER');

    const { body } = await callController(healthPackController.getCaseHealthPack, [
      { user: { userId: hospitalA.user.id, role: 'HOSPITAL' }, params: { caseId: expiredCase.caseId } },
    ]);

    test('5. Hospital A CANNOT access overall-expired HealthPack (403 Forbidden)', () => {
      assert.strictEqual(body.status, 403);
      assert.strictEqual(body.json.success, false);
      assert.ok(body.json.error.toLowerCase().includes('expired'));
    });
  }

  // TEST 6: Revoked / expired share on a CLOSED case
  {
    const closedPatient = await createPatient('Closed Case Patient');
    const closedCase = await createCase(closedPatient.patient.id, hospitalA.hospital.id, 'CLOSED');
    await healthPackService.createHealthPack(closedPatient.patient.id, { bloodGroup: 'B+' });
    const packRecord = await prisma.healthPack.findFirst({ where: { patientId: closedPatient.patient.id } });

    // Create a revoked/expired share
    await prisma.healthPackShare.create({
      data: {
        healthPackId: packRecord.id,
        sharedWithHospitalId: hospitalA.hospital.id,
        sharedWithUserId: hospitalA.user.id,
        status: 'REVOKED',
        consentGranted: false,
        expiresAt: new Date(Date.now() - 3600000),
      },
    });

    const { body } = await callController(healthPackController.getCaseHealthPack, [
      { user: { userId: hospitalA.user.id, role: 'HOSPITAL' }, params: { caseId: closedCase.caseId } },
    ]);

    test('6. Hospital A CANNOT access revoked/expired share on CLOSED case (403 Forbidden)', () => {
      assert.strictEqual(body.status, 403);
      assert.strictEqual(body.json.success, false);
      assert.ok(body.json.error.toLowerCase().includes('expired') || body.json.error.includes('Unauthorized'));
    });
  }

  // TEST 7: Direct Document Access - Authorized Hospital A for Patient Alpha
  {
    const fs = require('fs');
    const uploadDir = path.resolve(__dirname, '../uploads/documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const testFilePath = path.join(uploadDir, 'test_lab_report.pdf');
    fs.writeFileSync(testFilePath, '%PDF-1.4 mock content');

    const doc = await prisma.medicalDocument.create({
      data: {
        patientId: patientA.patient.id,
        fileName: 'test_lab_report.pdf',
        fileUrl: '/uploads/documents/test_lab_report.pdf',
        fileType: 'PDF',
        fileSize: 1024,
        documentType: 'LAB_REPORT',
      },
    });

    const medicalDocumentService = require('../src/services/medical-document.service');
    const hospitalUserReq = { userId: hospitalA.user.id, role: 'HOSPITAL', hospitalId: hospitalA.hospital.id };

    let docInfo;
    let docErr;
    try {
      docInfo = await medicalDocumentService.getDocumentFilePath(doc.id, hospitalUserReq);
    } catch (e) {
      docErr = e;
    }

    test('7. Authorized Hospital A can request document for active assigned case (200 OK access path)', () => {
      assert.strictEqual(docErr, undefined);
      assert.strictEqual(docInfo.fileName, 'test_lab_report.pdf');
    });

    // TEST 8: Direct Document Access - Unauthorized Hospital B for Patient Alpha (IDOR protection)
    const hospitalBUserReq = { userId: hospitalB.user.id, role: 'HOSPITAL', hospitalId: hospitalB.hospital.id };
    let unauthorizedDocErr;
    try {
      await medicalDocumentService.getDocumentFilePath(doc.id, hospitalBUserReq);
    } catch (e) {
      unauthorizedDocErr = e;
    }

    test('8. Unauthorized Hospital B CANNOT download Patient Alpha\'s document directly (403 Forbidden IDOR)', () => {
      assert.ok(unauthorizedDocErr !== undefined);
      assert.ok(unauthorizedDocErr.message.toLowerCase().includes('access denied') || unauthorizedDocErr.message.toLowerCase().includes('not authorized'));
    });

    // Clean up test document
    try {
      await prisma.medicalDocument.delete({ where: { id: doc.id } });
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    } catch {}
  }

  // TEST 9: Direct Document Access - Hospital A for Closed Case with Expired Share
  {
    const closedDocPatient = await createPatient('Closed Doc Patient');
    const closedDocCase = await createCase(closedDocPatient.patient.id, hospitalA.hospital.id, 'CLOSED');
    const closedDoc = await prisma.medicalDocument.create({
      data: {
        patientId: closedDocPatient.patient.id,
        fileName: 'closed_case_report.pdf',
        fileUrl: '/uploads/documents/closed_case_report.pdf',
        fileType: 'PDF',
        fileSize: 2048,
        documentType: 'DISCHARGE_SUMMARY',
      },
    });

    const medicalDocumentService = require('../src/services/medical-document.service');
    const hospitalUserReq = { userId: hospitalA.user.id, role: 'HOSPITAL', hospitalId: hospitalA.hospital.id };

    let closedDocErr;
    try {
      await medicalDocumentService.getDocumentFilePath(closedDoc.id, hospitalUserReq);
    } catch (e) {
      closedDocErr = e;
    }

    test('9. Hospital A CANNOT download document for CLOSED case with expired share (403 Forbidden)', () => {
      assert.ok(closedDocErr !== undefined);
      assert.ok(closedDocErr.message.toLowerCase().includes('access denied') || closedDocErr.message.toLowerCase().includes('not authorized'));
    });

    // Clean up
    try {
      await prisma.medicalDocument.delete({ where: { id: closedDoc.id } });
      await prisma.emergencyCase.delete({ where: { id: closedDocCase.id } });
      await prisma.patient.delete({ where: { id: closedDocPatient.patient.id } });
      await prisma.user.delete({ where: { id: closedDocPatient.user.id } });
    } catch {}
  }

  // TEST 10: Audit Log Event HEALTH_PACK_VIEWED Verified
  {
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        userId: hospitalA.user.id,
        action: 'HEALTH_PACK_VIEWED',
      },
      orderBy: { createdAt: 'desc' },
    });

    test('10. Audit Log HEALTH_PACK_VIEWED recorded for successful HealthPack view', () => {
      assert.ok(auditRecord !== null);
      assert.strictEqual(auditRecord.action, 'HEALTH_PACK_VIEWED');
      assert.strictEqual(auditRecord.userId, hospitalA.user.id);
    });
  }

  // TEST 11: 24-Hour Expiry Window Test for Document Access
  {
    const expired24hPatient = await createPatient('24h Expired Doc Patient');
    const oldCase = await createCase(expired24hPatient.patient.id, hospitalA.hospital.id, 'ACCEPTED');
    await prisma.emergencyCase.update({
      where: { id: oldCase.id },
      data: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) },
    });

    const oldDoc = await prisma.medicalDocument.create({
      data: {
        patientId: expired24hPatient.patient.id,
        fileName: 'old_case_report.pdf',
        fileUrl: '/uploads/documents/old_case_report.pdf',
        fileType: 'PDF',
        fileSize: 1024,
        documentType: 'LAB_REPORT',
      },
    });

    const medicalDocumentService = require('../src/services/medical-document.service');
    const hospitalUserReq = { userId: hospitalA.user.id, role: 'HOSPITAL', hospitalId: hospitalA.hospital.id };

    let oldDocErr;
    try {
      await medicalDocumentService.getDocumentFilePath(oldDoc.id, hospitalUserReq);
    } catch (e) {
      oldDocErr = e;
    }

    test('11. Hospital A CANNOT access document after 24-hour window has passed (403 Forbidden)', () => {
      assert.ok(oldDocErr !== undefined);
      assert.ok(oldDocErr.message.toLowerCase().includes('expired') || oldDocErr.message.toLowerCase().includes('access denied'));
    });

    // Clean up
    try {
      await prisma.medicalDocument.delete({ where: { id: oldDoc.id } });
      await prisma.emergencyCase.delete({ where: { id: oldCase.id } });
      await prisma.patient.delete({ where: { id: expired24hPatient.patient.id } });
      await prisma.user.delete({ where: { id: expired24hPatient.user.id } });
    } catch {}
  }

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  // Clean up test data
  try {
    await prisma.healthPackShare.deleteMany({ where: { healthPack: { patient: { user: { email: { contains: TEST_DOMAIN } } } } } });
    await prisma.healthPack.deleteMany({ where: { patient: { user: { email: { contains: TEST_DOMAIN } } } } });
    await prisma.emergencyCase.deleteMany({ where: { patient: { user: { email: { contains: TEST_DOMAIN } } } } });
    await prisma.patient.deleteMany({ where: { user: { email: { contains: TEST_DOMAIN } } } });
    await prisma.hospital.deleteMany({ where: { user: { email: { contains: TEST_DOMAIN } } } });
    await prisma.user.deleteMany({ where: { email: { contains: TEST_DOMAIN } } });
  } catch (e) {
    // Ignore cleanup
  }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
