/**
 * CareSetu Slice 6 verification — hospital response timeout + automatic re-route (§24).
 *
 * Run against a dedicated server instance with a fast timeout:
 *   HOSPITAL_RESPONSE_TIMEOUT_SECONDS=3 HOSPITAL_TIMEOUT_SWEEP_MS=1000 PORT=3010 node src/server.js
 *
 * Verifies:
 *   1. No-symptom SOS (§8) works on the dedicated server.
 *   2. Backend timeout expires ALL unresponsive PENDING requests (§24).
 *   3. Socket hospital:timeout fires (truthful, not acceptance).
 *   4. Audit log records HOSPITAL_TIMEOUT.
 *   5. Case stays PENDING (truthful — no fake hospital assignment).
 *   6. Hospital that rejects BEFORE timeout cascades to next (existing behavior).
 *   7. Cleanup is FK-safe.
 */
const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');
const { io } = require('../frontend/node_modules/socket.io-client');

process.env.HOSPITAL_RESPONSE_TIMEOUT_SECONDS = '3';
process.env.HOSPITAL_TIMEOUT_SWEEP_MS = '1000';

const app = require('./src/app');
const { initSocket } = require('./src/utils/socket');
const { startHospitalTimeoutSweeper } = require('./src/services/hospital-timeout.service');
const http = require('http');

const PORT = 3010;
const BASE = `http://localhost:${PORT}`;

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
    const socket = io(BASE, { transports: ['websocket'], auth: { token }, reconnection: false });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timeout')), 8000);
  });
}

