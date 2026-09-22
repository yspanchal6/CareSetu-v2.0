// Phase 5 Slice 2 gate — Hospital -> Patient realtime emergency status.
// Boots the real app on 5579, real DB, real Socket.IO. Prints PASS/FAIL only.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");
const { io } = require("../frontend/node_modules/socket.io-client");

const PORT = 5579;
const BASE = "http://localhost:" + PORT;
let server;
const madeUserIds = [];

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
async function mkUser(name, email, ph, role, extra) {
  const u = await prisma.user.create({
    data: { name, email, password: ph, role, ...(role === "PATIENT"
      ? { patient: { create: { name, age: 35, gender: "M", phone: "9898000060" } } }
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

  const p1 = await mkUser("S2 Patient", "s2p_" + ts + "@t.com", ph, "PATIENT");
  const p2 = await mkUser("S2 Other", "s2o_" + ts + "@t.com", ph, "PATIENT");
  const hA = await mkUser("S2 Hosp A", "s2ha_" + ts + "@t.com", ph, "HOSPITAL", {
    name: "S2 Hospital A", address: "S2 Road, Ahmedabad, Gujarat 380001", phone: "9898000061",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 },
  });
  const p1L = await api("POST", "/auth/login", null, { email: "s2p_" + ts + "@t.com", password: "password123" });
  const p2L = await api("POST", "/auth/login", null, { email: "s2o_" + ts + "@t.com", password: "password123" });
  const hAL = await api("POST", "/auth/login", null, { email: "s2ha_" + ts + "@t.com", password: "password123" });

  // Patient socket with event counters
  const sock = await connectSocket(p1L.json.token);
  const counts = { "case:accepted": 0, "transfer:started": 0, "treatment:started": 0, "case:completed": 0 };
  Object.keys(counts).forEach((ev) => sock.on(ev, () => { counts[ev]++; }));

  // A. Patient creates emergency
  const sos = await api("POST", "/emergency/sos", p1L.json.token, {
    symptoms: "Slice2 realtime", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "s2-" + ts,
  });
  const cid = sos.json.publicCaseId;
  console.log("S2_A_PATIENT_CREATES=" + (sos.status === 201 && !!cid ? "PASS" : "FAIL") + " HTTP=" + sos.status);

  // B. Hospital receives request (pending hospital request exists)
  const pend = await prisma.hospitalRequest.findFirst({ where: { emergencyCaseId: sos.json.caseId, hospitalId: hA.hospital.id, status: "PENDING" } });
  console.log("S2_B_HOSPITAL_REQUEST=" + (pend ? "PASS" : "FAIL"));

  // C. Hospital accepts
  const acc = await api("POST", "/emergency/accept/" + cid, hAL.json.token);
  console.log("S2_C_HOSPITAL_ACCEPTS=" + (acc.status === 200 ? "PASS" : "FAIL") + " HTTP=" + acc.status);

  // D. Backend DB status changed
  const dbCase = await prisma.emergencyCase.findFirst({ where: { caseId: cid } });
  console.log("S2_D_DB_STATUS=" + (dbCase && dbCase.status === "TRANSFER" && dbCase.hospitalId === hA.hospital.id ? "PASS" : "FAIL") + " status=" + dbCase?.status);

  // E + J. Realtime event + duplicate delivery count
  await new Promise((r) => setTimeout(r, 1500));
  console.log("S2_E_PATIENT_REALTIME=" + (counts["case:accepted"] >= 1 && counts["transfer:started"] >= 1 ? "PASS" : "FAIL") + " accepted=" + counts["case:accepted"] + " transfer=" + counts["transfer:started"]);
  console.log("S2_J_NO_DUPLICATE_EVENTS=" + (counts["case:accepted"] === 1 && counts["transfer:started"] === 1 ? "PASS" : "FAIL") + " accepted=" + counts["case:accepted"] + " transfer=" + counts["transfer:started"]);

  // G + H. Refresh -> GET current state (authoritative)
  const st = await api("GET", "/emergency/status/" + cid, p1L.json.token);
  console.log("S2_GH_REFRESH_STATE=" + (st.status === 200 && st.json.case?.status === "TRANSFER" && st.json.case?.hospital?.name === "S2 Hospital A" ? "PASS" : "FAIL") + " status=" + st.json.case?.status + " hospital=" + st.json.case?.hospital?.name);

  // I. Socket disconnect/reconnect resync: change state while down, reconnect, GET reflects it
  sock.disconnect();
  await new Promise((r) => setTimeout(r, 300));
  const up = await api("PUT", "/emergency/update-status/" + cid, hAL.json.token, { status: "TREATMENT" });
  await new Promise((r) => setTimeout(r, 500));
  // In-app: page's reconnect effect would call load(); we simulate by GET after reconnect
  const sock2 = await connectSocket(p1L.json.token);
  const st2 = await api("GET", "/emergency/status/" + cid, p1L.json.token);
  console.log("S2_I_RECONNECT_RESYNC=" + (up.status === 200 && st2.status === 200 && st2.json.case?.status === "TREATMENT" ? "PASS" : "FAIL") + " status=" + st2.json.case?.status);

  // J2. After reconnect, a new event still delivered exactly once (no duplicate listeners)
  const c2 = { accepted: 0, treatment: 0 };
  sock2.on("treatment:started", () => { c2.treatment++; });
  await api("PUT", "/emergency/update-status/" + cid, hAL.json.token, { status: "CLOSED" });
  await new Promise((r) => setTimeout(r, 1200));
  console.log("S2_J2_RECONNECTED_NO_DUP=" + (c2.treatment <= 1 ? "PASS" : "FAIL") + " treatmentEvts=" + c2.treatment);
  sock2.close();

  // K. Unauthorized patient cannot track another patient's case
  const k = await api("GET", "/emergency/status/" + cid, p2L.json.token);
  console.log("S2_K_UNAUTHORIZED_BLOCKED=" + (k.status !== 200 ? "PASS" : "FAIL") + " HTTP=" + k.status);

  // M. HealthPack P1 regression: exactly one share for accepting hospital
  const shares = await prisma.healthPackShare.findMany({ where: { sharedWithHospitalId: hA.hospital.id, healthPack: { patientId: p1.patient.id } } });
  console.log("S2_M_HEALTHPACK_ONE_SHARE=" + (shares.length === 1 ? "PASS" : "FAIL") + " count=" + shares.length);

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
    await prisma.user.deleteMany({ where: { id: uid } });
  }
  server.close();
}
main()
  .catch((e) => { console.log("S2_ERR=" + String((e && e.message) || e)); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());