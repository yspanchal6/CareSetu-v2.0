// Phase 5 Slice 5 gate — Offline queue sync idempotency contract (A–J).
// Boots the real app on 5574 with the real DB (real Prisma) and real Socket.IO,
// then verifies that replaying a queued SOS with the SAME idempotencyKey:
//   - is acknowledged (201) and returns the SAME caseId + publicCaseId,
//   - creates EXACTLY ONE EmergencyCase,
//   - creates NO duplicate HospitalRequests,
//   - emits the hospital 'emergency:new-case' socket event exactly ONCE,
//   - persists exactly ONE hospital notification,
// and that the normal (fresh-key / no-key) SOS path still works.
// Prints PASS/FAIL only. Does NOT exercise IndexedDB or the service worker —
// those are browser-only concerns verified manually.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");
const { io } = require("../frontend/node_modules/socket.io-client");

const PORT = 5574;
const BASE = "http://localhost:" + PORT;
let server;
const madeUserIds = [];

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed += 1; console.log("  PASS " + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); }
  else { failed += 1; console.log("  FAIL " + name + (extra !== undefined ? " " + JSON.stringify(extra) : "")); }
}

async function api(method, path, token, body) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(BASE + "/api" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { transports: ["websocket"], auth: { token }, reconnection: false });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("socket connect timeout")), 8000);
  });
}

async function mkUser(name, email, ph, role, extra) {
  const u = await prisma.user.create({
    data: { name, email, password: ph, role, ...(role === "PATIENT"
      ? { patient: { create: { name, age: 35, gender: "M", phone: "9898000080" } } }
      : { hospital: { create: extra } }) },
    include: { patient: true, hospital: true },
  });
  madeUserIds.push(u.id);
  return u;
}

// Remove rows for a list of user ids (patients/hospitals/cases cascade-safe order).
async function deleteUserGraph(ids) {
  for (const uid of ids) {
    const pats = await prisma.patient.findMany({ where: { userId: uid }, select: { id: true } });
    const hos = await prisma.hospital.findMany({ where: { userId: uid }, select: { id: true } });
    const pids = pats.map(x => x.id), hids = hos.map(x => x.id);
    const cases = await prisma.emergencyCase.findMany({ where: { OR: [{ patientId: { in: pids } }, { hospitalId: { in: hids } }] }, select: { id: true } });
    const cids = cases.map(c => c.id);
    if (cids.length) { await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: cids } } }); await prisma.emergencyCase.deleteMany({ where: { id: { in: cids } } }); }
    if (hids.length) { await prisma.hospitalRequest.deleteMany({ where: { hospitalId: { in: hids } } }); await prisma.healthPackShare.deleteMany({ where: { sharedWithHospitalId: { in: hids } } }); await prisma.hospital.deleteMany({ where: { id: { in: hids } } }); }
    if (pids.length) { await prisma.healthPackShare.deleteMany({ where: { healthPack: { patientId: { in: pids } } } }); await prisma.healthPack.deleteMany({ where: { patientId: { in: pids } } }); await prisma.patient.deleteMany({ where: { userId: uid } }); }
    await prisma.notification.deleteMany({ where: { userId: uid } });
    await prisma.user.deleteMany({ where: { id: uid } });
  }
}

