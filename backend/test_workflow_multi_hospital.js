/**
 * CareSetu Emergency Operations — Multi-Hospital Real-time Acceptance Verification Test (§87 / §91).
 *
 * Verifies:
 * 1. Patient creates emergency SOS -> Hospital A and Hospital B both receive requests.
 * 2. Hospital A accepts case -> Hospital A receives socket event `case:assigned-to-us` / `emergency:accepted`.
 * 3. Hospital B receives socket event `case:closed-elsewhere` / `emergency:request-updated` in real-time.
 * 4. Race Condition: Hospital B attempting to accept receives HTTP 409 Conflict.
 */
const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');
const { io } = require('../frontend/node_modules/socket.io-client');

const app = require('./src/app');
const { initSocket } = require('./src/utils/socket');
const http = require('http');

let BASE = 'http://localhost:5555';
let SOCKET = 'http://localhost:5555';
let server;

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed += 1; console.log(`  ✅ ${name}`); }
  else { failed += 1; console.log(`  ❌ ${name}${extra ? ' — ' + JSON.stringify(extra) : ''}`); }
}

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET, { transports: ['websocket'], auth: { token }, reconnection: false });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timeout')), 8000);
  });
}

function waitForEvent(socket, event, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

async function cleanup(emails) {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  for (const u of users) {
    const patients = await prisma.patient.findMany({ where: { userId: u.id }, select: { id: true } });
    const hospitals = await prisma.hospital.findMany({ where: { userId: u.id }, select: { id: true } });
    const patIds = patients.map(p => p.id);
    const hosIds = hospitals.map(h => h.id);
    const cases = await prisma.emergencyCase.findMany({
      where: { OR: [{ patientId: { in: patIds } }, { hospitalId: { in: hosIds } }] }, select: { id: true },
    });
    const caseIds = cases.map(c => c.id);
    if (caseIds.length) await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: caseIds } } });
    if (caseIds.length) await prisma.emergencyCase.deleteMany({ where: { id: { in: caseIds } } });
    if (patIds.length) await prisma.healthPackShare.deleteMany({ where: { healthPack: { patientId: { in: patIds } } } });
    if (patIds.length) await prisma.healthPack.deleteMany({ where: { patientId: { in: patIds } } });
    if (patIds.length) await prisma.patient.deleteMany({ where: { userId: u.id } });
    if (hosIds.length) await prisma.hospital.deleteMany({ where: { userId: u.id } });
  }
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

