/**
 * CareSetu — dual-mode hospital popup verification (Scenario C).
 * Hospital socket receives `emergency:new-case` with:
 *   source: 'CHATBOT' (blue AI popup) vs 'PATIENT_APP' (red SOS popup)
 *   patientInfo: { name, age, gender, bloodGroup }
 */
const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');
const { io } = require('../frontend/node_modules/socket.io-client');

const BASE = 'http://localhost:3000';
const SOCKET = 'http://localhost:3000';

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
  const emails = ['popup_patient@test.com', 'popup_hospital@test.com'];
  await cleanup(emails);

  const passHash = await bcrypt.hash('password123', 10);
  const pUser = await prisma.user.create({
    data: { name: 'Popup Patient', email: emails[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'Popup Patient', age: 42, gender: 'F', phone: '9898000004', bloodGroup: 'O+' } } },
    include: { patient: true },
  });

  const hUser = await prisma.user.create({
    data: { name: 'Popup Hospital', email: emails[1], password: passHash, role: 'HOSPITAL',
      hospital: { create: {
        name: 'Popup Hospital', address: 'Test, Ahmedabad, Gujarat 380001', phone: '9898000005',
        city: 'Ahmedabad', state: 'Gujarat', emergencyAvailable: true, hasEmergencyDepartment: true,
        hasCardiology: true, hasICU: true, capabilities: ['Emergency', 'Cardiac'],
        location: { latitude: 23.0225, longitude: 72.5714 },
      } } },
    include: { hospital: true },
  });

  const pLogin = await api('POST', '/auth/login', null, { email: emails[0], password: 'password123' });
  const hLogin = await api('POST', '/auth/login', null, { email: emails[1], password: 'password123' });

  console.log('\n═══ HOSPITAL SOCKET CONNECT ═══\n');
  const hSocket = await connectSocket(hLogin.json.token);
  ok('Hospital socket connected', hSocket.connected);

  console.log('\n═══ CHATBOT SOS → dual-mode payload ═══\n');
  const n1 = waitForEvent(hSocket, 'emergency:new-case');
  const cb = await api('POST', '/emergency/sos', pLogin.json.token, {
    symptoms: 'Chest pain (severe), Sweating, Shortness of breath, Dizziness',
    emergencyType: 'CARDIAC',
    latitude: 23.0225, longitude: 72.5714,
    source: 'CHATBOT',
    idempotencyKey: 'popup-cb-' + Date.now(),
  });
  ok('Chatbot SOS HTTP → 201', cb.status === 201, cb.json);
  const pop1 = await n1;
  ok('Hospital socket got emergency:new-case', !!pop1, pop1);
  ok('source = CHATBOT (blue AI popup)', pop1?.source === 'CHATBOT', pop1?.source);
  ok('patientInfo.name + age', pop1?.patientInfo?.name === 'Popup Patient' && pop1?.patientInfo?.age === 42, pop1?.patientInfo);
  ok('patientInfo.bloodGroup = O+', pop1?.patientInfo?.bloodGroup === 'O+', pop1?.patientInfo);
  ok('caseId in payload matches public CASE-…', pop1 && (pop1.caseId === cb.json.publicCaseId), { got: pop1?.caseId, expected: cb.json.publicCaseId });

  const dpv = await prisma.emergencyCase.findUnique({ where: { caseId: cb.json.publicCaseId }, select: { source: true } });
  ok('Persisted EmergencyCase.source = CHATBOT', dpv?.source === 'CHATBOT', dpv);

  console.log('\n═══ PLAIN SOS → default source ═══\n');
  const n2 = waitForEvent(hSocket, 'emergency:new-case');
  const sos = await api('POST', '/emergency/sos', pLogin.json.token, {
    symptoms: 'Emergency',
    emergencyType: 'OTHER',
    latitude: 23.0225, longitude: 72.5714,
    idempotencyKey: 'popup-sos-' + Date.now(),
  });
  ok('Plain SOS HTTP → 201', sos.status === 201, sos.json);
  const pop2 = await n2;
  ok('source defaults to PATIENT_APP (red SOS popup)', pop2?.source === 'PATIENT_APP', pop2?.source);
  ok('patientInfo present', !!pop2?.patientInfo?.name, pop2?.patientInfo);

  hSocket.disconnect();
  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══\n`);

  await cleanup(emails);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('FATAL', e); process.exit(1); });