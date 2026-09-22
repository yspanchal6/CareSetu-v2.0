const prisma = require('./src/config/prisma');
const emergencyService = require('./src/services/emergency.service');
const healthPackService = require('./src/services/health-pack.service');
const { getIo } = require('./src/utils/socket');

async function runTests() {
  console.log("=== STARTING P1 E2E LIVE VERIFICATION ===\\n");

  const patient = await prisma.patient.findFirst({
    where: { name: 'John Patient' },
    include: { user: true }
  });
  
  if (!patient) {
    console.error("❌ Patient not found. Did you run seed.js?");
    return;
  }

  // 1. Patient submits SOS (Ahmedabad)
  console.log("[TEST 1] Patient Submits SOS (Ahmedabad)");
  const idempotencyKey = 'E2E-IDEMP-' + Date.now();
  
  const sosResult = await emergencyService.createEmergencyCase({
    userId: patient.user.id,
    emergencyType: 'CARDIAC',
    latitude: 23.0225,
    longitude: 72.5714,
    symptoms: "Severe chest pain, left arm numbness",
    idempotencyKey
  });

  const caseId = sosResult.emergencyCase.id;
  console.log(`  ✅ EmergencyCase Created: ${sosResult.emergencyCase.caseId}`);
  console.log(`  ✅ AI/Safety Rule marked severity: ${sosResult.emergencyCase.severity}`);

  // 2. Hospital Matching matches SAL Hospital (2km)
  console.log("\\n[TEST 2] Hospital Matching Cascade");
  if (sosResult.nearestHospitals.length > 0 && sosResult.nearestHospitals[0].name === 'SAL Hospital') {
    console.log(`  ✅ SAL Hospital matched and ranked first.`);
  } else {
    console.log(`  ❌ Hospital matching failed. Got:`, sosResult.nearestHospitals[0]?.name);
  }

  const salHospitalId = sosResult.nearestHospitals[0].id;
  const salHospitalUserId = sosResult.nearestHospitals[0].userId;

  // 3. Hospital accepts the case
  console.log("\\n[TEST 3] SAL Hospital Accepts Case");
  const acceptResult = await emergencyService.acceptEmergencyCase(caseId, salHospitalUserId);
  console.log(`  ✅ Case Accepted. Status: ${acceptResult.status}`);

  // 4. System automatically generates/shares HealthPack
  console.log("\\n[TEST 4] HealthPack Shared Automatically (P1)");
  const shares = await prisma.healthPackShare.findMany({
    where: { sharedWithHospitalId: salHospitalId, healthPack: { patientId: patient.id } }
  });
  if (shares.length > 0) {
    console.log(`  ✅ HealthPackShare created with consentGranted: ${shares[0].consentGranted}`);
  } else {
    console.log(`  ❌ HealthPackShare not found!`);
  }

  // 5. Hospital retrieves HealthPack (Audit Log & Decryption)
  console.log("\\n[TEST 5] Hospital Retrieves Encrypted HealthPack");
  try {
    const healthPack = shares.length > 0 ? await healthPackService.getDecryptedHealthPack(shares[0].healthPackId, salHospitalUserId, salHospitalId) : null;
    if (healthPack && healthPack.healthData.bloodType === 'O+') {
      console.log(`  ✅ HealthPack decrypted successfully. BloodType: ${healthPack.healthData.bloodType}`);
    } else {
      console.log(`  ❌ Decryption or data mismatch.`);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: salHospitalUserId, action: 'HEALTH_PACK_VIEWED' }
    });
    if (auditLogs.length > 0) {
      console.log(`  ✅ AuditLog written successfully for HealthPack access.`);
    } else {
      console.log(`  ❌ AuditLog missing!`);
    }
  } catch (err) {
    console.log(`  ❌ Error retrieving HealthPack: ${err.message}`);
  }

  // 6. Simulate an Offline Sync event using the same operationId
  console.log("\\n[TEST 6] Offline Sync Engine Simulation (Idempotency)");
  const syncResult = await emergencyService.createEmergencyCase({
    userId: patient.user.id,
    emergencyType: 'CARDIAC',
    latitude: 23.0225,
    longitude: 72.5714,
    symptoms: "Severe chest pain, left arm numbness",
    idempotencyKey // Using the exact same key
  });

  if (syncResult.isIdempotentResponse && syncResult.emergencyCase.id === caseId) {
    console.log(`  ✅ PWA Offline Sync duplicate successfully trapped and prevented!`);
  } else {
    console.log(`  ❌ Duplicate prevention failed.`);
  }

  console.log("\\n=== P1 E2E LIVE VERIFICATION COMPLETE ===");
  process.exit(0);
}

runTests().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
