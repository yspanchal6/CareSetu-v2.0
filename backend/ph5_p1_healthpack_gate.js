// P1 FIX verification — HealthPack auto-share on the ACTIVE accept route.
// Real app + real DB + real Socket.IO. Prints only PASS/FAIL results.
const prisma = require("./src/config/prisma");
const bcrypt = require("bcrypt");
const app = require("./src/app");
const { initSocket } = require("./src/utils/socket");
const http = require("http");
const { io } = require("../frontend/node_modules/socket.io-client");

const PORT = 5578;
const BASE = "http://localhost:" + PORT;
let server;

async function api(method, path, token, body) {
  const h = { "Content-Type": "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  const r = await fetch(BASE + "/api" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j };
}
function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, { transports: ["websocket"], auth: { token }, reconnection: false });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("socket timeout")), 8000);
  });
}

const madeUsers = [];
async function mkPatient(name, email, ph, withPack) {
  const u = await prisma.user.create({
    data: { name, email, password: ph, role: "PATIENT",
      patient: { create: { name, age: 35, gender: "M", phone: "9898000050" } } },
    include: { patient: true },
  });
  madeUsers.push(u.id);
  if (withPack) {
    await require("./src/services/health-pack.service").createHealthPack(u.patient.id, {
      bloodType: "AB+", allergies: [], medicalHistory: [], emergencyContacts: [],
    });
  }
  return u;
}
async function mkHospital(name, email, ph, lat, lng) {
  const u = await prisma.user.create({
    data: { name, email, password: ph, role: "HOSPITAL",
      hospital: { create: { name, address: name + " Road, Ahmedabad, Gujarat 380001", phone: "9898000051",
        city: "Ahmedabad", state: "Gujarat", emergencyAvailable: true, hasEmergencyDepartment: true,
        hasCardiology: true, hasICU: true, capabilities: ["Emergency", "Cardiac"], location: { latitude: lat, longitude: lng } } } },
    include: { hospital: true },
  });
  madeUsers.push(u.id);
  return u;
}
async function cleanup() {
  for (const uid of madeUsers) {
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
}

async function main() {
  server = http.createServer(app);
  initSocket(server);
  await new Promise((r) => server.listen(PORT, r));
  const ts = Date.now();
  const ph = await bcrypt.hash("password123", 10);

  // ---------- SCENARIO 1: patient with NO active HealthPack ----------
  const p1 = await mkPatient("P1 NoPack", "p1np_" + ts + "@t.com", ph, false);
  const hA = await mkHospital("P1 Hosp A", "p1ha_" + ts + "@t.com", ph, 23.0225, 72.5714);
  const hB = await mkHospital("P1 Hosp B", "p1hb_" + ts + "@t.com", ph, 23.0225, 72.5716);
  const p1L = await api("POST", "/auth/login", null, { email: "p1np_" + ts + "@t.com", password: "password123" });
  const hAL = await api("POST", "/auth/login", null, { email: "p1ha_" + ts + "@t.com", password: "password123" });
  const hBL = await api("POST", "/auth/login", null, { email: "p1hb_" + ts + "@t.com", password: "password123" });

  const sock1 = await connectSocket(p1L.json.token);
  const gotAccepted = new Promise((res) => sock1.once("case:accepted", (d) => res(d)));
  const gotTransfer = new Promise((res) => sock1.once("transfer:started", (d) => res(d)));

  const sos1 = await api("POST", "/emergency/sos", p1L.json.token, {
    symptoms: "P1 autoshare test", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "p1hp-" + ts,
  });
  const cid1 = sos1.json.publicCaseId;
  const acc1 = await api("POST", "/emergency/accept/" + cid1, hAL.json.token);
  const evAccepted = await gotAccepted;
  const evTransfer = await gotTransfer;

  const case1 = await prisma.emergencyCase.findFirst({ where: { caseId: cid1 } });
  const packs1 = await prisma.healthPack.findMany({ where: { patientId: p1.patient.id } });
  const activeP1 = packs1.filter(x => x.status === "ACTIVE");
  const shares1 = await prisma.healthPackShare.findMany({ where: { healthPack: { patientId: p1.patient.id } } });
  const shareForA = shares1.filter(s => s.sharedWithHospitalId === hA.hospital.id);

  console.log("P1_S1_CASE_ASSIGNED=" + (case1 && case1.hospitalId === hA.hospital.id && case1.status === "TRANSFER" ? "PASS" : "FAIL") + " status=" + case1?.status);
  console.log("P1_S1_PACK_ENSURED_ACTIVE=" + (activeP1.length === 1 ? "PASS" : "FAIL") + " totalPacks=" + packs1.length + " active=" + activeP1.length);
  console.log("P1_S1_EXACTLY_ONE_SHARE=" + (shares1.length === 1 ? "PASS" : "FAIL") + " count=" + shares1.length);
  console.log("P1_S1_SHARE_OWNER_LINKED=" + (shareForA.length === 1 && shareForA[0].sharedWithUserId === hA.id && shareForA[0].consentGranted === true && shareForA[0].status === "ACTIVE" && shareForA[0].healthPackId === activeP1[0]?.id ? "PASS" : "FAIL"));

  // Cross-hospital authorization regression (Phase-4 security intact)
  const crossAccept = await api("POST", "/emergency/accept/" + cid1, hBL.json.token);
  const crossRead = await api("GET", "/emergency/status/" + cid1, hBL.json.token);
  console.log("P1_S1_CROSS_ACCEPT_BLOCKED=" + (crossAccept.status !== 200 ? "PASS" : "FAIL") + " HTTP=" + crossAccept.status);
  console.log("P1_S1_CROSS_READ_BLOCKED=" + (crossRead.status !== 200 ? "PASS" : "FAIL") + " HTTP=" + crossRead.status);

  // Retry idempotency: repeat accept + direct share call -> still exactly one share
  const retryAccept = await api("POST", "/emergency/accept/" + cid1, hAL.json.token);
  await require("./src/services/health-pack.service").shareHealthPackWithHospital(p1.patient.id, hA.hospital.id, hA.id);
  const sharesAfterRetry = await prisma.healthPackShare.findMany({ where: { healthPack: { patientId: p1.patient.id } } });
  console.log("P1_S1_RETRY_ACCEPT_NOOP=" + (retryAccept.status === 200 && (retryAccept.json.message || "").includes("Already") ? "PASS" : "FAIL") + " msg=" + (retryAccept.json.message || retryAccept.json.error));
  console.log("P1_S1_NO_DUPLICATE_SHARE_ON_RETRY=" + (sharesAfterRetry.length === 1 ? "PASS" : "FAIL") + " count=" + sharesAfterRetry.length);

  // Socket events
  console.log("P1_S1_SOCKET_CASE_ACCEPTED=" + (evAccepted && (evAccepted.status === "TRANSFER") ? "PASS" : "FAIL"));
  console.log("P1_S1_SOCKET_TRANSFER_STARTED=" + (evTransfer ? "PASS" : "FAIL"));
  sock1.close();

  // ---------- SCENARIO 2: patient already HAS an active HealthPack ----------
  const p2 = await mkPatient("P2 HasPack", "p2hp_" + ts + "@t.com", ph, true);
  const sos2 = await api("POST", "/emergency/sos", (await api("POST", "/auth/login", null, { email: "p2hp_" + ts + "@t.com", password: "password123" })).json.token, {
    symptoms: "P1 existing pack test", emergencyType: "CARDIAC", latitude: 23.0225, longitude: 72.5714, idempotencyKey: "p1hp2-" + ts,
  });
  const cid2 = sos2.json.publicCaseId;
  const acc2 = await api("POST", "/emergency/accept/" + cid2, hAL.json.token);
  const packs2 = await prisma.healthPack.findMany({ where: { patientId: p2.patient.id } });
  const shares2 = await prisma.healthPackShare.findMany({ where: { healthPack: { patientId: p2.patient.id }, sharedWithHospitalId: hA.hospital.id } });
  console.log("P1_S2_ACCEPT_OK=" + (acc2.status === 200 ? "PASS" : "FAIL") + " HTTP=" + acc2.status);
  console.log("P1_S2_PACK_REUSED_NOT_DUPLICATED=" + (packs2.length === 1 ? "PASS" : "FAIL") + " packs=" + packs2.length);
  console.log("P1_S2_ONE_SHARE=" + (shares2.length === 1 ? "PASS" : "FAIL") + " count=" + shares2.length);

  await cleanup();
  server.close();
}
main()
  .catch((e) => { console.log("P1_ERR=" + String((e && e.message) || e)); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());