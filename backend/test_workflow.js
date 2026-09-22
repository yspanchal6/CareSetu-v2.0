/**
 * CareSetu Emergency SOS — full HTTP end-to-end workflow verification.
 *
 * Test 1: Normal acceptance (SOS → created → reject → next → accept → TRANSFER → TREATMENT → CLOSED)
 * Test 2: Rejection auto-cascade uses the SAME EmergencyCase.
 *
 * Uses real API endpoints + real PostgreSQL persistence. Seeds throwaway users
 * directly into the DB (reusing the seed password hash) to avoid SMS flows.
 */
const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');

const BASE = 'http://localhost:3000/api';
const PATIENT_LAT = 23.0225;
const PATIENT_LNG = 72.5714; // Ahmedabad

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed += 1; console.log(`  ✅ ${name}`); }
  else { failed += 1; console.log(`  ❌ ${name}${extra ? ' — ' + JSON.stringify(extra) : ''}`); }
}

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function cleanup(emails) {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  const patientIds = users.filter(u => u.role === 'PATIENT').map(u => u.id);
  const hospitalIds = users.filter(u => u.role === 'HOSPITAL').map(u => u.id);
  const patients = patientIds.length ? await prisma.patient.findMany({ where: { userId: { in: patientIds } } }) : [];
  const hospitals = hospitalIds.length ? await prisma.hospital.findMany({ where: { userId: { in: hospitalIds } } }) : [];
  const patientPk = patients.map(p => p.id);
  const hospitalPk = hospitals.map(h => h.id);
  const cases = await prisma.emergencyCase.findMany({
    where: { OR: [{ patientId: { in: patientPk } }, { hospitalId: { in: hospitalPk } }] },
    select: { id: true },
  });
  const caseIds = cases.map(c => c.id);
  if (caseIds.length) await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: caseIds } } });
  if (caseIds.length) await prisma.emergencyCase.deleteMany({ where: { id: { in: caseIds } } });
  const shares = patientPk.length ? await prisma.healthPackShare.findMany({ where: { healthPack: { patientId: { in: patientPk } } }, select: { id: true } }) : [];
  if (shares.length) await prisma.healthPackShare.deleteMany({ where: { id: { in: shares.map(s => s.id) } } });
  if (patientPk.length) await prisma.healthPack.deleteMany({ where: { patientId: { in: patientPk } } });
  if (patientPk.length) await prisma.patient.deleteMany({ where: { id: { in: patientPk } } });
  if (hospitalPk.length) await prisma.hospital.deleteMany({ where: { id: { in: hospitalPk } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

async function main() {
  const emails = [
    'wf_patient@test.com',
    'wf_hospital_a@test.com',
    'wf_hospital_b@test.com',
    'wf_hospital_c@test.com',
  ];
  await cleanup(emails);

  const passHash = await bcrypt.hash('password123', 10);

  console.log('\n═══ SEED E2E USERS ═══\n');
  // 3 CARDIAC-capable hospitals near Ahmedabad (progressively farther).
  const hopts = [
    { name: 'WF Hospital A', email: emails[1], lat: 23.0225, lng: 72.5715 },
    { name: 'WF Hospital B', email: emails[2], lat: 23.03, lng: 72.58 },
    { name: 'WF Hospital C', email: emails[3], lat: 23.05, lng: 72.60 },
  ];
  const hospitals = [];
  for (const h of hopts) {
    const user = await prisma.user.create({
      data: {
        name: h.name, email: h.email, password: passHash, role: 'HOSPITAL',
        hospital: {
          create: {
            name: h.name, address: 'Test Address, Ahmedabad, Gujarat 380001',
            phone: '9898000000', city: 'Ahmedabad', state: 'Gujarat',
            emergencyAvailable: true, hasEmergencyDepartment: true,
            hasCardiology: true, hasICU: true, hasTraumaUnit: true,
            capabilities: ['Emergency', 'Cardiac', 'ICU'],
            location: { latitude: h.lat, longitude: h.lng },
          },
        },
      },
      include: { hospital: true },
    });
    hospitals.push({ ...user.hospital, email: h.email });
  }

  const pUser = await prisma.user.create({
    data: {
      name: 'WF Patient', email: emails[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'WF Patient', age: 30, gender: 'M', phone: '9898000001' } },
    },
    include: { patient: true },
  });
  await require('./src/services/health-pack.service').createHealthPack(pUser.patient.id, {
    bloodType: 'O+',
    allergies: ['Penicillin'],
    medicalHistory: ['Hypertension'],
    emergencyContacts: [{ name: 'Jane', phone: '+919876543210', relation: 'Spouse' }],
  });

  console.log(`  Seeded ${hospitals.length} hospitals + 1 patient`);

  console.log('\n═══ LOGIN ═══\n');
  const patientLogin = await api('POST', '/auth/login', null, { email: emails[0], password: 'password123' });
  ok('Patient login', patientLogin.status === 200 && !!patientLogin.json.token, patientLogin.json);
  if (!patientLogin.json.token) { console.log('Aborting.'); process.exitCode = 1; return; }
  const patientToken = patientLogin.json.token;

  const hTokens = {};
  for (const h of hospitals) {
    const login = await api('POST', '/auth/login', null, { email: h.email, password: 'password123' });
    if (login.status !== 200 || !login.json.token) { throw new Error(`Hospital login failed for ${h.email}`); }
    hTokens[h.id] = login.json.token;
  }

  console.log('\n═══ TEST: SOS CREATION (ONE ACTION) ═══\n');
  const sos = await api('POST', '/emergency/sos', patientToken, {
    symptoms: 'Severe chest pain, left arm numbness',
    emergencyType: 'CARDIAC',
    latitude: PATIENT_LAT,
    longitude: PATIENT_LNG,
    idempotencyKey: 'wf-' + Date.now(),
  });
  ok('POST /sos → 201', sos.status === 201, sos.json);
  ok('Response has internal caseId', !!sos.json.caseId, sos.json);
  ok('Response has public caseId (CASE-…)', /^CASE-/.test(sos.json.publicCaseId || ''), sos.json);
  ok('Response has stage FindingHospital', (sos.json.emergencyCase?.stage ?? '') === 'FindingHospital', sos.json.emergencyCase);
  ok('Response has real created timestamp', !!sos.json.emergencyCase?.createdAt, sos.json.emergencyCase);
  ok('Response has severity', !!sos.json.emergencyCase?.severity);
  ok('Response has CARDIAC emergencyType (safety engine)', (sos.json.emergencyCase?.emergencyType ?? '') === 'CARDIAC');

  const caseDBId = sos.json.caseId;
  const publicCaseId = sos.json.publicCaseId;
  const hospitalsMatched = sos.json.nearestHospitals || [];
  ok(`Matched ${hospitalsMatched.length} hospital(s)`, hospitalsMatched.length >= 1, hospitalsMatched.map(h => ({ name: h.name, distanceKm: h.distanceKm })));
  console.log('  → matched order:', hospitalsMatched.map(h => `${h.name}@${h.distanceKm?.toFixed(1)}km`).join(', '));

  console.log('\n═══ TEST: STATUS + ATTEMPTS (source of truth) ═══\n');
  const st1 = await api('GET', `/emergency/status/${publicCaseId}`, patientToken);
  ok('GET status → 200', st1.status === 200, st1.json);
  ok('Status caseId matches created public caseId', st1.json.case?.caseId === publicCaseId, st1.json.case?.caseId);
  ok('Status stage = FindingHospital', (st1.json.case?.stage ?? '') === 'FindingHospital', st1.json.case?.stage);
  ok('Status embeds location', st1.json.case?.location?.latitude === PATIENT_LAT, st1.json.case?.location);
  ok('Status embeds attempts', Array.isArray(st1.json.case?.attempts));

  const att1 = await api('GET', `/emergency/attempts/${publicCaseId}`, patientToken);
  ok('GET attempts → 200', att1.status === 200, att1.json);
  const reqs = att1.json.attempts || [];
  ok(`HospitalRequests created (${reqs.length}) in DB`, reqs.length === hospitalsMatched.length, reqs.map(r => r.status));
  ok('Every attempt shows a real hospital name from DB', reqs.every(r => !!r.hospital?.name), reqs.map(r => r.hospital?.name));

  // Verify DB records match API
  const dbReqs = await prisma.hospitalRequest.findMany({
    where: { emergencyCaseId: caseDBId },
    include: { hospital: true },
    orderBy: { matchScore: 'asc' },
  });
  ok('HospitalRequest rows persisted with distanceKm/capabilityMatched/availabilityMatched/matchScore',
    dbReqs.every(r => r.status === 'PENDING' && r.distanceKm != null && r.capabilityMatched === true && r.availabilityMatched === true && r.matchScore != null),
    dbReqs);
  ok('DB HospitalRequest hospitalId = API hospital id',
    dbReqs.every(r => (hospitalsMatched.find(m => m.id === r.hospitalId))),
    dbReqs.map(r => r.hospitalId));

  console.log('\n═══ TEST 2: HOSPITAL A REJECTS → AUTO REROUTE (same case) ═══\n');
  const hA = dbReqs[0].hospital;
  const hAReqId = dbReqs[0].id;
  const rejectA = await api('POST', `/emergency/reject/${publicCaseId}`, hTokens[hA.id], { reason: 'No bed available' });
  ok('Hospital A reject → 200', rejectA.status === 200, rejectA.json);

  const dbReqA = await prisma.hospitalRequest.findUnique({ where: { id: hAReqId } });
  ok('HospitalRequest A marked REJECTED in DB with reason', dbReqA.status === 'REJECTED' && dbReqA.rejectionReason === 'No bed available', dbReqA);

  const st2 = await api('GET', `/emergency/status/${publicCaseId}`, patientToken);
  ok('Same EmergencyCase id after rejection (no new case)', st2.json.case?.id === caseDBId, { old: caseDBId, now: st2.json.case?.id });
  ok('Stage remains FindingHospital after rejection', (st2.json.case?.stage ?? '') === 'FindingHospital', st2.json.case?.stage);
  ok('Attempts now contain REJECTED for Hospital A', st2.json.case?.attempts?.some(a => a.hospital?.id === hA.id && a.status === 'REJECTED'), st2.json.case?.attempts);

  const dbReqB = await prisma.hospitalRequest.findFirst({
    where: { emergencyCaseId: caseDBId, status: 'PENDING' },
    orderBy: { matchScore: 'asc' },
    include: { hospital: true },
  });
  ok('PENDING request cascaded to next hospital B (not A)', !!dbReqB && dbReqB.hospitalId !== hA.id, dbReqB);
  console.log('  → cascaded to:', dbReqB?.hospital?.name);

  console.log('\n═══ TEST 1: HOSPITAL B ACCEPTS → TRANSFER AUTO-ACTIVATED ═══\n');
  const hB = dbReqB.hospital;
  const acceptB = await api('POST', `/emergency/accept/${publicCaseId}`, hTokens[hB.id]);
  ok('Hospital B accept → 200', acceptB.status === 200, acceptB.json);
  ok('Accept response status = TRANSFER', (acceptB.json.case?.status ?? '') === 'TRANSFER', acceptB.json.case);

  const dbCase = await prisma.emergencyCase.findUnique({
    where: { id: caseDBId },
    include: { hospital: true },
  });
  ok('DB EmergencyCase status = TRANSFER', dbCase.status === 'TRANSFER', dbCase.status);
  ok('DB EmergencyCase assigned hospital = B (matches HospitalRequest)', dbCase.hospitalId === hB.id, { assigned: dbCase.hospitalId, reqB: hB.id });
  ok('DB acceptedAt set', !!dbCase.acceptedAt, dbCase.acceptedAt);
  ok('Other request C marked REJECTED (cancelled)', (await prisma.hospitalRequest.findFirst({ where: { emergencyCaseId: caseDBId, hospitalId: { not: hB.id }, status: 'PENDING' } })) === null);

  const st3 = await api('GET', `/emergency/status/${publicCaseId}`, patientToken);
  ok('Patient status now shows Transfer + assigned hospital', (st3.json.case?.stage ?? '') === 'Transfer' && st3.json.case?.hospital?.id === hB.id, st3.json.case);

  const shares = await prisma.healthPackShare.findMany({
    where: { sharedWithHospitalId: hB.id, healthPack: { patientId: pUser.patient.id } },
  });
  ok('HealthPack auto-shared with accepting hospital (consent)', shares.length > 0 && shares[0].consentGranted, shares);

  console.log('\n═══ TEST: TRANSFER → TREATMENT → COMPLETED ═══\n');
  const t1 = await api('PUT', `/emergency/update-status/${publicCaseId}`, hTokens[hB.id], { status: 'TREATMENT' });
  ok('Update to TREATMENT → 200', t1.status === 200, t1.json);
  ok('Case TREATMENT in DB', (await prisma.emergencyCase.findUnique({ where: { id: caseDBId } })).status === 'TREATMENT');

  const st4 = await api('GET', `/emergency/status/${publicCaseId}`, patientToken);
  ok('Patient status stage = Treatment', (st4.json.case?.stage ?? '') === 'Treatment', st4.json.case?.stage);

  const t2 = await api('PUT', `/emergency/update-status/${publicCaseId}`, hTokens[hB.id], { status: 'CLOSED' });
  ok('Update to CLOSED → 200', t2.status === 200, t2.json);
  const finished = await prisma.emergencyCase.findUnique({ where: { id: caseDBId } });
  ok('DB status = CLOSED + closedAt set', finished.status === 'CLOSED' && !!finished.closedAt, finished);

  const st5 = await api('GET', `/emergency/status/${publicCaseId}`, patientToken);
  ok('Patient status stage = Completed', (st5.json.case?.stage ?? '') === 'Completed', st5.json.case?.stage);

  console.log('\n═══ TEST: TRANSITION GUARD ═══\n');
  const bad = await api('PUT', `/emergency/update-status/${publicCaseId}`, hTokens[hB.id], { status: 'TREATMENT' });
  ok('Cannot regress CLOSED → TREATMENT', bad.status === 400, bad.json);

  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══\n`);
  await cleanup(emails);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  process.exit(1);
});