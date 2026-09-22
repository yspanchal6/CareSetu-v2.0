// Phase 5 Slice 3 gate — Hospital-driven Treatment -> Case Closure realtime flow.
// Boots the real app on 5573, real DB (real Prisma), real Socket.IO. Prints PASS/FAIL only.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");
const { io } = require("../frontend/node_modules/socket.io-client");

const PORT = 5573;
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

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ["websocket"], auth: { token }, reconnection: true, reconnectionDelay: 200, reconnectionAttempts: 5 });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("socket timeout")), 8000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mkUser(name, email, ph, role, extra) {
  const u = await prisma.user.create({
    data: { name, email, password: ph, role, ...(role === "PATIENT"
      ? { patient: { create: { name, age: 35, gender: "M", phone: "9898000070" } } }
      : { hospital: { create: extra } }) },
    include: { patient: true, hospital: true },
  });
  madeUserIds.push(u.id);
  return u;
}

async function main() {
  server = http.createServer(app);
  initSocket(server);
  await new Promise((r) => server.listen(PORT, r));
  const ts = Date.now();
  const ph = await bcrypt.hash("password123", 10);

  const p1 = await mkUser("S3 Patient", "s3p_" + ts + "@t.com", ph, "PATIENT");
  const p2 = await mkUser("S3 Other", "s3o_" + ts + "@t.com", ph, "PATIENT");
  const hA = await mkUser("S3 Hosp A", "s3ha_" + ts + "@t.com", ph, "HOSPITAL", {
    name: "S3 Hospital A", address: "S3A Road, Ahmedabad, Gujarat 380001", phone: "9898000071",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 },
  });
  const hB = await mkUser("S3 Hosp B", "s3hb_" + ts + "@t.com", ph, "HOSPITAL", {
    name: "S3 Hospital B", address: "S3B Road, Ahmedabad, Gujarat 380002", phone: "9898000072",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0310, longitude: 72.5800 },
  });

  const p1L = await api("POST", "/auth/login", null, { email: "s3p_" + ts + "@t.com", password: "password123" });
  const p2L = await api("POST", "/auth/login", null, { email: "s3o_" + ts + "@t.com", password: "password123" });
  const hAL = await api("POST", "/auth/login", null, { email: "s3ha_" + ts + "@t.com", password: "password123" });
  const hBL = await api("POST", "/auth/login", null, { email: "s3hb_" + ts + "@t.com", password: "password123" });

  // Patient socket: capture every relevant event + its status payload.
  const sock = await connectSocket(p1L.json.token);
  const counts = { "treatment:started": 0, "case:completed": 0, "transfer:started": 0 };
  const statusUpdated = {}; // status -> count
  sock.on("treatment:started", () => { counts["treatment:started"]++; });
  sock.on("case:completed", () => { counts["case:completed"]++; });
  sock.on("transfer:started", () => { counts["transfer:started"]++; });
  sock.on("emergency:status-updated", (p) => { const s = p && p.status ? p.status : "?"; statusUpdated[s] = (statusUpdated[s] || 0) + 1; });

  // A. Patient creates emergency
  const sos = await api("POST", "/emergency/sos", p1L.json.token, {
    symptoms: "Slice3 realtime", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "s3-" + ts,
  });
  const cid = sos.json.publicCaseId;
  const iid = sos.json.caseId;
  ok("A_SOS_CREATED", sos.status === 201 && !!cid, { http: sos.status });

  // Pre-assignment: hospital A can read the awaiting-assignment case
  const pendReqA = await prisma.hospitalRequest.findFirst({ where: { emergencyCaseId: iid, hospitalId: hA.hospital.id, status: "PENDING" } });
  const pendReqB = await prisma.hospitalRequest.findFirst({ where: { emergencyCaseId: iid, hospitalId: hB.hospital.id, status: "PENDING" } });
  ok("A1_BOTH_HOSPITALS_REQUESTED", !!pendReqA && !!pendReqB);

  // B. Hospital A accepts -> case assigned/TRANSFER
  const acc = await api("POST", "/emergency/accept/" + cid, hAL.json.token);
  ok("A2_HOSPITAL_ACCEPTS", acc.status === 200, { http: acc.status });

  // B. assigned case is visible/actionable to hospital A
  const listA = await api("GET", "/hospitals/cases", hAL.json.token);
  const inList = (listA.json.cases || []).some((x) => x.caseId === cid || x.id === iid);
  const stA = await api("GET", "/emergency/status/" + cid, hAL.json.token);
  ok("B_ASSIGNED_VISIBLE_TO_HOSPITAL", inList && stA.status === 200 && stA.json.case?.status === "TRANSFER", { inList, status: stA.json.case?.status });

  // D (post-accept). committed state
  const db1 = await prisma.emergencyCase.findUnique({ where: { id: iid } });
  ok("D_TRANSFER_COMMITTED", db1 && db1.status === "TRANSFER" && db1.hospitalId === hA.hospital.id, { status: db1?.status });

  await sleep(1200); // let accept-time realtime events flush

  // C. TRANSFER -> TREATMENT
  const tr = await api("PUT", "/emergency/update-status/" + cid, hAL.json.token, { status: "TREATMENT" });
  ok("C_TRANSFER_TO_TREATMENT_SUCCEEDS", tr.status === 200, { http: tr.status });

  // D2. DB status is TREATMENT
  const db2 = await prisma.emergencyCase.findUnique({ where: { id: iid } });
  ok("D_DB_STATUS_TREATMENT", db2 && db2.status === "TREATMENT", { status: db2?.status });

  await sleep(1200);

  // E/F. patient received treatment:started + emergency:status-updated exactly once
  ok("E_TREATMENT_STARTED_EXACTLY_ONCE", counts["treatment:started"] === 1, { treatmentStarted: counts["treatment:started"] });
  ok("F_STATUS_UPDATED_TREATMENT_EXACTLY_ONCE", (statusUpdated["TREATMENT"] || 0) === 1, { statusUpdated });

  // Active list also reflects TREATMENT (actionable -> Close Case)
  const stA2 = await api("GET", "/emergency/status/" + cid, hAL.json.token);
  ok("B2_ACTIVE_VISIBLE_AFTER_TREATMENT", stA2.status === 200 && stA2.json.case?.status === "TREATMENT", { status: stA2.json.case?.status });

  // G. TREATMENT -> CLOSED
  const cl = await api("PUT", "/emergency/update-status/" + cid, hAL.json.token, { status: "CLOSED" });
  ok("G_TREATMENT_TO_CLOSED_SUCCEEDS", cl.status === 200, { http: cl.status });

  // H. DB status is CLOSED
  const db3 = await prisma.emergencyCase.findUnique({ where: { id: iid } });
  ok("H_DB_STATUS_CLOSED", db3 && db3.status === "CLOSED" && !!db3.closedAt, { status: db3?.status });

  await sleep(1200);

  // I/J. patient received case:completed + emergency:status-updated once
  ok("I_CASE_COMPLETED_EXACTLY_ONCE", counts["case:completed"] === 1, { caseCompleted: counts["case:completed"] });
  ok("J_STATUS_UPDATED_CLOSED_EXACTLY_ONCE", (statusUpdated["CLOSED"] || 0) === 1, { statusUpdated });

  // K. Other hospital cannot access/action the assigned case
  const k1 = await api("GET", "/emergency/status/" + cid, hBL.json.token);
  const k2 = await api("PUT", "/emergency/update-status/" + cid, hBL.json.token, { status: "TREATMENT" });
  ok("K_OTHER_HOSPITAL_CANNOT_READ", k1.status !== 200, { http: k1.status });
  ok("K2_OTHER_HOSPITAL_CANNOT_ACTION", k2.status !== 200, { http: k2.status });

  // L. Patient isolation (patient B cannot access patient A's case)
  const l1 = await api("GET", "/emergency/status/" + cid, p2L.json.token);
  const l2 = await api("GET", "/emergency/status/" + cid, p1L.json.token);
  ok("L_PATIENT_ISOLATION_OTHER_BLOCKED", l1.status !== 200, { http: l1.status });
  ok("L2_OWNER_PATIENT_CAN_READ", l2.status === 200, { http: l2.status });

  // M. Illegal transition rejected (CLOSED is terminal)
  const m1 = await api("PUT", "/emergency/update-status/" + cid, hAL.json.token, { status: "TREATMENT" });
  const m2 = await api("PUT", "/emergency/update-status/" + cid, hAL.json.token, { status: "IN_PROGRESS" });
  ok("M_ILLEGAL_TRANSITION_REJECTED", m1.status === 400 && m2.status === 400, { closedToTreatment: m1.status, closedToInProgress: m2.status });

  // N. HealthPack share stays exactly one (accepting hospital only)
  const sharesA = await prisma.healthPackShare.findMany({ where: { sharedWithHospitalId: hA.hospital.id, healthPack: { patientId: p1.patient.id } } });
  const sharesB = await prisma.healthPackShare.findMany({ where: { sharedWithHospitalId: hB.hospital.id, healthPack: { patientId: p1.patient.id } } });
  ok("N_HEALTHPACK_SHARE_ONE", sharesA.length === 1 && sharesB.length === 0, { a: sharesA.length, b: sharesB.length });

  sock.close();
  console.log("S3_GATE_RESULT=" + passed + "_PASSED_" + failed + "_FAILED");

  // cleanup
  for (const uid of madeUserIds) {
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
  server.close();
}

main()
  .catch((e) => { console.log("S3_ERR=" + String((e && e.message) || e)); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());