function waitForEvent(socket, event, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

async function cleanup(emails) {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  const allUserIds = users.map(u => u.id);
  const patients = allUserIds.length ? await prisma.patient.findMany({ where: { userId: { in: allUserIds } }, select: { id: true } }) : [];
  const hospitals = allUserIds.length ? await prisma.hospital.findMany({ where: { userId: { in: allUserIds } }, select: { id: true } }) : [];
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
  if (patIds.length) await prisma.patient.deleteMany({ where: { userId: { in: allUserIds } } });
  if (hosIds.length) await prisma.hospitalRequest.deleteMany({ where: { hospitalId: { in: hosIds } } });
  if (hosIds.length) await prisma.hospital.deleteMany({ where: { userId: { in: allUserIds } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

async function main() {
  const server = http.createServer(app);
  initSocket(server);
  await new Promise(r => server.listen(3010, r));
  startHospitalTimeoutSweeper();
  const emails = ['to_patient@test.com', 'to_hospital_a@test.com', 'to_hospital_b@test.com'];
  await cleanup(emails);

  const passHash = await bcrypt.hash('password123', 10);

  // Seed 2 CARDIAC hospitals at isolated coordinates (no other test hospitals nearby).
  const patientCoords = { lat: 24.50, lng: 72.50 };
  const hospitalDefs = [
    { name: 'TO Hospital A (closest)', email: emails[1], lat: 24.5001, lng: 72.5001 },
    { name: 'TO Hospital B (far)', email: emails[2], lat: 24.55, lng: 72.55 },
  ];

  const pUser = await prisma.user.create({
    data: { name: 'TO Patient', email: emails[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'TO Patient', age: 41, gender: 'M', phone: '9898000040' } } },
    include: { patient: true },
  });

  const hIds = {};
  for (const h of hospitalDefs) {
    const u = await prisma.user.create({
      data: { name: h.name, email: h.email, password: passHash, role: 'HOSPITAL',
        hospital: { create: {
          name: h.name, address: 'Isolated Test, Gujarat', phone: '9898000041',
          city: 'Test', state: 'Gujarat', emergencyAvailable: true, hasEmergencyDepartment: true,
          hasCardiology: true, hasICU: true, capabilities: ['Emergency', 'Cardiac'],
          location: { latitude: h.lat, longitude: h.lng },
        } } },
      include: { hospital: true },
    });
    hIds[h.email] = { userId: u.id, hospitalId: u.hospital.id };
  }

  const pLogin = await api('POST', '/auth/login', null, { email: emails[0], password: 'password123' });
  const hALogin = await api('POST', '/auth/login', null, { email: emails[1], password: 'password123' });
  const hBLogin = await api('POST', '/auth/login', null, { email: emails[2], password: 'password123' });
  ok('Patient + both hospital logins', !!pLogin.json.token && !!hALogin.json.token && !!hBLogin.json.token);

  // ── TEST 1: No-symptom SOS + timeout (§8 + §24) ──
  console.log('\n═══ 1. NO-SYMPTOM SOS + TIMEOUT ═══\n');
  const socket = await connectSocket(pLogin.json.token);
  const timeoutP = waitForEvent(socket, 'hospital:timeout');

  const sos = await api('POST', '/emergency/sos', pLogin.json.token, {
    latitude: patientCoords.lat, longitude: patientCoords.lng, idempotencyKey: 'to-' + Date.now(),
  });
  ok('No-symptom SOS → 201', sos.status === 201, sos.json);
  const publicCaseId = sos.json.publicCaseId;
  const caseDBId = sos.json.caseId;

  const reqs = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: caseDBId } });
  ok('At least 2 hospital requests created (our hospitals)', reqs.length >= 2, reqs.map(r => ({ status: r.status, hId: r.hospitalId })));
  ok('Our hospitals are in the requests', reqs.some(r => r.hospitalId === hIds[emails[1]].hospitalId) && reqs.some(r => r.hospitalId === hIds[emails[2]].hospitalId));

  // Wait for backend timeout (§24: backend-controlled, NOT frontend timer).
  console.log('  ⏳ Waiting ~5s for backend timeout...');
  const timeoutEvent = await timeoutP;
  ok('Socket hospital:timeout received', !!timeoutEvent && timeoutEvent.caseId === publicCaseId, timeoutEvent);
  ok('Timeout event names a hospital', !!timeoutEvent?.hospital?.name, timeoutEvent);
  ok('Timeout reason is truthful (no response)', /no response/i.test(timeoutEvent?.reason || ''), timeoutEvent?.reason);

  const reqsAfterTimeout = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: caseDBId } });
  const expiredReqs = reqsAfterTimeout.filter(r => r.status === 'EXPIRED');
  const pendingReqs = reqsAfterTimeout.filter(r => r.status === 'PENDING');
  ok('All requests EXPIRED (all asked simultaneously, all unresponsive)', expiredReqs.length === reqsAfterTimeout.length && expiredReqs.length >= 2, reqsAfterTimeout.map(r => r.status));
  ok('EXPIRED requests have respondedAt set', expiredReqs.every(r => !!r.respondedAt));

  const caseRow = await prisma.emergencyCase.findUnique({ where: { id: caseDBId } });
  ok('EmergencyCase still PENDING (truthful — no fake assignment)', caseRow.status === 'PENDING');
  ok('No acceptedAt set (no fake acceptance)', !caseRow.acceptedAt);

  const audit = await prisma.auditLog.findFirst({
    where: { entityId: caseDBId, details: { path: ['event'], equals: 'HOSPITAL_TIMEOUT' } },
  });
  ok('Audit log records HOSPITAL_TIMEOUT', !!audit);
  ok('Audit mentions the timeout window', audit?.details?.timeoutSeconds > 0, audit?.details);

  // ── TEST 2: Hospital rejects BEFORE timeout → cascade (existing §23) ──
  console.log('\n═══ 2. REJECT BEFORE TIMEOUT → CASCADE ═══\n');
  // Create a fresh case with fresh idempotency key.
  const timeoutP2 = waitForEvent(socket, 'hospital:timeout');
  const sos2 = await api('POST', '/emergency/sos', pLogin.json.token, {
    latitude: patientCoords.lat, longitude: patientCoords.lng, idempotencyKey: 'to-reject-' + Date.now(),
  });
  ok('Second SOS → 201', sos2.status === 201, sos2.json);
  const case2Id = sos2.json.caseId;

  // Hospital A rejects immediately (before timeout).
  const rejectA = await api('POST', `/emergency/reject/${sos2.json.publicCaseId}`, hALogin.json.token, { reason: 'No capacity' });
  ok('Hospital A rejects → 200', rejectA.status === 200, rejectA.json);

  const reqs2 = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: case2Id } });
  const rejectedReq = reqs2.find(r => r.hospitalId === hIds[emails[1]].hospitalId);
  ok('Hospital A request marked REJECTED', rejectedReq?.status === 'REJECTED');
  ok('Hospital A respondedAt set', !!rejectedReq?.respondedAt);

  const stillPending2 = reqs2.filter(r => r.status === 'PENDING');
  ok('Hospital B (and others) still PENDING after A rejects', stillPending2.length >= 1);

  // Wait for timeout to expire remaining.
  console.log('  ⏳ Waiting ~5s for timeout on remaining hospitals...');
  const timeoutEvent2 = await timeoutP2;
  ok('Socket hospital:timeout for remaining unresponsive hospitals', !!timeoutEvent2);

  const reqs2After = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: case2Id } });
  const rejected2 = reqs2After.filter(r => r.status === 'REJECTED');
  const expired2 = reqs2After.filter(r => r.status === 'EXPIRED');
  ok('Hospital A is REJECTED, remaining EXPIRED (truthful statuses)', rejected2.length >= 1 && expired2.length >= 1, reqs2After.map(r => r.status));

  const case2Row = await prisma.emergencyCase.findUnique({ where: { id: case2Id } });
  ok('Second case also PENDING (no fake assignment)', case2Row.status === 'PENDING');

  socket.disconnect();
  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══\n`);
  await cleanup(emails);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); process.exit(1); });