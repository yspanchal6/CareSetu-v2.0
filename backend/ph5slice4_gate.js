// Phase 5 Slice 4 gate — Patient Cancel SOS.
// Boots the real app on 5572, real DB (real Prisma), real Socket.IO. Prints PASS/FAIL only.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");

const PORT = 5572;
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

  // Purge stale S4 test data from previous runs before seeding.
  const stale = await prisma.user.findMany({ where: { email: { startsWith: "s4", endsWith: "@t.com" } }, select: { id: true } });
  if (stale.length) await deleteUserGraph(stale.map(u => u.id));

  const ts = Date.now();
  const ph = await bcrypt.hash("password123", 10);

  const p1 = await mkUser("S4 Patient", "s4p_" + ts + "@t.com", ph, "PATIENT");
  const p2 = await mkUser("S4 Other", "s4o_" + ts + "@t.com", ph, "PATIENT");
  const hA = await mkUser("S4 Hosp A", "s4ha_" + ts + "@t.com", ph, "HOSPITAL", {
    name: "S4 Hospital A", address: "S4 Road, Ahmedabad, Gujarat 380001", phone: "9898000081",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 },
  });

  const p1L = await api("POST", "/auth/login", null, { email: "s4p_" + ts + "@t.com", password: "password123" });
  const p2L = await api("POST", "/auth/login", null, { email: "s4o_" + ts + "@t.com", password: "password123" });
  const hAL = await api("POST", "/auth/login", null, { email: "s4ha_" + ts + "@t.com", password: "password123" });

  // ---- Case C1: immediate cancel (happy path) ----
  const c1 = await api("POST", "/emergency/sos", p1L.json.token, {
    symptoms: "S4 cancel flow", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "s4-c1-" + ts,
  });
  ok("A_SOS_CREATED", c1.status === 201 && !!c1.json.publicCaseId && !!c1.json.caseId, { http: c1.status });
  const c1p = c1.json.publicCaseId;
  const c1i = c1.json.caseId;

  const stillSearchable = await api("GET", "/emergency/status/" + c1p, p1L.json.token);
  ok("A2_SEARCHABLE_BEFORE_CANCEL", stillSearchable.status === 200 && stillSearchable.json.case?.status !== "CANCELLED", { status: stillSearchable.json.case?.status });

  const c1Cancel = await api("PUT", "/emergency/cancel/" + c1p, p1L.json.token);
  ok("B_OWNER_CANCELS_WITHIN_WINDOW", c1Cancel.status === 200, { http: c1Cancel.status });

  const c1db = await prisma.emergencyCase.findUnique({ where: { id: c1i } });
  ok("C_DB_STATUS_CANCELLED", c1db && c1db.status === "CANCELLED", { status: c1db?.status });
  ok("D_CLOSEDAT_POPULATED", !!c1db?.closedAt, { closedAt: c1db?.closedAt });

  const pendingLeft = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: c1i, status: "PENDING" } });
  const cancelledReqs = await prisma.hospitalRequest.findMany({ where: { emergencyCaseId: c1i, status: "CANCELLED" } });
  const totalReqs = await prisma.hospitalRequest.count({ where: { emergencyCaseId: c1i } });
  ok("E_PENDING_REQUESTS_CANCELLED", pendingLeft.length === 0 && cancelledReqs.length === totalReqs && totalReqs > 0, { pending: pendingLeft.length, cancelled: cancelledReqs.length, total: totalReqs });

  const f = await api("POST", "/emergency/accept/" + c1p, hAL.json.token);
  ok("F_CANCELLED_CASE_CANNOT_BE_ACCEPTED", f.status === 409, { http: f.status });

  const k = await api("GET", "/emergency/pending", hAL.json.token);
  const inPending = (k.json.cases || []).some((x) => x.caseId === c1p || x.id === c1i);
  ok("K_NOT_IN_HOSPITAL_PENDING_QUEUE", !inPending, { http: k.status });

  const l = await api("GET", "/emergency/status/" + c1p, p1L.json.token);
  ok("L_OWNER_STATUS_CANCELLED", l.status === 200 && l.json.case?.status === "CANCELLED", { status: l.json.case?.status });

  const m = await prisma.auditLog.findFirst({ where: { entityId: c1i, action: "EMERGENCY_CLOSED" } });
  ok("M_EMERGENCY_CLOSED_AUDIT", !!m, { action: m?.action, entityId: m?.entityId });

  // ---- Case C2: window expired -> cancel rejected ----
  const c2 = await api("POST", "/emergency/sos", p1L.json.token, {
    symptoms: "S4 window expired", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "s4-c2-" + ts,
  });
  ok("G2_WINDOW_CASE_CREATED", c2.status === 201, { http: c2.status });
  console.log("[S4] waiting 61s for the cancellation window to expire...");
  await sleep(61000);
  const g = await api("PUT", "/emergency/cancel/" + c2.json.publicCaseId, p1L.json.token);
  ok("G_AFTER_60S_REJECTED", g.status === 400, { http: g.status, error: g.json?.error });

  // ---- Case C3: assigned/TRANSFER -> cancel rejected (status guard) ----
  const c3 = await api("POST", "/emergency/sos", p1L.json.token, {
    symptoms: "S4 assigned guard", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "s4-c3-" + ts,
  });
  ok("H2_ASSIGN_CASE_CREATED", c3.status === 201, { http: c3.status });
  const c3Acc = await api("POST", "/emergency/accept/" + c3.json.publicCaseId, hAL.json.token);
  ok("H3_ASSIGNED_TO_TRANSFER", c3Acc.status === 200, { http: c3Acc.status });
  const c3db = await prisma.emergencyCase.findUnique({ where: { id: c3.json.caseId } });
  ok("H4_TRANSFER_COMMITTED", c3db?.status === "TRANSFER", { status: c3db?.status });
  const h = await api("PUT", "/emergency/cancel/" + c3.json.publicCaseId, p1L.json.token);
  ok("H_ASSIGNED_CASE_CANNOT_BE_CANCELLED", h.status === 400, { http: h.status, error: h.json?.error });

  // ---- Isolation / role guards ----
  const i = await api("PUT", "/emergency/cancel/" + c1p, p2L.json.token);
  ok("I_OTHER_PATIENT_CANNOT_CANCEL", i.status === 404, { http: i.status });

  const j = await api("PUT", "/emergency/cancel/" + c1p, hAL.json.token);
  ok("J_HOSPITAL_ROLE_BLOCKED", j.status === 403, { http: j.status });

  console.log("S4_GATE_RESULT=" + passed + "_PASSED_" + failed + "_FAILED");

  await deleteUserGraph(madeUserIds);
  server.close();
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.log("S4_ERR=" + String((e && e.message) || e));
    try { server.close(); } catch (err) {}
    prisma.$disconnect().finally(() => process.exit(1));
  });