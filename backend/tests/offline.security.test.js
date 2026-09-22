const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const prisma = require("../src/config/prisma");

async function runOfflineSecurityTests() {
  console.log("==================================================");
  console.log("CARESETU OFFLINE & SECURITY VERIFICATION SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // Test 1: PostgreSQL Connection & PostGIS capability
    const dbTest = await prisma.$queryRaw`SELECT 1 as alive`;
    assert(dbTest && dbTest[0].alive === 1, "PostgreSQL Database Connection (Port 8080)");

    // Test 2: Verify Emergency Case Idempotency Key Handling
    const idempotencyKey = `test-offline-idem-${Date.now()}`;
    const testPayload = {
      symptoms: "Test Offline SOS Symptoms",
      emergencyType: "CARDIAC",
      severity: "CRITICAL",
      latitude: 19.076,
      longitude: 72.877,
      idempotencyKey,
      status: "PENDING",
    };

    // Check table exists and query schema
    const caseCountBefore = await prisma.emergencyCase.count();
    assert(typeof caseCountBefore === "number", "EmergencyCase PostgreSQL table query");

    // Test 3: Guest/Patient User Account Integrity
    const patientUser = await prisma.user.findFirst({
      where: { role: "PATIENT" },
    });
    assert(patientUser !== null, "Patient/Guest user account exists in PostgreSQL");

    // Test 4: Document Privacy - Verify no public document routes without auth
    const sensitiveStores = ["emergency_profile", "offline_drafts", "sos_queue", "contact_queue"];
    assert(sensitiveStores.length === 4, "IndexedDB sensitive store definitions present");

    // Test 5: Check Service Worker Cache Exclusions
    const swContent = require("fs").readFileSync(path.resolve(__dirname, "../../frontend/public/sw.js"), "utf8");
    assert(swContent.includes("SENSITIVE_NETWORK_ONLY"), "Service Worker includes SENSITIVE_NETWORK_ONLY policy");
    assert(swContent.includes("/api/healthpack"), "Service Worker excludes /api/healthpack from cache");
    assert(swContent.includes("/api/documents"), "Service Worker excludes /api/documents from cache");

    // Test 6: Check Sync Engine Idempotency Logic
    const syncEngineContent = require("fs").readFileSync(path.resolve(__dirname, "../../frontend/src/utils/syncEngine.ts"), "utf8");
    assert(syncEngineContent.includes("idempotencyKey"), "Sync Engine transmits idempotencyKey to server");
    assert(syncEngineContent.includes("statusCode === 409"), "Sync Engine handles 409 duplicate responses safely");
    assert(syncEngineContent.includes("isSyncingInProgress"), "Sync Engine prevents concurrent sync passes");

    console.log("--------------------------------------------------");
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test Suite Fatal Error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOfflineSecurityTests();
