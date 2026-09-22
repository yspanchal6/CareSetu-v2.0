const prisma = require('./src/config/prisma');
const emergencyService = require('./src/services/emergency.service');

async function runTests() {
  console.log("=== STARTING P0 LIVE VERIFICATION ===");
  
  // Get seeded patient
  const patient = await prisma.user.findFirst({
    where: { role: 'PATIENT' },
    include: { patient: true }
  });

  const hospitals = await prisma.hospital.findMany();
  console.log(`Found ${hospitals.length} hospitals.`);

  // TEST 1: Emergency SOS & Matching
  console.log("\\n[TEST 1] Emergency SOS Creation & Matching...");
  const idempotencyKey = `TEST-IDEMP-${Date.now()}`;
  
  const sosResult = await emergencyService.createEmergencyCase({
    userId: patient.id,
    emergencyType: 'CARDIAC',
    severity: 'HIGH',
    latitude: 23.0225,
    longitude: 72.5714,
    symptoms: 'Chest pain',
    idempotencyKey
  });
  
  console.log("  - Case Created:", sosResult.emergencyCase.caseId);
  console.log("  - Matched Hospitals:", JSON.stringify(sosResult.nearestHospitals, null, 2));
  if (sosResult.nearestHospitals.length === 0) {
    console.log("  ❌ No hospitals matched!");
    return;
  }
  // Verify Nadiad Civil Hospital was matched first because it's closest to the mock SOS
  if (sosResult.nearestHospitals[0].name === 'Nadiad Civil Hospital') {
    console.log("  ✅ Nadiad Civil Hospital ranked first (Capability + Distance matched).");
  } else {
    console.log("  ❌ Nadiad Civil Hospital was NOT ranked first!", sosResult.nearestHospitals[0].name);
  }

  // TEST 2: Idempotency (Duplicate SOS)
  console.log("\\n[TEST 2] Idempotency Protection (Duplicate SOS)...");
  const sosDuplicate = await emergencyService.createEmergencyCase({
    userId: patient.id,
    emergencyType: 'CARDIAC',
    severity: 'HIGH',
    latitude: 23.0225,
    longitude: 72.5714,
    symptoms: 'Chest pain',
    idempotencyKey
  });
  
  if (sosDuplicate.isIdempotentResponse && sosDuplicate.emergencyCase.id === sosResult.emergencyCase.id) {
    console.log("  ✅ Duplicate SOS correctly returned the existing case.");
  } else {
    console.log("  ❌ Idempotency failed. Created a new case or returned wrong data.");
  }

  // Fetch the created case ID
  const caseId = sosResult.emergencyCase.id;

  // TEST 3: Hospital Rejection Cascade
  console.log("\\n[TEST 3] Hospital Rejection Cascade...");
  const hospA_UserId = hospitals.find(h => h.name === 'Nadiad Civil Hospital').userId;
  
  const rejectResult = await emergencyService.rejectEmergencyCase(caseId, hospA_UserId);
  console.log("  - Rejected by Nadiad Civil Hospital.");
  console.log("  - Cascade Result:", rejectResult.message);
  
  if (rejectResult.message.includes('cascaded')) {
    console.log("  ✅ Rejection successfully cascaded to the next hospital.");
  } else {
    console.log("  ❌ Rejection cascade failed.", rejectResult.message);
  }

  // TEST 4: Hospital Acceptance
  console.log("\\n[TEST 4] Hospital Acceptance...");
  const pendingRequests = await prisma.hospitalRequest.findMany({
    where: { emergencyCaseId: sosResult.emergencyCase.id, status: 'PENDING' },
    include: { hospital: true }
  });
  
  if (pendingRequests.length === 0) {
    console.log("  ❌ No pending requests found after cascade.");
  } else {
    const nextHospName = pendingRequests[0].hospital.name;
    const nextHospUserId = pendingRequests[0].hospital.userId;
    console.log(`  - Next hospital in queue: ${nextHospName}`);
    
    const acceptResult = await emergencyService.acceptEmergencyCase(caseId, nextHospUserId);
    console.log(`  - Accepted by ${nextHospName}. Status: ${acceptResult.status}`);
    
    if (acceptResult.status === 'ACCEPTED') {
      console.log("  ✅ Case successfully accepted.");
    } else {
      console.log("  ❌ Acceptance failed.");
    }
    
    // TEST 5: Single-Hospital Acceptance Protection
    console.log("\\n[TEST 5] Single-Hospital Acceptance Protection...");
    const hospB_UserId = hospitals.find(h => h.name === 'Zydus Hospital, Anand')?.userId || hospitals.find(h => h.name === 'Civil Hospital Anand').userId;
    try {
      await emergencyService.acceptEmergencyCase(caseId, hospB_UserId);
      console.log("  ❌ Protection failed. Another hospital was able to accept an already accepted case.");
    } catch (e) {
      if (e.message.includes('already accepted') || e.message.includes('no longer available')) {
        console.log("  ✅ Protection succeeded! Caught error:", e.message);
      } else {
        console.log("  ❌ Unexpected error during protection test:", e.message);
      }
    }
  }

  console.log("\\n=== P0 LIVE VERIFICATION COMPLETE ===");
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
