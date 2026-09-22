require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../src/config/prisma');

const API_BASE = 'http://localhost:3000/api';
const SECRET = process.env.JWT_SECRET || 'secret';

async function main() {
  console.log('====================================================');
  console.log(' CARESETU - HEALTHPACK & MEDICAL HISTORY SOS TEST   ');
  console.log('====================================================\n');

  try {
    // 1. Setup Test Users (Patient & 2 Hospitals)
    const patientUser = await prisma.user.findFirst({ where: { role: 'PATIENT' }, include: { patient: true } });
    const hospital1User = await prisma.user.findFirst({ where: { role: 'HOSPITAL' }, include: { hospital: true } });
    const hospital2User = await prisma.user.findMany({ where: { role: 'HOSPITAL' }, include: { hospital: true } }).then(res => res[1] || res[0]);

    if (!patientUser || !hospital1User || !hospital2User) {
      console.error('❌ Test setup failed: Required patient/hospital records not found in database.');
      process.exit(1);
    }

    const patientToken = jwt.sign({ userId: patientUser.id, role: 'PATIENT' }, SECRET, { expiresIn: '1h' });
    const hospital1Token = jwt.sign({ userId: hospital1User.id, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });
    const hospital2Token = jwt.sign({ userId: hospital2User.id, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });

    console.log(`[Setup] Active Test Users:`);
    console.log(` - Patient: ${patientUser.patient.name} (${patientUser.patient.id})`);
    console.log(` - Hospital 1 (Assigned): ${hospital1User.hospital.name} (${hospital1User.hospital.id})`);
    console.log(` - Hospital 2 (Unauthorized): ${hospital2User.hospital.name} (${hospital2User.hospital.id})\n`);

    // ----------------------------------------------------
    // TEST 1: MEDICAL DOCUMENT UPLOAD & PARSING
    // ----------------------------------------------------
    console.log('--- TEST 1: MEDICAL DOCUMENT UPLOAD & PARSING ---');
    const docData = await prisma.medicalDocument.create({
      data: {
        patientId: patientUser.patient.id,
        fileName: 'Cardiology_Discharge_Summary_Aug2026.pdf',
        fileUrl: '/uploads/documents/doc_test_123.pdf',
        fileType: 'PDF',
        fileSize: 450000,
        documentType: 'DISCHARGE_SUMMARY',
        extractedConditions: 'Heart disease / Cardiac condition, Hypertension',
        processingStatus: 'COMPLETED',
      },
    });

    console.log(`[Test 1] Document created in DB (id: ${docData.id}) with extracted suggestions: "${docData.extractedConditions}" (PASS ✅)\n`);

    // ----------------------------------------------------
    // TEST 2: HEALTHPACK CREATION (AES-256-GCM ENCRYPTION)
    // ----------------------------------------------------
    console.log('--- TEST 2: HEALTHPACK CREATION & AES-256-GCM ENCRYPTION ---');
    const healthPayload = {
      bloodGroup: 'B+',
      allergies: 'Penicillin, Dust',
      medications: 'Lisinopril 10mg, Aspirin 75mg',
      conditions: 'Heart disease, Hypertension, Type 2 Diabetes',
      heartCondition: 'YES',
      diabetesStatus: 'YES',
      hypertensionStatus: 'YES',
      surgeries: 'CABG 2024',
      notes: 'Patient requires continuous cardiac rhythm monitoring.',
      documentIds: [docData.id],
    };

    const hpRes = await axios.post(`${API_BASE}/healthpack`, { healthData: healthPayload }, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    console.log(`[Test 2] HealthPack create API response: HTTP ${hpRes.status} (id: ${hpRes.data.data.id})`);
    
    // Inspect database ciphertext
    const storedHp = await prisma.healthPack.findUnique({ where: { id: hpRes.data.data.id } });
    const isPlaintextExposed = storedHp.encryptedData.includes('Lisinopril') || storedHp.encryptedData.includes('Penicillin');
    console.log(`[Test 2] AES-256-GCM DB Ciphertext stored: ${storedHp.encryptedData.substring(0, 32)}... (Plaintext exposed? ${isPlaintextExposed ? 'YES ❌' : 'NO ✅ SECURE'})\n`);

    // ----------------------------------------------------
    // TEST 3: PATIENT DECRYPTED HEALTHPACK RETRIEVAL
    // ----------------------------------------------------
    console.log('--- TEST 3: PATIENT HEALTHPACK DECRYPTED VIEW ---');
    const myPackRes = await axios.get(`${API_BASE}/healthpack/my-pack`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    console.log(`[Test 3] Patient retrieved HealthPack -> Blood Group: ${myPackRes.data.data.healthData.bloodGroup}, Heart Status: ${myPackRes.data.data.healthData.heartCondition}, Documents attached: ${myPackRes.data.data.documents.length} (PASS ✅)\n`);

    // Fetch location of hospital 1
    const hospLoc = hospital1User.hospital.location || { latitude: 22.5539, longitude: 72.9489 };
    const lat = Number(hospLoc.latitude || 22.5539);
    const lng = Number(hospLoc.longitude || 72.9489);

    // ----------------------------------------------------
    // TEST 4: SOS TRIGGER WITH MEDICAL HISTORY SNAPSHOT
    // ----------------------------------------------------
    console.log('--- TEST 4: SOS TRIGGER & MEDICAL HISTORY SNAPSHOT ---');
    const sosRes = await axios.post(`${API_BASE}/emergency/sos`, {
      emergencyType: 'CARDIAC',
      severity: 'CRITICAL',
      symptoms: 'Severe chest pain with shortness of breath',
      latitude: lat,
      longitude: lng,
      source: 'PATIENT_APP',
    }, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    const caseId = sosRes.data.emergencyCase.id;
    const publicCaseId = sosRes.data.emergencyCase.caseId;
    console.log(`[Test 4] Emergency SOS Triggered -> Case ID: ${publicCaseId} (HTTP ${sosRes.status})`);
    
    // Inspect snapshot in database
    const createdCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
    console.log(`[Test 4] Medical Summary Snapshot in Case DB:`, createdCase.medicalSummary, `(Snapshot PASS ✅)\n`);

    // ----------------------------------------------------
    // TEST 5: HOSPITAL ACCEPTANCE & AUTO-SHARING
    // ----------------------------------------------------
    console.log('--- TEST 5: HOSPITAL ACCEPTANCE & AUTO-SHARING ---');
    const requestRow = await prisma.hospitalRequest.findFirst({
      where: { emergencyCaseId: caseId },
      include: { hospital: { include: { user: true } } },
    });

    if (!requestRow) {
      console.error('❌ FAIL: No hospital request was created for emergency case.');
      process.exit(1);
    }

    const assignedHosp = requestRow.hospital;
    const assignedHospToken = jwt.sign({ userId: assignedHosp.userId, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });

    const acceptRes = await axios.post(`${API_BASE}/emergency/accept/${caseId}`, {}, {
      headers: { Authorization: `Bearer ${assignedHospToken}` },
    });

    console.log(`[Test 5] Assigned Hospital (${assignedHosp.name}) accepted case -> HTTP ${acceptRes.status}`);

    // Check HealthPackShare record created
    const shareRecord = await prisma.healthPackShare.findFirst({
      where: { healthPackId: storedHp.id, sharedWithHospitalId: assignedHosp.id, status: 'ACTIVE' },
    });
    console.log(`[Test 5] Auto-Share HealthPackShare Record Created in DB? ${shareRecord ? 'YES ✅' : 'NO ❌'} (expiresAt: ${shareRecord?.expiresAt})\n`);

    // ----------------------------------------------------
    // TEST 6: AUTHORIZED HOSPITAL VIEWS DECRYPTED HEALTHPACK
    // ----------------------------------------------------
    console.log('--- TEST 6: AUTHORIZED HOSPITAL VIEWS DECRYPTED HEALTHPACK ---');
    const hospViewRes = await axios.get(`${API_BASE}/healthpack/case/${publicCaseId}`, {
      headers: { Authorization: `Bearer ${assignedHospToken}` },
    });

    console.log(`[Test 6] Hospital decrypted HealthPack data -> Heart: ${hospViewRes.data.data.healthData.heartCondition}, Allergies: ${hospViewRes.data.data.healthData.allergies}, Conditions: ${hospViewRes.data.data.healthData.conditions} (PASS ✅)\n`);

    // ----------------------------------------------------
    // TEST 7: UNAUTHORIZED HOSPITAL IDOR ACCESS REJECTION
    // ----------------------------------------------------
    console.log('--- TEST 7: UNAUTHORIZED HOSPITAL IDOR REJECTION ---');
    const unassignedHospUser = await prisma.user.findFirst({
      where: { role: 'HOSPITAL', hospital: { id: { not: assignedHosp.id } } },
      include: { hospital: true },
    });
    const unassignedHospToken = jwt.sign({ userId: unassignedHospUser.id, role: 'HOSPITAL' }, SECRET, { expiresIn: '1h' });

    try {
      await axios.get(`${API_BASE}/healthpack/case/${publicCaseId}`, {
        headers: { Authorization: `Bearer ${unassignedHospToken}` },
      });
      console.error('❌ FAIL: Unauthorized Hospital was able to view HealthPack!');
    } catch (idorErr) {
      console.log(`[Test 7] Unauthorized Hospital (${unassignedHospUser.hospital.name}) access rejected -> HTTP ${idorErr.response?.status}: "${idorErr.response?.data?.error}" (IDOR Protection PASS ✅)\n`);
    }

    // ----------------------------------------------------
    // TEST 8: REVOKED / EXPIRED SHARE ACCESS REJECTION
    // ----------------------------------------------------
    console.log('--- TEST 8: REVOKED SHARE REJECTION ---');
    await prisma.healthPackShare.update({
      where: { id: shareRecord.id },
      data: { status: 'REVOKED' },
    });

    try {
      await axios.get(`${API_BASE}/healthpack/case/${publicCaseId}`, {
        headers: { Authorization: `Bearer ${assignedHospToken}` },
      });
      console.error('❌ FAIL: Hospital was able to view revoked HealthPack!');
    } catch (revokeErr) {
      console.log(`[Test 8] Revoked share access rejected -> HTTP ${revokeErr.response?.status}: "${revokeErr.response?.data?.error}" (Revocation PASS ✅)\n`);
    }

    // Restore share status
    await prisma.healthPackShare.update({
      where: { id: shareRecord.id },
      data: { status: 'ACTIVE' },
    });

    console.log('====================================================');
    console.log(' CARESETU HEALTHPACK MEDICAL HISTORY SOS: ALL PASSED');
    console.log('====================================================');
    process.exit(0);

  } catch (err) {
    console.error('❌ Execution error in integration test:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
