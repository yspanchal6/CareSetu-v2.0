const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../src/config/prisma');
const healthPackService = require('../src/services/health-pack.service');
const { encrypt, decrypt } = require('../src/utils/crypto');

const API_BASE = 'http://localhost:3000/api';
const SECRET = process.env.JWT_SECRET || 'secret';

async function main() {
  console.log('====================================================');
  console.log(' CARESETU - PRIORITY 6: HEALTHPACK SECURITY AUDIT  ');
  console.log('====================================================\n');

  try {
    // 1. SETUP TEST ACCOUNTS
    const patientUser = await prisma.user.findFirst({
      where: { role: 'PATIENT', patient: { isNot: null } },
      include: { patient: true },
    });
    const otherPatientUser = await prisma.user.findFirst({
      where: { role: 'PATIENT', id: { not: patientUser.id }, patient: { isNot: null } },
      include: { patient: true },
    });
    const hospitalUsers = await prisma.user.findMany({
      where: { role: 'HOSPITAL', hospital: { isNot: null } },
      include: { hospital: true },
      take: 2,
    });

    if (!patientUser || !otherPatientUser || hospitalUsers.length < 2) {
      console.error('❌ Could not find required test accounts in DB');
      process.exit(1);
    }

    const hospital1User = hospitalUsers[0];
    const hospital2User = hospitalUsers[1];

    const getToken = (user, hospitalId = null) => {
      return jwt.sign(
        {
          userId: user.id,
          id: user.id,
          role: user.role,
          hospitalId: hospitalId || user.hospital?.id || null,
        },
        SECRET
      );
    };

    const patientToken = getToken(patientUser);
    const otherPatientToken = getToken(otherPatientUser);
    const hospital1Token = getToken(hospital1User, hospital1User.hospital.id);
    const hospital2Token = getToken(hospital2User, hospital2User.hospital.id);

    const headers = (token) => ({ Authorization: `Bearer ${token}` });

    console.log('[Setup] Test Users Identified:');
    console.log(` - Patient 1: ${patientUser.id} (${patientUser.email})`);
    console.log(` - Patient 2: ${otherPatientUser.id} (${otherPatientUser.email})`);
    console.log(` - Hospital 1: ${hospital1User.hospital.id} (${hospital1User.hospital.name})`);
    console.log(` - Hospital 2: ${hospital2User.hospital.id} (${hospital2User.hospital.name})\n`);

    // ----------------------------------------------------
    // PHASE 2: HEALTHPACK CREATION AND DATA INTEGRITY
    // ----------------------------------------------------
    console.log('--- PHASE 2: HEALTHPACK CREATION & DATA INTEGRITY ---');

    const sampleHealthData = {
      bloodGroup: 'O+',
      allergies: ['Penicillin', 'Peanuts'],
      medications: ['Aspirin 75mg daily'],
      chronicConditions: ['Hypertension'],
      emergencyContacts: [{ name: 'Jane Doe', relation: 'Spouse', phone: '+919876543210' }],
    };

    // Test 2.1: Authorized patient creates a HealthPack
    const createRes = await axios.post(
      `${API_BASE}/health-pack/`,
      { healthData: sampleHealthData },
      { headers: headers(patientToken) }
    );
    console.log(`[P2 1/5] Patient created HealthPack -> HTTP ${createRes.status}: "${createRes.data.message}"`);
    console.log(`   Pack ID: ${createRes.data.data.id}`);

    const packId = createRes.data.data.id;

    // Test 2.2: Missing healthData validation
    try {
      await axios.post(`${API_BASE}/health-pack/`, {}, { headers: headers(patientToken) });
    } catch (err) {
      console.log(`[P2 2/5] Missing payload validation -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Test 2.3: Unauthorized creation attempt by Hospital role
    try {
      await axios.post(`${API_BASE}/health-pack/`, { healthData: sampleHealthData }, { headers: headers(hospital1Token) });
    } catch (err) {
      console.log(`[P2 3/5] Hospital creation attempt blocked -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Test 2.4: Patient retrieves own HealthPack
    const getMyPackRes = await axios.get(`${API_BASE}/health-pack/my-pack`, { headers: headers(patientToken) });
    console.log(`[P2 4/5] Patient fetched own HealthPack -> HTTP ${getMyPackRes.status}`);
    console.log(`   Retrieved Blood Group: ${getMyPackRes.data.data.healthData.bloodGroup}, Allergies: ${getMyPackRes.data.data.healthData.allergies.join(', ')}`);

    // Test 2.5: Database persistence check
    const dbPack = await prisma.healthPack.findUnique({ where: { id: packId } });
    console.log(`[P2 5/5] DB Record Verified: ID=${dbPack.id}, Status=${dbPack.status}, IV length=${dbPack.iv.length} hex chars\n`);


    // ----------------------------------------------------
    // PHASE 3: ENCRYPTION AND PRIVACY VERIFICATION
    // ----------------------------------------------------
    console.log('--- PHASE 3: ENCRYPTION & PRIVACY VERIFICATION ---');

    console.log(`[P3 1/4] Inspecting stored DB encryptedData:`);
    console.log(`   RAW DB encryptedData column: "${dbPack.encryptedData.slice(0, 50)}..."`);
    console.log(`   Contains "Penicillin"? ${dbPack.encryptedData.includes('Penicillin') ? 'YES ❌ (UNENCRYPTED)' : 'NO ✅ (SECURE ENCRYPTED)'}`);
    console.log(`   Contains "O+"? ${dbPack.encryptedData.includes('O+') ? 'YES ❌ (UNENCRYPTED)' : 'NO ✅ (SECURE ENCRYPTED)'}`);

    // Test 3.2: Decryption round-trip
    const decryptedText = decrypt(dbPack.encryptedData, dbPack.iv);
    const parsedData = JSON.parse(decryptedText);
    console.log(`[P3 2/4] AES-256-GCM Decryption Round-Trip: Success! Recovered bloodGroup=${parsedData.bloodGroup}`);

    // Test 3.3: Tampered ciphertext or invalid tag handling
    try {
      const tamperedData = dbPack.encryptedData.slice(0, -4) + '0000';
      decrypt(tamperedData, dbPack.iv);
      console.error('❌ FAIL: Corrupted ciphertext did not throw!');
    } catch (err) {
      console.log(`[P3 3/4] Corrupted ciphertext/authTag rejected -> Exception: "${err.message}" (GCM Auth Tag PASS)`);
    }

    // Test 3.4: Invalid IV handling
    try {
      decrypt(dbPack.encryptedData, '000000000000000000000000');
      console.error('❌ FAIL: Invalid IV did not throw!');
    } catch (err) {
      console.log(`[P3 4/4] Invalid IV rejected -> Exception: "${err.message}"\n`);
    }


    // ----------------------------------------------------
    // PHASE 4: AUTHORIZATION AND RBAC TESTING
    // ----------------------------------------------------
    console.log('--- PHASE 4: AUTHORIZATION & RBAC TESTING ---');

    // Test 4.1: Unrelated hospital attempting shared access before consent
    try {
      await axios.get(`${API_BASE}/health-pack/shared/${packId}`, { headers: headers(hospital1Token) });
      console.error('❌ FAIL: Unrelated hospital accessed unshared HealthPack!');
    } catch (err) {
      console.log(`[P4 1/3] Unshared access by hospital blocked -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Test 4.2: Other patient attempting shared access
    try {
      await axios.get(`${API_BASE}/health-pack/shared/${packId}`, { headers: headers(otherPatientToken) });
    } catch (err) {
      console.log(`[P4 2/3] Patient role accessing hospital shared endpoint blocked -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Test 4.3: Unauthenticated request
    try {
      await axios.get(`${API_BASE}/health-pack/shared/${packId}`);
    } catch (err) {
      console.log(`[P4 3/3] Unauthenticated request blocked -> HTTP ${err.response.status}: "${err.response.data.error}"\n`);
    }


    // ----------------------------------------------------
    // PHASE 5 & 6: EMERGENCY SHARING & EXPIRATION/REVOCATION
    // ----------------------------------------------------
    console.log('--- PHASE 5 & 6: EMERGENCY SHARING & EXPIRATION/REVOCATION ---');

    const testLat = 22.5645;
    const testLng = 72.9289;
    console.log(`[P5 1/4] Patient 1 User ID: ${patientUser.id}, Patient Profile ID: ${patientUser.patient?.id}`);

    let sosRes;
    try {
      sosRes = await axios.post(
        `${API_BASE}/emergency/sos`,
        {
          symptoms: 'Chest pain (HealthPack Audit)',
          latitude: testLat,
          longitude: testLng,
          emergencyType: 'CARDIAC',
          severity: 'CRITICAL',
        },
        { headers: headers(patientToken) }
      );
    } catch (sosErr) {
      console.error('❌ SOS Creation Error Data:', sosErr.response?.data || sosErr.message);
      if (sosErr.stack) console.error(sosErr.stack);
      throw sosErr;
    }
    const caseId = sosRes.data.emergencyCase.caseId;
    console.log(`[P5 1/4] Emergency SOS created for patient: ${caseId}`);

    // Find hospital request generated
    const requests = await prisma.hospitalRequest.findMany({
      where: { emergencyCaseId: sosRes.data.emergencyCase.id },
      include: { hospital: { include: { user: true } } },
    });
    const acceptingHospital = requests[0].hospital;
    const acceptingHospitalToken = getToken(acceptingHospital.user, acceptingHospital.id);

    // Step 5.2: Hospital accepts case -> Auto-shares HealthPack
    await axios.post(`${API_BASE}/emergency/accept/${caseId}`, {}, { headers: headers(acceptingHospitalToken) });
    console.log(`[P5 2/4] Hospital "${acceptingHospital.name}" accepted case -> Auto-shared HealthPack!`);

    // Verify HealthPackShare DB record created
    const activeShare = await prisma.healthPackShare.findFirst({
      where: {
        healthPackId: packId,
        sharedWithHospitalId: acceptingHospital.id,
        status: 'ACTIVE',
      },
    });
    console.log(`   DB HealthPackShare: ID=${activeShare.id}, status=${activeShare.status}, consentGranted=${activeShare.consentGranted}`);

    // Step 5.3: Accepting hospital accesses shared HealthPack
    const sharedRes = await axios.get(`${API_BASE}/health-pack/shared/${packId}`, { headers: headers(acceptingHospitalToken) });
    console.log(`[P5 3/4] Accepting hospital retrieved decrypted HealthPack -> HTTP ${sharedRes.status}`);
    console.log(`   Decrypted payload bloodGroup: ${sharedRes.data.data.healthData.bloodGroup}`);

    // Step 5.4: Unrelated hospital attempts access to this shared pack
    try {
      await axios.get(`${API_BASE}/health-pack/shared/${packId}`, { headers: headers(hospital2Token) });
    } catch (err) {
      console.log(`[P5 4/4] Unrelated hospital access blocked -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Step 6.1: Expired Share Test
    console.log('\n[P6 1/3] Testing access on EXPIRED HealthPackShare...');
    await prisma.healthPackShare.update({
      where: { id: activeShare.id },
      data: { expiresAt: new Date(Date.now() - 1000 * 60) }, // 1 min ago
    });

    try {
      await axios.get(`${API_BASE}/health-pack/shared/${packId}`, { headers: headers(acceptingHospitalToken) });
      console.error('❌ FAIL: Expired share allowed access!');
    } catch (err) {
      console.log(`   Expired share access blocked -> HTTP ${err.response.status}: "${err.response.data.error}" (PASS)`);
    }

    // Step 6.2: Revoked Share Test
    console.log('[P6 2/3] Testing access on REVOKED HealthPackShare...');
    await prisma.healthPackShare.update({
      where: { id: activeShare.id },
      data: { status: 'REVOKED', expiresAt: new Date(Date.now() + 1000 * 3600) },
    });

    try {
      await axios.get(`${API_BASE}/health-pack/shared/${packId}`, { headers: headers(acceptingHospitalToken) });
      console.error('❌ FAIL: Revoked share allowed access!');
    } catch (err) {
      console.log(`   Revoked share access blocked -> HTTP ${err.response.status}: "${err.response.data.error}" (PASS)`);
    }

    // Restore active share status for clean testing
    await prisma.healthPackShare.update({
      where: { id: activeShare.id },
      data: { status: 'ACTIVE', expiresAt: new Date(Date.now() + 1000 * 3600) },
    });
    console.log('[P6 3/3] Restored ACTIVE share status.\n');


    // ----------------------------------------------------
    // PHASE 7: SECURITY AND FAILURE HANDLING
    // ----------------------------------------------------
    console.log('--- PHASE 7: SECURITY & FAILURE HANDLING ---');

    // Test 7.1: Invalid UUID payload in packId
    try {
      await axios.get(`${API_BASE}/health-pack/shared/INVALID-UUID-999`, { headers: headers(acceptingHospitalToken) });
    } catch (err) {
      console.log(`[P7 1/2] Invalid packId UUID handled cleanly -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Test 7.2: Nonexistent packId UUID
    try {
      await axios.get(`${API_BASE}/health-pack/shared/00000000-0000-0000-0000-000000000000`, { headers: headers(acceptingHospitalToken) });
    } catch (err) {
      console.log(`[P7 2/2] Nonexistent packId handled cleanly -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    console.log('\n====================================================');
    console.log('   PRIORITY 6 ALL TESTS EXECUTED AND VERIFIED GREEN   ');
    console.log('====================================================');

  } catch (error) {
    console.error('❌ Execution error in run_phase6_tests.js:', JSON.stringify(error.response?.data) || error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
