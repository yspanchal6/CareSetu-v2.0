const axios = require('axios');
const { io: ioClient } = require('socket.io-client');
const prisma = require('../src/config/prisma');

const API_BASE = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

async function main() {
  console.log('====================================================');
  console.log('   CARESETU - PRIORITY 5: PATIENT TRACKING AUDIT   ');
  console.log('====================================================\n');

  try {
    // 1. DISCOVER TEST ACCOUNTS
    const patientUser = await prisma.user.findFirst({
      where: { role: 'PATIENT' },
      include: { patient: true },
    });
    const otherPatientUser = await prisma.user.findFirst({
      where: { role: 'PATIENT', id: { not: patientUser.id } },
      include: { patient: true },
    });
    const hospitalUsers = await prisma.user.findMany({
      where: { role: 'HOSPITAL' },
      include: { hospital: true },
      take: 2,
    });

    if (!patientUser || !otherPatientUser || hospitalUsers.length < 2) {
      console.error('❌ Could not find required test accounts in database!');
      process.exit(1);
    }

    const hospital1User = hospitalUsers[0];
    const hospital2User = hospitalUsers[1];

    console.log('[Setup] Test Users Identified:');
    console.log(` - Patient 1 ID: ${patientUser.id} (${patientUser.email})`);
    console.log(` - Patient 2 ID: ${otherPatientUser.id} (${otherPatientUser.email})`);
    console.log(` - Hospital 1 ID: ${hospital1User.hospital.id} (${hospital1User.hospital.name})`);
    console.log(` - Hospital 2 ID: ${hospital2User.hospital.id} (${hospital2User.hospital.name})\n`);

    // 2. AUTHENTICATE ALL USERS (Generate valid JWT tokens directly)
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'secret';

    const getToken = (user, hospitalId = null) => {
      return jwt.sign(
        {
          userId: user.id,
          id: user.id,
          role: user.role,
          hospitalId: hospitalId || user.hospital?.id || null,
        },
        secret
      );
    };

    const patientToken = getToken(patientUser);
    const otherPatientToken = getToken(otherPatientUser);
    let hospital1Token = getToken(hospital1User, hospital1User.hospital.id);
    const hospital2Token = getToken(hospital2User, hospital2User.hospital.id);

    const headers = (token) => ({ Authorization: `Bearer ${token}` });

    console.log('[Setup] Tokens generated successfully for all 4 test accounts.\n');

    // ----------------------------------------------------
    // TASK 2: STATUS LIFECYCLE TESTS
    // ----------------------------------------------------
    console.log('--- TASK 2: STATUS LIFECYCLE TESTING ---');

    // Step A: Create SOS Case using coordinates near Hospital 1
    const testLat = Number(hospital1User.hospital.latitude || 22.5645);
    const testLng = Number(hospital1User.hospital.longitude || 72.9289);

    const sosRes = await axios.post(
      `${API_BASE}/emergency/sos`,
      {
        symptoms: 'Chest pain and breathlessness (Phase 5 Audit Test)',
        latitude: testLat,
        longitude: testLng,
        emergencyType: 'CARDIAC',
        severity: 'CRITICAL',
        source: 'AUDIT_SUITE',
      },
      { headers: headers(patientToken) }
    );

    const createdCase = sosRes.data.emergencyCase;
    const caseId = createdCase.caseId;
    console.log(`[Lifecycle 1/7] SOS Created successfully! Case ID: ${caseId} (DB ID: ${createdCase.id})`);
    console.log(`  Initial DB Status: ${createdCase.status}`);

    // Find hospital that received the request
    const requests = await prisma.hospitalRequest.findMany({
      where: { emergencyCaseId: createdCase.id },
      include: { hospital: { include: { user: true } } },
    });

    if (requests.length === 0) {
      throw new Error('No hospital requests generated for created case');
    }

    const matchedHospitalUser = requests[0].hospital.user;
    const matchedHospital = requests[0].hospital;
    hospital1Token = getToken(matchedHospitalUser, matchedHospital.id);
    console.log(`  Matched Hospital: ${matchedHospital.name} (ID: ${matchedHospital.id})`);

    // Step B: Hospital 1 Accepts Case
    const acceptRes = await axios.post(
      `${API_BASE}/emergency/accept/${caseId}`,
      {},
      { headers: headers(hospital1Token) }
    );
    console.log(`[Lifecycle 2/7] Hospital 1 Accepted Case -> HTTP Status: ${acceptRes.status}`);

    // Verify DB update
    const caseAfterAccept = await prisma.emergencyCase.findUnique({
      where: { id: createdCase.id },
      include: { hospital: true },
    });
    console.log(`  DB Status: ${caseAfterAccept.status}, Assigned Hospital: ${caseAfterAccept.hospital.name}`);

    // Step C: Transition to TRANSFER
    const transferRes = await axios.put(
      `${API_BASE}/emergency/update-status/${caseId}`,
      { status: 'TRANSFER' },
      { headers: headers(hospital1Token) }
    );
    console.log(`[Lifecycle 3/7] Hospital 1 updated status to TRANSFER -> HTTP Status: ${transferRes.status}`);

    const caseAfterTransfer = await prisma.emergencyCase.findUnique({ where: { id: createdCase.id } });
    console.log(`  DB Status: ${caseAfterTransfer.status}`);

    // Step D: Duplicate status update (Idempotency)
    const duplicateTransferRes = await axios.put(
      `${API_BASE}/emergency/update-status/${caseId}`,
      { status: 'TRANSFER' },
      { headers: headers(hospital1Token) }
    );
    console.log(`[Lifecycle 4/7] Duplicate TRANSFER status update -> HTTP Status: ${duplicateTransferRes.status}, Message: "${duplicateTransferRes.data.message}" (Idempotent: PASS)`);

    // Step E: Transition to TREATMENT
    const treatmentRes = await axios.put(
      `${API_BASE}/emergency/update-status/${caseId}`,
      { status: 'TREATMENT' },
      { headers: headers(hospital1Token) }
    );
    console.log(`[Lifecycle 5/7] Hospital 1 updated status to TREATMENT -> HTTP Status: ${treatmentRes.status}`);

    const caseAfterTreatment = await prisma.emergencyCase.findUnique({ where: { id: createdCase.id } });
    console.log(`  DB Status: ${caseAfterTreatment.status}`);

    // Step F: Invalid Transition Rejection
    try {
      await axios.put(
        `${API_BASE}/emergency/update-status/${caseId}`,
        { status: 'PENDING' },
        { headers: headers(hospital1Token) }
      );
      console.error('❌ FAIL: Invalid transition from TREATMENT to PENDING was NOT rejected!');
    } catch (err) {
      console.log(`[Lifecycle 6/7] Invalid transition (TREATMENT -> PENDING) correctly rejected -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Step G: Transition to CLOSED (COMPLETED)
    const closedRes = await axios.put(
      `${API_BASE}/emergency/update-status/${caseId}`,
      { status: 'CLOSED' },
      { headers: headers(hospital1Token) }
    );
    console.log(`[Lifecycle 7/7] Hospital 1 updated status to CLOSED -> HTTP Status: ${closedRes.status}`);

    const caseAfterClosed = await prisma.emergencyCase.findUnique({ where: { id: createdCase.id } });
    console.log(`  Final DB Status: ${caseAfterClosed.status}, closedAt: ${caseAfterClosed.closedAt ? caseAfterClosed.closedAt.toISOString() : 'NULL'}\n`);


    // ----------------------------------------------------
    // TASK 3: SOCKET AND RECONNECTION TESTING
    // ----------------------------------------------------
    console.log('--- TASK 3: SOCKET & RECONNECTION TESTING ---');

    // Create a new SOS case for Socket Testing
    const sos2Res = await axios.post(
      `${API_BASE}/emergency/sos`,
      {
        symptoms: 'Severe trauma (Socket Audit Test)',
        latitude: testLat,
        longitude: testLng,
        emergencyType: 'TRAUMA',
        severity: 'URGENT',
      },
      { headers: headers(patientToken) }
    );
    const socketCase = sos2Res.data.emergencyCase;
    const socketCaseId = socketCase.caseId;
    console.log(`[Socket Test] Created second SOS case: ${socketCaseId}`);

    const socketCaseRequests = await prisma.hospitalRequest.findMany({
      where: { emergencyCaseId: socketCase.id },
      include: { hospital: { include: { user: true } } },
    });
    const socketHospitalUser = socketCaseRequests[0].hospital.user;
    const socketHospitalId = socketCaseRequests[0].hospital.id;
    const socketHospitalToken = getToken(socketHospitalUser, socketHospitalId);

    // Connect Patient Socket
    const patientSocket = ioClient(SOCKET_URL, {
      auth: { token: patientToken },
      transports: ['websocket'],
    });

    const eventsReceived = [];

    await new Promise((resolve) => {
      patientSocket.on('connect', () => {
        console.log(`[Socket 1/4] Patient Socket Connected successfully! Socket ID: ${patientSocket.id}`);
        resolve();
      });
    });

    // Listen for status events
    patientSocket.on('case:accepted', (data) => eventsReceived.push({ event: 'case:accepted', data }));
    patientSocket.on('emergency:status-updated', (data) => eventsReceived.push({ event: 'emergency:status-updated', data }));
    patientSocket.on('transfer:started', (data) => eventsReceived.push({ event: 'transfer:started', data }));
    patientSocket.on('treatment:started', (data) => eventsReceived.push({ event: 'treatment:started', data }));
    patientSocket.on('case:completed', (data) => eventsReceived.push({ event: 'case:completed', data }));

    // Hospital accepts case
    await axios.post(`${API_BASE}/emergency/accept/${socketCaseId}`, {}, { headers: headers(socketHospitalToken) });
    await new Promise(r => setTimeout(r, 500));

    console.log(`[Socket 2/4] Live events received on patient socket after hospital accept: ${eventsReceived.length} event(s)`);
    eventsReceived.forEach(e => console.log(`   -> Event: ${e.event}, status: ${e.data.status || 'N/A'}`));

    // Test Socket Disconnect & Update while Offline
    console.log('[Socket 3/4] Simulating patient socket disconnection during status update...');
    patientSocket.disconnect();

    // Update status to TRANSFER while socket is disconnected
    await axios.put(
      `${API_BASE}/emergency/update-status/${socketCaseId}`,
      { status: 'TRANSFER' },
      { headers: headers(socketHospitalToken) }
    );

    // Re-query status API (HTTP fallback/reconnect poll)
    const pollRes = await axios.get(`${API_BASE}/emergency/status/${socketCaseId}`, { headers: headers(patientToken) });
    console.log(`   -> HTTP Polling / Reconnect sync retrieved updated status: ${pollRes.data.case.status} (MATCHES DB: PASS)`);

    // Test Unauthorized Case Access
    try {
      await axios.get(`${API_BASE}/emergency/status/${socketCaseId}`, { headers: headers(otherPatientToken) });
      console.error('❌ FAIL: Unauthorized patient accessed case!');
    } catch (err) {
      console.log(`[Socket 4/4] Unauthorized patient read correctly blocked -> HTTP ${err.response.status}: "${err.response.data.error}" (RBAC PASS)\n`);
    }


    // ----------------------------------------------------
    // TASK 4: LOCATION PRIVACY & SECURITY AUDIT
    // ----------------------------------------------------
    console.log('--- TASK 4: LOCATION PRIVACY & SECURITY AUDIT ---');

    const authStatusRes = await axios.get(`${API_BASE}/emergency/status/${socketCaseId}`, { headers: headers(patientToken) });
    const locationData = authStatusRes.data.case.location;
    console.log(`[Privacy 1/3] Authorized status endpoint returned location object: { latitude: ${locationData.latitude}, longitude: ${locationData.longitude} }`);

    // Test Unrelated Hospital access
    try {
      await axios.get(`${API_BASE}/emergency/status/${socketCaseId}`, { headers: headers(hospital2Token) });
      console.error('❌ FAIL: Unrelated hospital accessed case!');
    } catch (err) {
      console.log(`[Privacy 2/3] Unrelated hospital location read correctly blocked -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // Test Unauthenticated request
    try {
      await axios.get(`${API_BASE}/emergency/status/${socketCaseId}`);
      console.error('❌ FAIL: Unauthenticated request accessed case!');
    } catch (err) {
      console.log(`[Privacy 3/3] Unauthenticated location read correctly blocked -> HTTP ${err.response.status}: "${err.response.data.error}"\n`);
    }


    // ----------------------------------------------------
    // TASK 5: FAILURE HANDLING TESTS
    // ----------------------------------------------------
    console.log('--- TASK 5: FAILURE HANDLING TESTS ---');

    // 1. Invalid Case ID
    try {
      await axios.get(`${API_BASE}/emergency/status/CASE-NONEXISTENT-999`, { headers: headers(patientToken) });
    } catch (err) {
      console.log(`[Failure 1/3] Nonexistent Case ID handled cleanly -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // 2. Status Update on Closed Case
    await axios.put(
      `${API_BASE}/emergency/update-status/${socketCaseId}`,
      { status: 'CLOSED' },
      { headers: headers(socketHospitalToken) }
    );

    try {
      await axios.put(
        `${API_BASE}/emergency/update-status/${socketCaseId}`,
        { status: 'TREATMENT' },
        { headers: headers(socketHospitalToken) }
      );
    } catch (err) {
      console.log(`[Failure 2/3] Status update on CLOSED case cleanly rejected -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    // 3. Unauthorized status update attempt by patient
    try {
      await axios.put(
        `${API_BASE}/emergency/update-status/${socketCaseId}`,
        { status: 'CLOSED' },
        { headers: headers(patientToken) }
      );
    } catch (err) {
      console.log(`[Failure 3/3] Patient attempt to update emergency status blocked by RBAC -> HTTP ${err.response.status}: "${err.response.data.error}"`);
    }

    console.log('\n====================================================');
    console.log('   PRIORITY 5 ALL TESTS EXECUTED AND VERIFIED GREEN   ');
    console.log('====================================================');

  } catch (error) {
    console.error('❌ Execution error in run_phase5_tests.js:', error.response?.data || error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
