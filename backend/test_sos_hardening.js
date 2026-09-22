/**
 * CareSetu SOS hardening verification:
 *  1. No-symptom SOS accepted → backend stores "Not provided".
 *  2. Dedicated SOS rate limiter → 4th rapid SOS in the same minute is 429.
 *  3. Too-fast ignores; abuse detection flags repeated SOS in AuditLog (non-blocking).
 */
const prisma = require('./src/config/prisma');
const bcrypt = require('bcrypt');

const BASE = 'http://localhost:3000/api';
const LAT = 23.0225;
const LNG = 72.5714;
const EMAILS = ['harden_patient@test.com'];

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

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { in: EMAILS } } });
  const patientIds = users.map(u => u.id);
  const patients = patientIds.length ? await prisma.patient.findMany({ where: { userId: { in: patientIds } } }) : [];
  const patientPk = patients.map(p => p.id);
  const cases = patientPk.length ? await prisma.emergencyCase.findMany({ where: { patientId: { in: patientPk } }, select: { id: true } }) : [];
  const caseIds = cases.map(c => c.id);
  if (caseIds.length) await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: caseIds } } });
  if (caseIds.length) await prisma.emergencyCase.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: patientIds } } });
  if (patientPk.length) await prisma.patient.deleteMany({ where: { id: { in: patientPk } } });
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
}

async function main() {
  await cleanup();
  const passHash = await bcrypt.hash('password123', 10);
  const pUser = await prisma.user.create({
    data: {
      name: 'Harden Patient', email: EMAILS[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'Harden Patient', age: 30, gender: 'F', phone: '9898000031' } },
    },
    include: { patient: true },
  });

  console.log('\n═══ LOGIN ═══\n');
  const login = await api('POST', '/auth/login', null, { email: EMAILS[0], password: 'password123' });
  ok('Patient login', login.status === 200 && !!login.json.token, login.json);
  if (!login.json.token) { process.exitCode = 1; return; }
  const token = login.json.token;

  console.log('\n═══ 1. NO-SYMPTOM SOS (Direct SOS, §8) ═══\n');
  const noSym = await api('POST', '/emergency/sos', token, {
    latitude: LAT, longitude: LNG, idempotencyKey: 'harden-nosym-' + Date.now(),
  });
  ok('POST /sos without symptoms → 201', noSym.status === 201, noSym.json);
  ok('EmergencyCase created', !!noSym.json.caseId, noSym.json);
  ok('Backend defaults symptoms to "Not provided"', (noSym.json.emergencyCase?.symptoms ?? '') === 'Not provided', noSym.json.emergencyCase?.symptoms);

  console.log('\n═══ 2. RATE LIMIT (dedicated SOS limiter, §51) ═══\n');
  // No-symptom SOS above consumed 1 of this user's 3-per-minute quota,
  // so the next 4 rapid requests should be [201, 201, 429, 429].
  const statuses = [];
  statuses.push((await api('POST', '/emergency/sos', token, { latitude: LAT, longitude: LNG, idempotencyKey: 'harden-rl-1' })).status);
  statuses.push((await api('POST', '/emergency/sos', token, { latitude: LAT, longitude: LNG, idempotencyKey: 'harden-rl-2' })).status);
  statuses.push((await api('POST', '/emergency/sos', token, { latitude: LAT, longitude: LNG, idempotencyKey: 'harden-rl-3' })).status);
  const fourth = await api('POST', '/emergency/sos', token, { latitude: LAT, longitude: LNG, idempotencyKey: 'harden-rl-4' });
  statuses.push(fourth.status);
  ok('Rapid SOS accepted while quota remains (201, 201)', statuses[0] === 201 && statuses[1] === 201, statuses.slice(0, 2));
  ok('3rd rapid SOS rejected with 429', statuses[2] === 429, { status: statuses[2] });
  ok('4th rapid SOS rejected with 429', statuses[3] === 429, { status: statuses[3], body: fourth.json });

  console.log('\n═══ 3. ABUSE DETECTION (non-blocking flag, §52) ═══\n');
  // Let the fire-and-forget audit write land.
  await new Promise(r => setTimeout(r, 800));
  const flags = await prisma.auditLog.findMany({
    where: { userId: pUser.id, details: { path: ['abuseFlag'], equals: true } },
    select: { action: true, details: true },
  });
  ok('AuditLog contains abuseFlag entry for repeated SOS', flags.length >= 1, flags);
  ok('Flag reason = REPEATED_SOS', flags.some(f => f.details?.reason === 'REPEATED_SOS'), flags);

  console.log('\n═══ 4. FRESH PATIENT IS NOT FLAGGED ═══\n');
  const freshEmails = ['harden_fresh@test.com'];
  // Remove any leftover fresh user from a prior crashed run.
  const leftoverFreshUsers = await prisma.user.findMany({ where: { email: { in: freshEmails } } });
  for (const lu of leftoverFreshUsers) {
    const lPatients = await prisma.patient.findMany({ where: { userId: lu.id } });
    const lPIds = lPatients.map(p => p.id);
    const lCases = lPIds.length ? await prisma.emergencyCase.findMany({ where: { patientId: { in: lPIds } }, select: { id: true } }) : [];
    const lCIds = lCases.map(c => c.id);
    if (lCIds.length) await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: lCIds } } });
    if (lCIds.length) await prisma.emergencyCase.deleteMany({ where: { id: { in: lCIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: lu.id } });
    await prisma.patient.deleteMany({ where: { userId: lu.id } });
    await prisma.user.deleteMany({ where: { id: lu.id } });
  }
  const freshUser = await prisma.user.create({
    data: {
      name: 'Fresh Patient', email: freshEmails[0], password: passHash, role: 'PATIENT',
      patient: { create: { name: 'Fresh Patient', age: 25, gender: 'M', phone: '9898000032' } },
    },
  });
  const fLogin = await api('POST', '/auth/login', null, { email: freshEmails[0], password: 'password123' });
  const fToken = fLogin.json.token;
  const fSos = await api('POST', '/emergency/sos', fToken, { latitude: LAT, longitude: LNG, idempotencyKey: 'harden-fresh-' + Date.now() });
  ok('Fresh patient single SOS accepted', fSos.status === 201, fSos.json);
  await new Promise(r => setTimeout(r, 500));
  const fFlags = await prisma.auditLog.findMany({ where: { userId: freshUser.id, details: { path: ['abuseFlag'], equals: true } } });
  ok('Fresh patient NOT flagged after one SOS', fFlags.length === 0, fFlags);

  console.log(`\n═══ RESULT: ${passed} passed, ${failed} failed ═══\n`);
  const freshCases = (await prisma.emergencyCase.findMany({ where: { patient: { user: { email: { in: freshEmails } } } }, select: { id: true } })).map(c => c.id);
  if (freshCases.length) await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: freshCases } } });
  if (freshCases.length) await prisma.emergencyCase.deleteMany({ where: { id: { in: freshCases } } });
  await prisma.auditLog.deleteMany({ where: { userId: freshUser.id } });
  await prisma.patient.deleteMany({ where: { userId: freshUser.id } });
  await prisma.user.deleteMany({ where: { email: { in: freshEmails } } });
  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  process.exit(1);
});