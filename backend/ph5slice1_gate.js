// Phase 5 Slice 1 verification: patient tracking + auto-share against CURRENT disk code.
// Boots the real app on 5577, seeds patient(with ACTIVE health pack) + 1 hospital,
// SOS -> accept -> verify: status/attempts payloads (tracking inputs) and auto-share row.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");
const BASE = "http://localhost:5577";
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
  await new Promise((r) => server.listen(5577, r));
  const ts = Date.now();
  const emails = ["p5p" + ts + "@t.com", "p5h" + ts + "@t.com"];
  const ph = await bcrypt.hash("password123", 10);
  const pU = await prisma.user.create({
    data: { name: "P5 Patient", email: emails[0], password: ph, role: "PATIENT",
      patient: { create: { name: "P5 Patient", age: 40, gender: "F", phone: "9898000041" } } },
    include: { patient: true },
  });
  const hU = await prisma.user.create({
    data: { name: "P5 Hospital", email: emails[1], password: ph, role: "HOSPITAL",
      hospital: { create: { name: "P5 Hospital", address: "P5 Road, Ahmedabad, Gujarat 380001", phone: "9898000042",
        city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
        hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: 23.0225, longitude: 72.5714 } } } },
    include: { hospital: true },
  });
  await require("./src/services/health-pack.service").createHealthPack(pU.patient.id, {
    bloodType: "O+", allergies: [], medicalHistory: [], emergencyContacts: [],
  });
  const pL = await api("POST", "/auth/login", null, { email: emails[0], password: "password123" });
  const hL = await api("POST", "/auth/login", null, { email: emails[1], password: "password123" });
  const sos = await api("POST", "/emergency/sos", pL.json.token, {
    symptoms: "Slice1 verify", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "p5s1-" + ts,
  });
  const cid = sos.json.publicCaseId;
  const st = await api("GET", "/emergency/status/" + cid, pL.json.token);
  const at = await api("GET", "/emergency/attempts/" + cid, pL.json.token);
  const acc = await api("POST", "/emergency/accept/" + cid, hL.json.token);
  const st2 = await api("GET", "/emergency/status/" + cid, pL.json.token);
  const shares = await prisma.healthPackShare.findMany({ where: { sharedWithHospitalId: hU.hospital.id } });
  console.log("P5_SOS=" + (sos.status === 201 ? "PASS" : "FAIL") + " HTTP=" + sos.status);
  console.log("P5_STATUS_BEFORE=" + (st.status === 200 && st.json.case?.caseId === cid && st.json.case?.status === "PENDING" ? "PASS" : "FAIL") + " HTTP=" + st.status);
  console.log("P5_ATTEMPTS=" + (at.status === 200 && at.json.attempts?.length >= 1 && at.json.attempts.every(a => !!a.hospital?.name) ? "PASS" : "FAIL") + " count=" + at.json.attempts?.length);
  console.log("P5_ACCEPT=" + (acc.status === 200 ? "PASS" : "FAIL") + " HTTP=" + acc.status);
  console.log("P5_STATUS_AFTER_ASSIGNED=" + (st2.status === 200 && st2.json.case?.hospital?.name === "P5 Hospital" && st2.json.case?.stage === "Transfer" ? "PASS" : "FAIL") + " stage=" + st2.json.case?.stage + " hosp=" + st2.json.case?.hospital?.name);
  console.log("P5_HEALTHPACK_AUTOSHARE=" + (shares.length >= 1 ? "PASS" : "FAIL") + " count=" + shares.length);
  // cleanup
  const byu = await prisma.patient.findMany({ where: { userId: pU.id }, select: { id: true } });
  const byh = await prisma.hospital.findMany({ where: { userId: hU.id }, select: { id: true } });
  const pids = byu.map(x => x.id); const hids = byh.map(x => x.id);
  const cases = await prisma.emergencyCase.findMany({ where: { OR: [{ patientId: { in: pids } }, { hospitalId: { in: hids } }] }, select: { id: true } });
  const cids = cases.map(c => c.id);
  if (cids.length) { await prisma.hospitalRequest.deleteMany({ where: { emergencyCaseId: { in: cids } } }); await prisma.emergencyCase.deleteMany({ where: { id: { in: cids } } }); }
  if (hids.length) { await prisma.hospitalRequest.deleteMany({ where: { hospitalId: { in: hids } } }); await prisma.healthPackShare.deleteMany({ where: { sharedWithHospitalId: { in: hids } } }); await prisma.hospital.deleteMany({ where: { id: { in: hids } } }); }
  if (pids.length) { await prisma.healthPack.deleteMany({ where: { patientId: { in: pids } } }); await prisma.healthPackShare.deleteMany({ where: { healthPack: { patientId: { in: pids } } } }); await prisma.patient.deleteMany({ where: { userId: pU.id } }); }
  await prisma.user.deleteMany({ where: { id: { in: [pU.id, hU.id] } } });
  server.close();
}
main().catch((e) => { console.log("P5_ERR=" + String((e && e.message) || e)); process.exitCode = 1; }).finally(() => prisma.$disconnect());