async function main() {
  console.log('═══ CARESETU MULTI-HOSPITAL REALTIME ACCEPTANCE TEST ═══\n');

  server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(5555, resolve));
  console.log('Server started on http://localhost:5555');

  const emails = ['mh_patient@test.com', 'mh_hospital_a@test.com', 'mh_hospital_b@test.com'];
  await cleanup(emails);

  const passHash = await bcrypt.hash('password123', 10);

  // 1. Create Patient
  const pUser = await prisma.user.create({
    data: {
      name: 'Multi Patient', email: emails[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'Multi Patient', age: 45, gender: 'M', phone: '9900000001' } },
    },
    include: { patient: true },
  });

  // 2. Create Hospital A
  const hAUser = await prisma.user.create({
    data: {
      name: 'Hospital A', email: emails[1], password: passHash, role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Hospital A City Center', address: 'Main Street 100, Ahmedabad', phone: '9900000002',
          city: 'Ahmedabad', state: 'Gujarat', emergencyAvailable: true, hasEmergencyDepartment: true,
          hasCardiology: true, hasICU: true, capabilities: ['Emergency', 'Cardiac'],
          location: { latitude: 23.0225, longitude: 72.5714 },
        },
      },
    },
    include: { hospital: true },
  });

  // 3. Create Hospital B
  const hBUser = await prisma.user.create({
    data: {
      name: 'Hospital B Regional', email: emails[2], password: passHash, role: 'HOSPITAL',
      hospital: {
        create: {
          name: 'Hospital B Regional', address: 'Ring Road 200, Ahmedabad', phone: '9900000003',
          city: 'Ahmedabad', state: 'Gujarat', emergencyAvailable: true, hasEmergencyDepartment: true,
          hasCardiology: true, hasICU: true, capabilities: ['Emergency', 'Cardiac'],
          location: { latitude: 23.0230, longitude: 72.5720 },
        },
      },
    },
    include: { hospital: true },
  });

  // 4. Authenticate Users via API
  const pLogin = await api('POST', '/auth/login', null, { email: emails[0], password: 'password123' });
  const hALogin = await api('POST', '/auth/login', null, { email: emails[1], password: 'password123' });
  const hBLogin = await api('POST', '/auth/login', null, { email: emails[2], password: 'password123' });

  ok('Patient login successful', pLogin.status === 200 && !!pLogin.json.token);
  ok('Hospital A login successful', hALogin.status === 200 && !!hALogin.json.token);
  ok('Hospital B login successful', hBLogin.status === 200 && !!hBLogin.json.token);

  // 5. Connect Sockets for Patient, Hospital A, and Hospital B
  console.log('\n═══ CONNECTING REAL-TIME SOCKETS ═══\n');
  const pSocket = await connectSocket(pLogin.json.token);
  const hASocket = await connectSocket(hALogin.json.token);
  const hBSocket = await connectSocket(hBLogin.json.token);

  ok('Patient socket connected', pSocket.connected);
  ok('Hospital A socket connected', hASocket.connected);
  ok('Hospital B socket connected', hBSocket.connected);

  // Register listeners BEFORE triggering SOS
  const hANewCaseP = waitForEvent(hASocket, 'emergency:new-case');
  const hBNewCaseP = waitForEvent(hBSocket, 'emergency:new-case');

  // 6. Patient triggers Emergency SOS
  console.log('\n═══ PATIENT TRIGGERS SOS ═══\n');
  const sos = await api('POST', '/emergency/sos', pLogin.json.token, {
    symptoms: 'Acute chest pain and dizziness', emergencyType: 'CARDIAC',
    latitude: 23.0225, longitude: 72.5714, idempotencyKey: 'mh-' + Date.now(),
  });
  ok('SOS created (HTTP 201)', sos.status === 201, sos.json);
  const publicCaseId = sos.json.publicCaseId;

  const hANewCase = await hANewCaseP;
  const hBNewCase = await hBNewCaseP;
  ok('Hospital A received emergency:new-case via socket', !!hANewCase && hANewCase.caseId === publicCaseId, hANewCase);
  ok('Hospital B received emergency:new-case via socket', !!hBNewCase && hBNewCase.caseId === publicCaseId, hBNewCase);

  // 7. Hospital A Accepts Case
  console.log('\n═══ HOSPITAL A ACCEPTS CASE → VERIFYING REAL-TIME BROADCASTS ═══\n');

  const hAAssignedP = waitForEvent(hASocket, 'case:assigned-to-us');
  const hBClosedP = waitForEvent(hBSocket, 'case:closed-elsewhere');
  const pAcceptedP = waitForEvent(pSocket, 'case:accepted');

  const acceptRes = await api('POST', `/emergency/accept/${publicCaseId}`, hALogin.json.token);
  ok('Hospital A accept API returns HTTP 200', acceptRes.status === 200, acceptRes.json);

  const hAAssigned = await hAAssignedP;
  ok('Hospital A received case:assigned-to-us socket event', !!hAAssigned && hAAssigned.caseId === publicCaseId, hAAssigned);

  const hBClosed = await hBClosedP;
  ok('Hospital B received case:closed-elsewhere socket event IN REAL TIME', !!hBClosed && hBClosed.caseId === publicCaseId, hBClosed);

  const pAccepted = await pAcceptedP;
  ok('Patient received case:accepted socket event', !!pAccepted && pAccepted.caseId === publicCaseId && pAccepted.status === 'TRANSFER', pAccepted);

  // 8. Race Condition / Conflict Test
  console.log('\n═══ STALE REQUEST / RACE CONDITION TEST ═══\n');
  const hBAcceptAttempt = await api('POST', `/emergency/accept/${publicCaseId}`, hBLogin.json.token);
  ok('Hospital B accept attempt rejected with 409 Conflict', hBAcceptAttempt.status === 409, hBAcceptAttempt.json);

  // Disconnect Sockets
  pSocket.disconnect();
  hASocket.disconnect();
  hBSocket.disconnect();

  console.log(`\n═══ MULTI-HOSPITAL TEST COMPLETED: ${passed} passed, ${failed} failed ═══\n`);

  await cleanup(emails);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL ERROR in test:', e);
  process.exit(1);
});
