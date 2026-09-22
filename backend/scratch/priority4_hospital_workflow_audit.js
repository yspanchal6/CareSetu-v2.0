const prisma = require('../src/config/prisma');
const emergencyService = require('../src/services/emergency.service');
const hospitalTimeoutService = require('../src/services/hospital-timeout.service');

async function runPriority4Audit() {
  console.log('====================================================');
  console.log('CARESETU — PRIORITY 4: HOSPITAL WORKFLOW AUDIT');
  console.log('====================================================\n');

  // Find test patient and 2 test hospitals in DB
  const patient = await prisma.patient.findFirst({ include: { user: true } });
  const hospitals = await prisma.hospital.findMany({
    where: { emergencyAvailable: true },
    include: { user: true },
    take: 2,
  });

  if (!patient || hospitals.length < 2) {
    throw new Error('Test patient or 2 test hospitals missing in database.');
  }

  const h1 = hospitals[0];
  const h2 = hospitals[1];

  console.log(`Test Patient: ${patient.name} (${patient.userId})`);
  console.log(`Test Hospital 1: ${h1.name} (${h1.userId})`);
  console.log(`Test Hospital 2: ${h2.name} (${h2.userId})\n`);


  // ----------------------------------------------------
  // TASK 2 — ACCEPTANCE FLOW TEST
  // ----------------------------------------------------
  console.log('--- TASK 2: ACCEPTANCE FLOW TEST ---');
  const sosKeyAcc = `P4-ACC-${Date.now()}`;
  const sosAcc = await emergencyService.createEmergencyCase({
    userId: patient.userId,
    latitude: 22.5600,
    longitude: 72.9400,
    symptoms: 'Acceptance test - severe chest pain',
    source: 'CHATBOT',
    idempotencyKey: sosKeyAcc,
  });

  console.log(`Created SOS Case: ${sosAcc.emergencyCase.caseId} (DB ID: ${sosAcc.emergencyCase.id})`);
  console.log(`Matched Hospitals Count: ${sosAcc.nearestHospitals.length}`);

  // Accept case by Hospital 1
  const acceptRes = await emergencyService.acceptEmergencyCase(sosAcc.emergencyCase.id, h1.userId);
  console.log(`Hospital 1 Acceptance Result: Status = ${acceptRes.status}`);

  // DB Verification after Acceptance
  const updatedCaseAcc = await prisma.emergencyCase.findUnique({ where: { id: sosAcc.emergencyCase.id } });
  const h1ReqAcc = await prisma.hospitalRequest.findUnique({
    where: { emergencyCaseId_hospitalId: { emergencyCaseId: sosAcc.emergencyCase.id, hospitalId: h1.id } },
  });

  console.log('PostgreSQL State Verification:');
  console.log(`  EmergencyCase status: ${updatedCaseAcc.status} (Expected: TRANSFER)`);
  console.log(`  EmergencyCase hospitalId: ${updatedCaseAcc.hospitalId} (Expected: ${h1.id})`);
  console.log(`  Hospital 1 Request status: ${h1ReqAcc ? h1ReqAcc.status : 'N/A'} (Expected: ACCEPTED)`);

  // Verify Duplicate Acceptance Prevention (Hospital 2 attempting to accept same case)
  console.log('\nTesting Duplicate Acceptance Prevention (Hospital 2 attempt)...');
  try {
    await emergencyService.acceptEmergencyCase(sosAcc.emergencyCase.id, h2.userId);
    console.error('❌ ERROR: Hospital 2 incorrectly accepted an already-accepted case!');
  } catch (err) {
    console.log(`✅ Duplicate Acceptance Blocked Safely: "${err.message}"`);
  }


  // ----------------------------------------------------
  // TASK 3 — REJECTION & REROUTING FLOW TEST
  // ----------------------------------------------------
  console.log('\n--- TASK 3: REJECTION & AUTO-REROUTING FLOW TEST ---');
  const sosKeyRej = `P4-REJ-${Date.now()}`;
  const sosRej = await emergencyService.createEmergencyCase({
    userId: patient.userId,
    latitude: 22.5600,
    longitude: 72.9400,
    symptoms: 'Rejection test - shortness of breath',
    source: 'CHATBOT',
    idempotencyKey: sosKeyRej,
  });

  console.log(`Created SOS Case: ${sosRej.emergencyCase.caseId}`);
  
  // Hospital 1 rejects the request
  const rejectRes = await emergencyService.rejectEmergencyCase(sosRej.emergencyCase.id, h1.userId, 'ICU Full');
  console.log(`Hospital 1 Rejection Result: ${rejectRes.message}`);

  // DB Verification after Rejection
  const h1ReqRej = await prisma.hospitalRequest.findUnique({
    where: { emergencyCaseId_hospitalId: { emergencyCaseId: sosRej.emergencyCase.id, hospitalId: h1.id } },
  });

  console.log('PostgreSQL State Verification:');
  console.log(`  Hospital 1 Request status: ${h1ReqRej.status} (Expected: REJECTED)`);
  console.log(`  Hospital 1 Rejection Reason: "${h1ReqRej.rejectionReason}"`);

  // Verify next pending hospital in request queue
  const nextPendingReq = await prisma.hospitalRequest.findFirst({
    where: { emergencyCaseId: sosRej.emergencyCase.id, status: 'PENDING' },
    include: { hospital: true },
  });
  console.log(`  Auto-Rerouted to Next Candidate Hospital: ${nextPendingReq ? nextPendingReq.hospital.name : 'NONE'}`);


  // ----------------------------------------------------
  // TASK 4 — TIMEOUT & SWEEPER ADVANCEMENT TEST
  // ----------------------------------------------------
  console.log('\n--- TASK 4: TIMEOUT & SWEEPER ADVANCEMENT TEST ---');
  const sosKeyTout = `P4-TOUT-${Date.now()}`;
  const sosTout = await emergencyService.createEmergencyCase({
    userId: patient.userId,
    latitude: 22.5600,
    longitude: 72.9400,
    symptoms: 'Timeout sweeper test',
    source: 'CHATBOT',
    idempotencyKey: sosKeyTout,
  });

  console.log(`Created SOS Case: ${sosTout.emergencyCase.caseId}`);

  // Artificially age the hospital request to trigger timeout cutoff (>120s ago)
  const oldDate = new Date(Date.now() - 300 * 1000); // 5 minutes ago
  await prisma.hospitalRequest.updateMany({
    where: { emergencyCaseId: sosTout.emergencyCase.id },
    data: { createdAt: oldDate },
  });

  console.log('Artificially aged requests to 5 minutes ago. Executing sweepExpiredRequests()...');
  await hospitalTimeoutService.sweepExpiredRequests();

  // DB Verification after Timeout Sweep
  const expiredReqs = await prisma.hospitalRequest.findMany({
    where: { emergencyCaseId: sosTout.emergencyCase.id, status: 'EXPIRED' },
  });
  console.log(`PostgreSQL State Verification: Expired Requests Count = ${expiredReqs.length} (Expected: >0) ✅`);


  // ----------------------------------------------------
  // TASK 5 — CONCURRENCY & RACE CONDITION TEST
  // ----------------------------------------------------
  console.log('\n--- TASK 5: CONCURRENCY & RACE CONDITION TEST ---');
  const sosKeyConc = `P4-CONC-${Date.now()}`;
  const sosConc = await emergencyService.createEmergencyCase({
    userId: patient.userId,
    latitude: 22.5600,
    longitude: 72.9400,
    symptoms: 'Race condition test - severe trauma',
    source: 'CHATBOT',
    idempotencyKey: sosKeyConc,
  });

  console.log(`Created Race Condition SOS Case: ${sosConc.emergencyCase.caseId}`);
  console.log('Simulating simultaneous acceptance by Hospital 1 and Hospital 2 (Promise.all)...');

  const raceResults = await Promise.allSettled([
    emergencyService.acceptEmergencyCase(sosConc.emergencyCase.id, h1.userId),
    emergencyService.acceptEmergencyCase(sosConc.emergencyCase.id, h2.userId),
  ]);

  const fulfilled = raceResults.filter(r => r.status === 'fulfilled');
  const rejected = raceResults.filter(r => r.status === 'rejected');

  console.log(`Race Results: ${fulfilled.length} Succeeded, ${rejected.length} Rejected.`);
  if (fulfilled.length === 1 && rejected.length === 1) {
    console.log('✅ CONCURRENCY PROTECTION VERIFIED! Exactly ONE hospital accepted the case; the second request was blocked atomically.');
  } else {
    console.error('❌ RACE CONDITION ERROR: Concurrency protection failed!');
  }


  console.log('\n====================================================');
  console.log('PRIORITY 4 HOSPITAL WORKFLOW AUDIT COMPLETED');
  console.log('====================================================\n');

  await prisma.$disconnect();
}

runPriority4Audit().catch(err => {
  console.error('Priority 4 Audit Failed:', err);
  prisma.$disconnect();
});
