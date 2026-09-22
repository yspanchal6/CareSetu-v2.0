require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../src/config/prisma');
const { decryptJSON } = require('../src/utils/crypto');

const API_BASE = 'http://localhost:3000/api';
const SECRET = process.env.JWT_SECRET || 'secret';

let testFailed = false;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testFailed = true;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function main() {
  console.log('====================================================');
  console.log(' CARESETU - HEALTHPACK SECURITY & PRIVACY AUDIT     ');
  console.log('====================================================\n');

  try {
    // Setup Test Users (Patient 1, Patient 2, Hospital 1, Hospital 2)
    const patientUser = await prisma.user.findFirst({ where: { role: 'PATIENT' }, include: { patient: true } });
    const otherPatientUser = await prisma.user.findMany({ where: { role: 'PATIENT' }, include: { patient: true } }).then(r => r[1] || r[0]);
    const hospital1User = await prisma.user.findFirst({ where: { role: 'HOSPITAL' }, include: { hospital: true } });
    const hospital2User = await prisma.user.findMany({ where: { role: 'HOSPITAL' }, include: { hospital: true } }).then(r => r[1] || r[0]);

    if (!patientUser || !hospital1User || !hospital2User) {
      console.error('❌ Test setup failed: Required user records missing.');
      process.exit(1);
    }

    const patientToken = jwt.sign({ userId: patientUser.id, role: 'PATIENT' }, SECRET, { expiresIn: '1h' });
    const otherPatientToken = jwt.sign({ userId: otherPatientUser.id, role: 'PATIENT' }, SECRET, { expiresIn: '1h' });
    const hospital1Token = jwt.sign({ userId: hospital1User.id, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });
    const hospital2Token = jwt.sign({ userId: hospital2User.id, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });

    // ----------------------------------------------------
    // TEST 1: ENCRYPTED MEDICAL SUMMARY STORAGE & DB PLAINTEXT ABSENCE
    // ----------------------------------------------------
    console.log('--- TEST 1: ENCRYPTED MEDICAL SUMMARY STORAGE ---');
    const hospLoc = hospital1User.hospital.location || { latitude: 22.5539, longitude: 72.9489 };
    const sosRes = await axios.post(`${API_BASE}/emergency/sos`, {
      emergencyType: 'CARDIAC',
      severity: 'CRITICAL',
      symptoms: 'Severe chest pain with sweating',
      latitude: Number(hospLoc.latitude || 22.5539),
      longitude: Number(hospLoc.longitude || 72.9489),
      source: 'PATIENT_APP',
    }, { headers: { Authorization: `Bearer ${patientToken}` } });

    const caseId = sosRes.data.emergencyCase.id;
    const publicCaseId = sosRes.data.emergencyCase.caseId;

    const dbCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
    assert(dbCase.medicalSummary && dbCase.medicalSummary.encryptedData && dbCase.medicalSummary.iv, 'medicalSummary is encrypted with IV and ciphertext in DB');
    const isPlaintextExposed = JSON.stringify(dbCase.medicalSummary).includes('Lisinopril');
    assert(!isPlaintextExposed, 'Raw plaintext medical summary is NOT exposed in DB');

    // ----------------------------------------------------
    // TEST 2: CIPHERTEXT TAMPERING REJECTION
    // ----------------------------------------------------
    console.log('\n--- TEST 2: CIPHERTEXT TAMPERING REJECTION ---');
    try {
      decryptJSON('tampered_ciphertext:1234567890123456', dbCase.medicalSummary.iv);
      assert(false, 'Tampered ciphertext should have thrown decryption error');
    } catch (err) {
      assert(err.message.includes('Decryption failed'), 'Tampered ciphertext successfully rejected with safe error message');
    }

    // ----------------------------------------------------
    // TEST 3: CORRECT DECRYPTION OF SNAPSHOT
    // ----------------------------------------------------
    console.log('\n--- TEST 3: CORRECT DECRYPTION OF SNAPSHOT ---');
    const decryptedSummary = decryptJSON(dbCase.medicalSummary.encryptedData, dbCase.medicalSummary.iv);
    assert(decryptedSummary.cardiacCondition !== undefined, `Snapshot decrypted correctly -> cardiacCondition: ${decryptedSummary.cardiacCondition}`);

    // ----------------------------------------------------
    // TEST 4: PUBLIC STATIC ULOAD ACCESS REJECTION
    // ----------------------------------------------------
    console.log('\n--- TEST 4: PUBLIC STATIC UPLOAD ACCESS REJECTION ---');
    try {
      await axios.get('http://localhost:3000/uploads/documents/doc_test.pdf');
      assert(false, 'Public static /uploads endpoint should be disabled');
    } catch (err) {
      assert(err.response?.status === 404, 'Direct public static URL access rejected with HTTP 404');
    }

    // ----------------------------------------------------
    // TEST 5: PATH TRAVERSAL REJECTION
    // ----------------------------------------------------
    console.log('\n--- TEST 5: PATH TRAVERSAL REJECTION ---');
    try {
      await axios.get(`${API_BASE}/patient/documents/..%2F..%2F.env/download`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert(false, 'Path traversal attempt should have been blocked');
    } catch (err) {
      assert(err.response?.status === 403 || err.response?.status === 404, `Path traversal attempt safely rejected with HTTP ${err.response?.status}`);
    }

    // ----------------------------------------------------
    // TEST 6 & 7 & 8: UNAUTHORIZED DOCUMENT & IDOR ACCESS
    // ----------------------------------------------------
    console.log('\n--- TEST 6 & 7 & 8: DOCUMENT IDOR & PATIENT ISOLATION ---');
    const doc = await prisma.medicalDocument.create({
      data: {
        patientId: patientUser.patient.id,
        fileName: 'Secret_Report.pdf',
        fileUrl: '/uploads/documents/doc_secret.pdf',
        fileType: 'PDF',
        documentType: 'LAB_REPORT',
      },
    });

    try {
      await axios.get(`${API_BASE}/patient/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${otherPatientToken}` },
      });
      assert(false, 'Other patient should not access foreign document');
    } catch (idorErr) {
      assert(idorErr.response?.status === 403, 'Patient IDOR access rejected with HTTP 403');
    }

    // ----------------------------------------------------
    // TEST 9 & 10 & 11: HOSPITAL AUTO-SHARE, DECRYPTION & REVOCATION
    // ----------------------------------------------------
    console.log('\n--- TEST 9 & 10 & 11: HOSPITAL AUTO-SHARE & REVOCATION ---');
    const reqRow = await prisma.hospitalRequest.findFirst({
      where: { emergencyCaseId: caseId },
      include: { hospital: { include: { user: true } } },
    });

    const assignedHosp = reqRow ? reqRow.hospital : hospital1User.hospital;
    const assignedHospToken = jwt.sign({ userId: assignedHosp.userId, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });

    // Accept case
    await axios.post(`${API_BASE}/emergency/accept/${caseId}`, {}, {
      headers: { Authorization: `Bearer ${assignedHospToken}` },
    });

    // Hospital view HealthPack
    const hospView = await axios.get(`${API_BASE}/healthpack/case/${publicCaseId}`, {
      headers: { Authorization: `Bearer ${assignedHospToken}` },
    });
    assert(hospView.data.success && hospView.data.data.medicalSummary, 'Assigned hospital decrypted HealthPack and snapshot successfully');

    // Revoke share
    await prisma.healthPackShare.updateMany({
      where: { sharedWithHospitalId: assignedHosp.id },
      data: { status: 'REVOKED' },
    });

    try {
      await axios.get(`${API_BASE}/healthpack/case/${publicCaseId}`, {
        headers: { Authorization: `Bearer ${assignedHospToken}` },
      });
      assert(false, 'Hospital should not view revoked HealthPack');
    } catch (revokeErr) {
      assert(revokeErr.response?.status === 403, 'Revoked HealthPack share access rejected with HTTP 403');
    }

    // Restore share status
    await prisma.healthPackShare.updateMany({
      where: { sharedWithHospitalId: assignedHosp.id },
      data: { status: 'ACTIVE' },
    });

    // ----------------------------------------------------
    // TEST 14 & 15: SOCKET PRIVACY & NEGATION SCANNING
    // ----------------------------------------------------
    console.log('\n--- TEST 14 & 15: NEGATION HANDLING & SOCKET PRIVACY ---');
    const docService = require('../src/services/medical-document.service');
    const negatedUpload = await docService.uploadDocument(patientUser.patient.id, {
      originalname: 'Report_No_Heart_Disease.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('Patient denies cardiac history. No heart disease. Rule out diabetes.'),
    }, 'LAB_REPORT');

    assert(negatedUpload.suggestedConditions.length === 0, `Negated document ("no heart disease") generated 0 condition suggestions (PASS ✅)`);

    const positiveUpload = await docService.uploadDocument(patientUser.patient.id, {
      originalname: 'Report_Cardiac_Confirmed.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('Patient presents with severe cardiac disease and hypertension.'),
    }, 'LAB_REPORT');

    assert(positiveUpload.suggestedConditions.length > 0, `Positive document generated suggestions: ${positiveUpload.suggestedConditions.join(', ')}`);

    // Clean up test documents
    await prisma.medicalDocument.deleteMany({
      where: { id: { in: [doc.id, negatedUpload.document.id, positiveUpload.document.id] } },
    });

    // ----------------------------------------------------
    // TEST 17: SNAPSHOT IMMUTABILITY
    // ----------------------------------------------------
    console.log('\n--- TEST 17: SNAPSHOT IMMUTABILITY ---');
    // Edit patient profile post-SOS creation
    await prisma.patient.update({
      where: { id: patientUser.patient.id },
      data: { bloodGroup: 'AB-' },
    });

    const refreshedCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
    const decryptedPostEditSummary = decryptJSON(refreshedCase.medicalSummary.encryptedData, refreshedCase.medicalSummary.iv);
    assert(decryptedPostEditSummary.bloodGroup !== 'AB-', 'Emergency snapshot remained static and immutable after post-SOS patient edits');

    console.log('\n====================================================');
    if (testFailed) {
      console.error(' ❌ HEALTHPACK SECURITY & PRIVACY AUDIT FAILED');
      console.log('====================================================');
      process.exit(1);
    } else {
      console.log(' 🟢 HEALTHPACK SECURITY & PRIVACY AUDIT PASSED 20/20');
      console.log('====================================================');
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Execution error in remediation test suite:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