async function main() {
  server = http.createServer(app);
  initSocket(server);
  await new Promise((r) => server.listen(PORT, r));

  // Purge stale S5 test data from previous runs before seeding.
  const stale = await prisma.user.findMany({ where: { email: { startsWith: "s5", endsWith: "@t.com" } }, select: { id: true } });
  if (stale.length) await deleteUserGraph(stale.map(u => u.id));

  const ts = Date.now();
  const ph = await bcrypt.hash("password123", 10);

  const p1 = await mkUser("S5 Patient", "s5p_" + ts + "@t.com", ph, "PATIENT");
  const hA = await mkUser("S5 Hosp A", "s5h_" + ts + "@t.com", ph, "HOSPITAL", {
    name: "S5 Hospital A", address: "S5 Road, Ahmedabad, Gujarat 380001", phone: "9898000081",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 },
  });

  const pL = await api("POST", "/auth/login", null, { email: "s5p_" + ts + "@t.com", password: "password123" });
  const hL = await api("POST", "/auth/login", null, { email: "s5h_" + ts + "@t.com", password: "password123" });

  // Realtime listeners registered BEFORE the first SOS. Count raw events per
  // case id; final assertions resolve at the end (nothing is dropped that
  // arrived before we learned the case id).
  const hospSocket = await connectSocket(hL.json.token);
  await sleep(400); // let async hospital room joins settle
  const hospEvents = new Map(); // publicCaseId -> count
  hospSocket.on("emergency:new-case", (d) => {
    if (d && d.publicCaseId) hospEvents.set(d.publicCaseId, (hospEvents.get(d.publicCaseId) || 0) + 1);
  });
  const patientCreated = new Map(); // caseId -> count
  const patSocket = await connectSocket(pL.json.token);
  patSocket.on("emergency:created", (d) => {
    if (d && d.caseId) patientCreated.set(d.caseId, (patientCreated.get(d.caseId) || 0) + 1);
  });

  const fixedKey = "s5-idem-" + ts;
  const body = () => ({ symptoms: "S5 offline replay contract", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: fixedKey });
  let fixedPublic = null;
  let fixedInternal = null;

  // ---- A: first send with a fixed key creates the case ----
  const a = await api("POST", "/emergency/sos", pL.json.token, body());
  ok("A_IDEM_FIXED_KEY_CREATES", a.status === 201 && !!a.json.caseId && !!a.json.publicCaseId, { http: a.status, publicCaseId: a.json.publicCaseId });
  fixedInternal = a.json.caseId;
  fixedPublic = a.json.publicCaseId;

  await sleep(300); // allow any follow-up emits to land

  // ---- B: replay with the SAME key returns the SAME case ----
  const b = await api("POST", "/emergency/sos", pL.json.token, body());
  ok("B_IDEM_REPLAY_SAME_CASE", b.status === 201 && b.json.caseId === fixedInternal && b.json.publicCaseId === fixedPublic, { http: b.status, sameId: b.json.caseId === fixedInternal && b.json.publicCaseId === fixedPublic });

  // ---- C: exactly one EmergencyCase row for that idempotency key ----
  const cCount = await prisma.emergencyCase.count({ where: { idempotencyKey: fixedKey } });
  ok("C_IDEM_EXACTLY_ONE_CASE", cCount === 1, { count: cCount });

  // ---- D: replay created NO duplicate HospitalRequests ----
  const reqs = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: fixedInternal } });
  const distinctPairs = new Set(reqs.map(r => r.emergencyCaseId + ":" + r.hospitalId));
  ok("D_NO_DUPLICATE_HOSPITAL_REQUESTS", reqs.length >= 1 && reqs.length === distinctPairs.size && reqs.length === new Set(reqs.map(r => r.hospitalId)).size, { rows: reqs.length, distinctHospitals: new Set(reqs.map(r => r.hospitalId)).size });

  // ---- E: hospital pending queue shows the case exactly once ----
  const pend = await api("GET", "/emergency/pending", hL.json.token);
  const pendHits = (pend.json.cases || []).filter(x => x.caseId === fixedPublic || x.id === fixedInternal).length;
  ok("E_PENDING_QUEUE_ONCE", pend.status === 200 && pendHits === 1, { hits: pendHits, http: pend.status });

  // ---- G: fresh key (new emergency) still works — different case ----
  const g = await api("POST", "/emergency/sos", pL.json.token, { symptoms: "S5 fresh flow", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "s5-fresh-" + ts });
  const gCount = await prisma.emergencyCase.count({ where: { idempotencyKey: "s5-fresh-" + ts } });
  ok("G_FRESH_KEY_NEW_CASE", g.status === 201 && g.json.caseId !== fixedInternal && gCount === 1, { http: g.status, different: g.json.caseId !== fixedInternal, count: gCount });
  const gsId = g.json.publicCaseId;

  // The SOS path carries a pre-existing rate limiter (3 per 60s per user,
  // incl. replays) from Phase 4. A -> B -> G already consumed this window's
  // budget, so let it roll over before the remaining calls.
  console.log("[S5] waiting 61s for the SOS rate-limit window to roll over...");
  await sleep(61000);

  // ---- H: no idempotency key (direct online path) still works ----
  const hRes = await api("POST", "/emergency/sos", pL.json.token, { symptoms: "S5 no key", emergencyType: "MEDICAL", latitude: 23.0225, longitude: 72.5714 });
  ok("H_NO_KEY_STILL_WORKS", hRes.status === 201 && !!hRes.json.caseId, { http: hRes.status, publicCaseId: hRes.json.publicCaseId });

  // ---- I: a third replay is still stable (same case, still exactly one everywhere) ----
  const i = await api("POST", "/emergency/sos", pL.json.token, body());
  const iCount = await prisma.emergencyCase.count({ where: { idempotencyKey: fixedKey } });
  const iReqs = await prisma.hospitalRequest.count({ where: { emergencyCaseId: fixedInternal } });
  await sleep(300);
  ok("I_TRIPLE_REPLAY_STABLE", i.status === 201 && i.json.caseId === fixedInternal && i.json.publicCaseId === fixedPublic && iCount === 1, { http: i.status, sameId: i.json.caseId === fixedInternal, count: iCount });
  ok("I2_NO_DUPLICATE_REQUESTS_AFTER_REPLAYS", iReqs === distinctPairs.size, { requests: iReqs });

  // ---- F: realtime events for the fixed-key case never increase on replay ----
  // The stack delivers 'emergency:new-case' to a hospital socket via two rooms
  // (hospital:{id} AND {id}), so ONE original create -> the baseline below.
  // A replay must add ZERO deliveries. Compare with the fresh-key case (G):
  // both cases had exactly one original create on the same connected socket.
  const fBase = hospEvents.get(gsId) || 0;
  const fCount = hospEvents.get(fixedPublic) || 0;
  ok("F_HOSPITAL_SOCKET_NO_REPLAY_EMIT", fBase >= 1 && fCount === fBase, { baselinePerCreate: fBase, fixedCaseDeliveries: fCount });
  ok("F2_PATIENT_SOCKET_ONCE", (patientCreated.get(fixedPublic) || 0) === 1, { events: patientCreated.get(fixedPublic) || 0 });

  // ---- J: exactly one persisted hospital notification for the case ----
  const notifs = await prisma.notification.findMany({ where: { userId: hA.id, type: "HOSPITAL_REQUEST" } });
  const matchNotifs = notifs.filter(n => (n.data && n.data.emergencyCaseId === fixedInternal) || (n.message && String(n.message).includes(fixedPublic)));
  ok("J_NOTIFICATION_ONCE", matchNotifs.length === 1, { notifications: matchNotifs.length });

  hospSocket.disconnect();
  patSocket.disconnect();

  console.log("S5_GATE_RESULT=" + passed + "_PASSED_" + failed + "_FAILED");

  await deleteUserGraph(madeUserIds);
  server.close();
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.log("S5_ERR=" + String((e && e.message) || e));
    try { server.close(); } catch (err) {}
    prisma.$disconnect().finally(() => process.exit(1));
  });