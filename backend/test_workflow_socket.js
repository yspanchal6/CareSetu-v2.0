/**
 * CareSetu Emergency SOS — realtime (Socket.IO) verification.
 * Verifies the exact events the patient tracking page consumes via EMERGENCY_EVENTS bus.
 * Listeners registered BEFORE triggering backend actions to avoid races.
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
  server = http.createServer(app);
  initSocket(server);
  await new Promise((r) => server.listen(5555, r));

  const emails = ['ws_patient@test.com', 'ws_hospital@test.com'];
  await cleanup(emails);

  const passHash = await bcrypt.hash('password123', 10);
  const pUser = await prisma.user.create({
    data: { name: 'WS Patient', email: emails[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'WS Patient', age: 30, gender: 'M', phone: '9898000002' } } },
    include: { patient: true },
  });
  await require('./src/services/health-pack.service').createHealthPack(pUser.patient.id, { bloodType: 'AB+' });

  const hUser = await prisma.user.create({
    data: { name: 'WS Hospital', email: emails[1], password: passHash, role: 'HOSPITAL',
      hospital: { create: {
        name: 'WS Hospital', address: 'Test, Ahmedabad, Gujarat 380001', phone: '9898000003',
        city: 'Ahmedabad', state: 'Gujarat', emergencyAvailable: true, hasEmergencyDepartment: true,
        hasCardiology: true, hasICU: true, capabilities: ['Emergency', 'Cardiac'],
        location: { latitude: 23.0225, longitude: 72.5714 },
      } } },
    include: { hospital: true },
  });

  const pLogin = await api('POST', '/auth/login', null, { email: emails[0], password: 'password123' });
  const hLogin = await api('POST', '/auth/login', null, { email: emails[1], password: 'password123' });

  console.log('\n═══ PATIENT SOCKET CONNECT ═══\n');
  const socket = await connectSocket(pLogin.json.token);
  ok('Patient socket connected (authenticated)', socket.connected);

  console.log('\n═══ SOS → REAL-TIME CASE CREATED + HOSPITAL FOUND ═══\n');
  // Register listeners BEFORE triggering the SOS call to avoid race on synchronous emissions
  const createdP = waitForEvent(socket, 'emergency:created');
  const foundP  = waitForEvent(socket, 'hospital:found');

  const sos = await api('POST', '/emergency/sos', pLogin.json.token, {
    symptoms: 'Chest pain', emergencyType: 'CARDIAC',
    latitude: 23.0225, longitude: 72.5714, idempotencyKey: 'ws-' + Date.now(),
  });
  ok('SOS HTTP → 201', sos.status === 201, sos.json);
  const publicCaseId = sos.json.publicCaseId;

  const createdEvent = await createdP;
  ok('Socket emergency:created includes public caseId', !!createdEvent && createdEvent.caseId === publicCaseId, createdEvent);

  const foundEvent = await foundP;
  ok('Socket hospital:found has real hospital name + caseId',
    !!foundEvent && !!foundEvent.hospital?.id && !!foundEvent.hospital?.name && foundEvent.caseId === publicCaseId, foundEvent);

  console.log('\n═══ HOSPITAL ACCEPT → case:accepted + transfer:started ═══\n');
  const caP = waitForEvent(socket, 'case:accepted');
  const tsP = waitForEvent(socket, 'transfer:started');
  const accept = await api('POST', `/emergency/accept/${publicCaseId}`, hLogin.json.token);
  ok('Accept HTTP 200 + status TRANSFER', accept.status === 200 && accept.json.case?.status === 'TRANSFER', accept.json);
  const ca = await caP;
  ok('Socket case:accepted → TRANSFER + hospital id', !!ca && ca.status === 'TRANSFER' && ca.hospital?.id === hUser.hospital.id, ca);
  const ts = await tsP;
  ok('Socket transfer:started → hospital + startedAt', !!ts && ts.hospital?.id === hUser.hospital.id && !!ts.startedAt, ts);

  console.log('\n═══ TREATMENT STARTED ═══\n');
  const t1 = waitForEvent(socket, 'treatment:started');
  const upd = await api('PUT', `/emergency/update-status/${publicCaseId}`, hLogin.json.token, { status: 'TREATMENT' });
  ok('HTTP update → TREATMENT', upd.status === 200 && upd.json.emergencyCase?.status === 'TREATMENT', upd.json.emergencyCase);
  const tc = await t1;
  ok('Socket treatment:started → caseId + hospital', !!tc && tc.caseId === publicCaseId && tc.hospital?.id === hUser.hospital.id, tc);

  console.log('\n═══ COMPLETED ═══\n');
  const c1 = waitForEvent(socket, 'case:completed');
  const fin = await api('PUT', `/emergency/update-status/${publicCaseId}`, hLogin.json.token, { status: 'CLOSED' });
  ok('HTTP update → CLOSED', fin.status === 200 && fin.json.emergencyCase?.status === 'CLOSED', fin.json.emergencyCase);
  const cc = await c1;
  ok('Socket case:completed → caseId + completedAt', !!cc && cc.caseId === publicCaseId && !!cc.completedAt, cc);

  socket.disconnect();
  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══\n`);

  await cleanup(emails);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); process.exit(1); });