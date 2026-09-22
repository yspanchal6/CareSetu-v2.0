const app = require('./src/app');
const prisma = require('./src/config/prisma');
const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = 3009;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

let server;

// Mock user tokens
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1d' });
};

async function runTests() {
  console.log("=== STARTING P3 HTTP E2E VERIFICATION ===");

  // 1. Start Express Server
  server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[+] Server listening on port ${PORT}`);

  try {
    // 2. Setup Data
    const patientUser = await prisma.user.findFirst({ where: { role: 'PATIENT' }, include: { patient: true } });
    const hospitalUser = await prisma.user.findFirst({ where: { role: 'HOSPITAL' }, include: { hospital: true } });
    const unauthUserToken = generateToken("fake-id", "PATIENT");

    const patientToken = generateToken(patientUser.id, "PATIENT");
    const hospitalToken = generateToken(hospitalUser.id, "HOSPITAL");

    const apiBase = `http://localhost:${PORT}/api/health-pack`;

    // Wait for any pending async initialization
    await new Promise(r => setTimeout(r, 500));

    // TEST A: Unauthenticated user cannot access
    console.log("\\n[TEST A] Unauthenticated Access Restriction");
    let res = await fetch(apiBase, { method: 'POST' });
    if (res.status === 401) {
      console.log("  ✅ Unauthenticated user rejected with 401.");
    } else {
      console.log(`  ❌ Expected 401, got ${res.status}`);
    }

    // TEST B: Create Health Pack (Patient)
    console.log("\\n[TEST B] Create Health Pack via HTTP");
    const healthData = {
      bloodType: "O+",
      allergies: ["Penicillin", "Peanuts"],
      medications: ["Aspirin"],
      chronicConditions: ["None"]
    };

    res = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${patientToken}`
      },
      body: JSON.stringify({ healthData })
    });
    let data = await res.json();
    if (res.status === 201 && data.success) {
      console.log("  ✅ Health Pack successfully encrypted and created via API.");
    } else {
      console.log("  ❌ Failed to create Health Pack:", data);
      return;
    }

    const newPackId = data.data.id;

    // TEST C: Get My Health Pack (Patient)
    console.log("\\n[TEST C] Patient Retrieval of Health Pack via HTTP");
    res = await fetch(`${apiBase}/my-pack`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    data = await res.json();
    if (res.status === 200 && data.success && data.data.healthData.bloodType === "O+") {
      console.log("  ✅ Patient successfully retrieved and decrypted Health Pack via API.");
    } else {
      console.log("  ❌ Failed patient retrieval:", data);
    }

    // TEST D: Unauthorized Hospital Access Attempt (No Consent)
    console.log("\\n[TEST D] Unauthorized Hospital Access Restrained");
    res = await fetch(`${apiBase}/shared/${newPackId}`, {
      headers: { 'Authorization': `Bearer ${hospitalToken}` }
    });
    if (res.status === 403) {
      console.log("  ✅ Hospital securely blocked (403 Forbidden) due to missing consent.");
    } else {
      console.log(`  ❌ Expected 403, got ${res.status}`);
    }

    // Give the hospital consent (mocking the Emergency acceptance flow)
    const share = await prisma.healthPackShare.create({
      data: {
        healthPackId: newPackId,
        sharedWithHospitalId: hospitalUser.hospital.id,
        consentGranted: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    // TEST E: Authorized Hospital Access (With Consent)
    console.log("\\n[TEST E] Authorized Hospital Access via HTTP");
    res = await fetch(`${apiBase}/shared/${newPackId}`, {
      headers: { 'Authorization': `Bearer ${hospitalToken}` }
    });
    data = await res.json();
    if (res.status === 200 && data.success && data.data.healthData.bloodType === "O+") {
      console.log("  ✅ Hospital securely retrieved and decrypted Health Pack.");
    } else {
      console.log("  ❌ Failed hospital retrieval:", data);
    }

    // Verify AuditLog creation
    console.log("\\n[TEST F] Verify Audit Logging");
    const logs = await prisma.auditLog.findMany({
      where: { entityId: newPackId, action: 'HEALTH_PACK_VIEWED' }
    });
    if (logs.length > 0) {
      console.log("  ✅ Audit log successfully created in DB.");
    } else {
      console.log("  ❌ Missing audit log.");
    }

    console.log("\\n=== P3 HTTP E2E VERIFICATION COMPLETE ===");

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  }
}

runTests();
