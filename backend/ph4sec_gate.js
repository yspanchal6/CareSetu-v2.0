// PH4 SECURITY behavioral gate — real app, real API, two hospitals, one patient.
// Prints ONLY status codes + PASS/FAIL. No tokens, no patient data, no DB reset.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");
let BASE = "http://localhost:5556";
async function api(method, path, token, body) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(BASE + "/api" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
}
async function main() {
  const server = http.createServer(app);
  initSocket(server);
  await new Promise((r) => server.listen(5556, r));
  const ts = Date.now();
  const emails = ["ph4_patient" + ts + "@t.com", "ph4_hosa" + ts + "@t.com", "ph4_hosb" + ts + "@t.com"];
  const ph = await bcrypt.hash("password123", 10);
  const makeUser = (name, email, role, hosp) => prisma.user.create({
    data: { name, email, password: ph, role, ...(role === "PATIENT" ? { patient: { create: { name, age: 38, gender: "M", phone: "9898000095" } } }
        : { hospital: { create: hosp } }) },
    include: { patient: true, hospital: true },
  });
  const pUser = await makeUser("PH4 Patient", emails[0], "PATIENT");
  const hA = await makeUser("PH4 Hosp A", emails[1], "HOSPITAL", {
    name: "PH4 Hospital A", address: "A Road, Ahmedabad, Gujarat 380001", phone: "9898000096",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 },
  });
  const hB = await makeUser("PH4 Hosp B", emails[2], "HOSPITAL", {
    name: "PH4 Hospital B", address: "B Road, Ahmedabad, Gujarat 380001", phone: "9898000097",
    city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
    hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 },
  });
  const pL = await api("POST", "/auth/login", null, { email: emails[0], password: "password123" });
  const aL = await api("POST", "/auth/login", null, { email: emails[1], password: "password123" });
  const bL = await api("POST", "/auth/login", null, { email: emails[2], password: "password123" });
  const sos = await api("POST", "/emergency/sos", pL.json.token, {
    symptoms: "Security gate test", emergencyType: "CARDIAC",
    latitude: 23.0225, longitude: 72.5714, idempotencyKey: "ph4sec-" + ts,
  });
  const cid = sos.json.publicCaseId;
  // Hospital B accepts first (becomes assigned owner)
  const bAcc = await api("POST", "/emergency/accept/" + cid, bL.json.token);
  // TEST 1: Hospital A cross-ACCEPTS the case now owned by B
  const t1 = await api("POST", "/emergency/accept/" + cid, aL.json.token);
  // TEST 2: Hospital A cross-REJECTS the case owned by B
  const t2 = await api("POST", "/emergency/reject/" + cid, aL.json.token);
  // TEST 3: Hospital A attempts protected-case isolation (status/attempts of B-owned case)
  const t3 = await api("GET", "/emergency/status/" + cid, aL.json.token);
  // TEST 3-self: Hospital B (assigned owner) reads its own case — MUST remain allowed
  const t3self = await api("GET", "/emergency/status/" + cid, bL.json.token);
  // TEST 2b: attempts isolation — non-owner denied, owner allowed
  const t2bA = await api("GET", "/emergency/attempts/" + cid, aL.json.token);
  const t2bB = await api("GET", "/emergency/attempts/" + cid, bL.json.token);
  // TEST 5: stale mutation — B closes, then A tries accept/reject
  await api("PUT", "/emergency/update-status/" + cid, bL.json.token, { status: "CLOSED" });
  const t5a = await api("POST", "/emergency/accept/" + cid, aL.json.token);
  const t5b = await api("POST", "/emergency/reject/" + cid, aL.json.token);
  // TEST 4: single-owner race on a NEW pending case
  const sos2 = await api("POST", "/emergency/sos", pL.json.token, {
    symptoms: "Race gate test", emergencyType: "CARDIAC",
    latitude: 23.0225, longitude: 72.5714, idempotencyKey: "ph4sec-race-" + ts,
  });
  const cid2 = sos2.json.publicCaseId;
  const rA = await api("POST", "/emergency/accept/" + cid2, aL.json.token);
  const rB = await api("POST", "/emergency/accept/" + cid2, bL.json.token);
  const winners = [rA.status, rB.status].filter((s) => s === 200).length;
  const t4 = winners === 1 ? "PASS" : (winners === 0 ? "BLOCKED-no-winner" : "FAIL-multi-winner");

  console.log("PH4SEC_1_CROSS_ACCEPT=" + (t1.status === 200 ? "FAIL" : "PASS") + " HTTP=" + t1.status);
  console.log("PH4SEC_2_CROSS_REJECT=" + (t2.status === 200 ? "FAIL" : "PASS") + " HTTP=" + t2.status);
  console.log("PH4SEC_3_ISOLATION=" + (t3.status === 200 ? "FAIL" : "PASS") + " HTTP=" + t3.status + " SELF_OK=" + (t3self.status === 200 ? "PASS" : "FAIL"));
  console.log("PH4SEC_2B_ATTEMPTS_ISOLATION=" + (t2bA.status === 200 ? "FAIL" : "PASS") + " HTTP(A)=" + t2bA.status + " SELF_OK(B)=" + (t2bB.status === 200 ? "PASS" : "FAIL"));
  console.log("PH4SEC_4_RACE=" + t4);
  console.log("PH4SEC_5_STALE=" + ((t5a.status === 200 || t5b.status === 200) ? "FAIL" : "PASS") + " HTTP(a/b)=" + t5a.status + "/" + t5b.status);

  // cleanup (mirror of harness pattern)
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  for (const u of users) {
    const pats = await prisma.patient.findMany({ where: { userId: u.id }, select: { id: true } });
    const hos = await prisma.hospital.findMany({ where: { userId: u.id }, select: { id: true } });
    const patIds = pats.map((p) => p.id); const hosIds = hos.map((h) => h.id);
    const cases = await prisma.emergencyCase.findMany({ where: { OR: [{ patientId: { in: patIds } }, { hospitalId: { in: hosIds } }] }, select: { id: true } });
    const caseIds = cases.map((c) => c.id);
    if (caseIds.length) await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: caseIds } } });
    if (caseIds.length) await prisma.emergencyCase.deleteMany({ where: { id: { in: caseIds } } });
    if (hosIds.length) await prisma.healthPackShare.deleteMany({ where: { sharedWithHospitalId: { in: hosIds } } });
    if (patIds.length) await prisma.healthPackShare.deleteMany({ where: { healthPack: { patientId: { in: patIds } } } });
    if (patIds.length) await prisma.healthPack.deleteMany({ where: { patientId: { in: patIds } } });
    if (patIds.length) await prisma.patient.deleteMany({ where: { userId: u.id } });
    if (hosIds.length) await prisma.hospital.deleteMany({ where: { userId: u.id } });
    await prisma.user.deleteMany({ where: { id: u.id } });
  }
  server.close();
  process.exit(0);
}
main().catch(async (e) => { console.log("PH4SEC_BOOT_ERR=" + String((e && e.message) || e)); process.exit(1); });