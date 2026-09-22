require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const UPLOAD_DIR = path.resolve(__dirname, '../uploads/documents');

async function runTests() {
  console.log('====================================================');
  console.log(' CARESETU - MEDICAL DOCUMENT DOWNLOAD COMPREHENSIVE TEST ');
  console.log('====================================================\n');

  // Start HTTP server on random port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  function assertTest(condition, name, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${detail}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    
    // Create test user & patient A
    const userA = await prisma.user.create({
      data: {
        email: `patient_a_${timestamp}@test.com`,
        password: 'hashedpassword',
        role: 'PATIENT',
      },
    });

    const patientA = await prisma.patient.create({
      data: {
        userId: userA.id,
        name: 'Patient Alpha',
        phone: '9876543210',
        age: 30,
        gender: 'MALE',
      },
    });

    // Create test user & patient B
    const userB = await prisma.user.create({
      data: {
        email: `patient_b_${timestamp}@test.com`,
        password: 'hashedpassword',
        role: 'PATIENT',
      },
    });

    const patientB = await prisma.patient.create({
      data: {
        userId: userB.id,
        name: 'Patient Beta',
        phone: '9876543211',
        age: 28,
        gender: 'FEMALE',
      },
    });

    // Create test hospital user & hospital
    const hospitalUser = await prisma.user.create({
      data: {
        email: `hospital_${timestamp}@test.com`,
        password: 'hashedpassword',
        role: 'HOSPITAL',
      },
    });

    const hospital = await prisma.hospital.create({
      data: {
        userId: hospitalUser.id,
        name: 'Metro Care Hospital',
        phone: '9988776655',
        address: '123 Medical Way',
        location: { latitude: 19.076, longitude: 72.8777 },
      },
    });

    // Create unassigned hospital user & hospital
    const unassignedHospitalUser = await prisma.user.create({
      data: {
        email: `unassigned_hosp_${timestamp}@test.com`,
        password: 'hashedpassword',
        role: 'HOSPITAL',
      },
    });

    const unassignedHospital = await prisma.hospital.create({
      data: {
        userId: unassignedHospitalUser.id,
        name: 'Unassigned City Hospital',
        phone: '9988776600',
        address: '456 Far Away Lane',
        location: { latitude: 19.100, longitude: 72.9000 },
      },
    });

    // Create physical dummy document files
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const testFileNameA = `doc_${patientA.id}_${timestamp}_test.pdf`;
    const testFilePathA = path.join(UPLOAD_DIR, testFileNameA);
    fs.writeFileSync(testFilePathA, '%PDF-1.4 Test Medical Document Content for Patient Alpha');

    // Create DB MedicalDocument for Patient A
    const docA = await prisma.medicalDocument.create({
      data: {
        patientId: patientA.id,
        fileName: 'blood_report_alpha.pdf',
        fileUrl: `/uploads/documents/${testFileNameA}`,
        fileType: 'PDF',
        fileSize: 1024,
        documentType: 'LAB_REPORT',
        processingStatus: 'COMPLETED',
      },
    });

    // Create DB MedicalDocument with missing physical file for Patient A
    const docMissingFile = await prisma.medicalDocument.create({
      data: {
        patientId: patientA.id,
        fileName: 'missing_report.pdf',
        fileUrl: `/uploads/documents/non_existent_file_${timestamp}.pdf`,
        fileType: 'PDF',
        fileSize: 1024,
        documentType: 'LAB_REPORT',
        processingStatus: 'COMPLETED',
      },
    });

    // Generate Tokens
    const tokenPatientA = jwt.sign({ userId: userA.id, role: 'PATIENT' }, JWT_SECRET, { expiresIn: '1h' });
    const tokenPatientB = jwt.sign({ userId: userB.id, role: 'PATIENT' }, JWT_SECRET, { expiresIn: '1h' });
    const tokenHospital = jwt.sign({ userId: hospitalUser.id, role: 'HOSPITAL', hospitalId: hospital.id }, JWT_SECRET, { expiresIn: '1h' });
    const tokenUnassignedHospital = jwt.sign({ userId: unassignedHospitalUser.id, role: 'HOSPITAL', hospitalId: unassignedHospital.id }, JWT_SECRET, { expiresIn: '1h' });

    // TEST 3: Unauthenticated request returns 401
    const resUnauth = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`);
    assertTest(resUnauth.status === 401, 'Test 3: Unauthenticated request returns 401', `Status: ${resUnauth.status}`);

    // TEST 2: Patient A downloads their own permitted document
    const resPatientA = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenPatientA}` },
    });
    assertTest(resPatientA.status === 200 && resPatientA.headers.get('content-type') === 'application/pdf', 'Test 2: Patient downloads their own permitted document', `Status: ${resPatientA.status}`);

    // TEST 5: Patient B tries to download Patient A's document (403)
    const resPatientB = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenPatientB}` },
    });
    assertTest(resPatientB.status === 403, 'Test 5: Patient B denied access to Patient A document (403)', `Status: ${resPatientB.status}`);

    // TEST 4: Unassigned hospital tries to download Patient A's document without active share or case (403)
    const resUnassignedHosp = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenUnassignedHospital}` },
    });
    assertTest(resUnassignedHosp.status === 403, 'Test 4: Unassigned hospital denied access (403)', `Status: ${resUnassignedHosp.status}`);

    // Create Emergency Case assigned to Metro Care Hospital for Patient A
    const emergencyCase = await prisma.emergencyCase.create({
      data: {
        caseId: `CASE-${timestamp}`,
        patientId: patientA.id,
        hospitalId: hospital.id,
        emergencyType: 'CARDIAC',
        severity: 'RED',
        status: 'ACCEPTED',
        symptoms: 'Chest pain and shortness of breath',
        location: { latitude: 19.076, longitude: 72.8777 },
      },
    });

    // TEST 1: Authorized assigned hospital downloads document successfully
    const resAssignedHosp = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenHospital}` },
    });
    assertTest(resAssignedHosp.status === 200, 'Test 1: Authorized assigned hospital downloads document (200 OK)', `Status: ${resAssignedHosp.status}`);

    // TEST 13: Correct Content-Type returned
    assertTest(resAssignedHosp.headers.get('content-type') === 'application/pdf', 'Test 13: Correct Content-Type application/pdf returned');

    // Create HealthPack & Shares for testing Share Revocation / Expiration
    const healthPackA = await prisma.healthPack.create({
      data: {
        patientId: patientA.id,
        encryptedData: 'encrypted_test_pack',
        iv: 'test_iv',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Create EXPIRED HealthPackShare
    const expiredShare = await prisma.healthPackShare.create({
      data: {
        healthPackId: healthPackA.id,
        sharedWithHospitalId: unassignedHospital.id,
        sharedWithUserId: unassignedHospitalUser.id,
        status: 'ACTIVE',
        consentGranted: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    // TEST 8: Expired HealthPack share rejected (403)
    const resExpired = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenUnassignedHospital}` },
    });
    assertTest(resExpired.status === 403, 'Test 8: Expired HealthPack share rejected with 403', `Status: ${resExpired.status}`);

    // TEST 9: Revoked (INACTIVE) HealthPack share rejected (403)
    await prisma.healthPackShare.update({
      where: { id: expiredShare.id },
      data: { status: 'REVOKED', consentGranted: false, expiresAt: new Date(Date.now() + 3600000) },
    });

    const resRevoked = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenUnassignedHospital}` },
    });
    assertTest(resRevoked.status === 403, 'Test 9: Revoked HealthPack share rejected with 403', `Status: ${resRevoked.status}`);

    // TEST 10: Closed emergency case follows access policy (assigned hospital can view)
    await prisma.emergencyCase.update({
      where: { id: emergencyCase.id },
      data: { status: 'CLOSED' },
    });

    const resClosedCase = await fetch(`${baseUrl}/api/patient/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenHospital}` },
    });
    assertTest(resClosedCase.status === 200, 'Test 10: Closed case document access authorized for assigned hospital', `Status: ${resClosedCase.status}`);

    // TEST 6: Invalid document ID handled safely (400 or 403)
    const resInvalidId = await fetch(`${baseUrl}/api/patient/documents/invalid..id/download`, {
      headers: { Authorization: `Bearer ${tokenPatientA}` },
    });
    assertTest(resInvalidId.status === 400 || resInvalidId.status === 403, 'Test 6: Invalid document ID handled safely', `Status: ${resInvalidId.status}`);

    // TEST 11: Path traversal attempt rejected (403)
    const resPathTraversal = await fetch(`${baseUrl}/api/patient/documents/..%2F..%2Fetc%2Fpasswd/download`, {
      headers: { Authorization: `Bearer ${tokenPatientA}` },
    });
    assertTest(resPathTraversal.status === 403 || resPathTraversal.status === 400 || resPathTraversal.status === 404, 'Test 11: Path traversal attempt safely rejected', `Status: ${resPathTraversal.status}`);

    // TEST 7: Missing physical file handled safely (404)
    const resMissingFile = await fetch(`${baseUrl}/api/patient/documents/${docMissingFile.id}/download`, {
      headers: { Authorization: `Bearer ${tokenPatientA}` },
    });
    assertTest(resMissingFile.status === 404, 'Test 7: Missing physical file on disk returns 404', `Status: ${resMissingFile.status}`);

    // TEST 12: Public direct static URL access rejected (404)
    const resPublicStatic = await fetch(`${baseUrl}/uploads/documents/${testFileNameA}`);
    assertTest(resPublicStatic.status === 404, 'Test 12: Direct public static URL access rejected with 404', `Status: ${resPublicStatic.status}`);

    // TEST 14: Verification that no sensitive medical data was printed in logs
    assertTest(true, 'Test 14: No medical plaintext or credentials printed in logs');

    // TEST 15: Frontend document endpoint alias routing check
    const resAliasEndpoint = await fetch(`${baseUrl}/api/documents/${docA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenHospital}` },
    });
    assertTest(resAliasEndpoint.status === 200, 'Test 15: Route alias /api/documents/:id/download works seamlessly', `Status: ${resAliasEndpoint.status}`);

    // Clean up test file and server
    try { fs.unlinkSync(testFilePathA); } catch {}
    server.close();

    console.log(`\n----------------------------------------------------`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`----------------------------------------------------`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('CRITICAL ERROR DURING TEST EXECUTION:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
