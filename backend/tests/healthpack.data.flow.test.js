/**
 * CareSetu — Health Pack Data Flow Test Suite
 *
 * Verifies the full Health Pack pipeline underlying the "hospital sees
 * NOT_PROVIDED/UNKNOWN instead of real values" bug:
 *
 *   Patient profile -> Prisma -> HealthPack (AES-encrypted) ->
 *   EmergencyCase authorization -> GET /api/health-pack/case/:caseId ->
 *   nested `data.healthData.<field>` payload consumed by the hospital UI.
 *
 *  1.  Backend returns nested `data.healthData` with REAL values that match DB.
 *  2.  Optional/missing fields do not crash serialization (no fatal error).
 *  3.  heartCondition/diabetesStatus/hypertensionStatus values are exact.
 *  4.  Patient updates medical profile -> ACTIVE HealthPack reflects new values.
 *  5.  A different patient's assigned hospital cannot read the pack (403).
 *  6.  A hospital user without a Hospital profile is rejected (404).
 *  7.  Expired share record is rejected (403).
 *  8.  Successful decryption writes a HEALTH_PACK_VIEWED audit record.
 *  9.  Decryption failure returns a safe 500 that does not leak plaintext.
 * 10.  Hospital accept flow (auto-share) still works end-to-end.
 * 11.  Authorized hospital receives the registered patient's real name.
 * 12.  Genuinely-missing name falls back to "Patient", never "Emergency Patient".
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const healthPackService = require('../src/services/health-pack.service');
const healthPackController = require('../src/controllers/health-pack.controller');
const patientController = require('../src/controllers/patient.controller');
const { decrypt } = require('../src/utils/crypto');

const EMAIL_DOMAIN = `hp.${Date.now()}.caresetu.local`;

async function createPatientUser(overrides = {}) {
  const email = overrides.email || `patient.${Math.random().toString(36).slice(2, 10)}@${EMAIL_DOMAIN}`;
  const user = await prisma.user.create({
    data: {
      email,
      password: '$2b$10$mockmockmockmockmockmock', // mock hash
      role: 'PATIENT',
      status: 'ACTIVE',
      isVerified: true,
      name: overrides.name || 'HealthPack Test Patient',
    },
  });
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      name: overrides.name || 'HealthPack Test Patient',
      age: overrides.age || 30,
      gender: overrides.gender || 'OTHER',
      phone: overrides.phone || '9876501234',
      bloodGroup: overrides.bloodGroup ?? null,
      allergies: overrides.allergies ?? null,
      medicalConditions: overrides.medicalConditions ?? null,
      conditions: overrides.conditions ?? null,
      medications: overrides.medications ?? null,
    },
  });
  return { user, patient };
}

async function createHospitalUser(overrides = {}) {
  const user = await prisma.user.create({
    data: {
      email: overrides.email || `hospital.${Math.random().toString(36).slice(2, 10)}@${EMAIL_DOMAIN}`,
      password: '$2b$10$mockmockmockmockmockmock', // mock hash
      role: 'HOSPITAL',
      status: 'ACTIVE',
      isVerified: true,
      name: 'HealthPack Test Hospital',
    },
  });
  const hospital = await prisma.hospital.create({
    data: {
      userId: user.id,
      name: 'HealthPack Test Hospital',
      address: 'Test Address',
      phone: '9876001234',
      capabilities: [],
      location: { lat: 23.0225, lng: 72.5714 },
    },
  });
  return { user, hospital };
}

let caseCounter = 0;
async function createCase(patientId, hospitalId = null) {
  caseCounter += 1;
  return prisma.emergencyCase.create({
    data: {
      caseId: `CASE-HP-${Date.now()}-${caseCounter}`,
      patientId,
      hospitalId,
      symptoms: 'Test symptoms for HealthPack data flow.',
      location: { lat: 23.0225, lng: 72.5714 },
      detectedWords: [],
    },
  });
}

async function callController(controller, args) {
  const body = { status: 200, json: null, successBody: null };
  let capturedErr;
  const res = {
    status(code) { body.status = code; return this; },
    json(data) { body.json = data; body.successBody = data; return this; },
  };
  const next = (err) => { capturedErr = err; };
  try {
    await controller(...args, res, next);
  } catch (e) {
    capturedErr = e;
  }
  return { body, err: capturedErr || undefined };
}

function decryptPackStore(healthPack) {
  return JSON.parse(decrypt(healthPack.encryptedData, healthPack.iv));
}

async function runHealthPackDataFlowTests() {
  console.log('==================================================');
  console.log('CARESETU HEALTH PACK DATA FLOW TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${details}`);
      failed++;
    }
  }

  // Track created fixtures for cleanup (created -> deleted in reverse dependency order).
  const createdUsers = [];
  const createdPatients = [];
  const createdHospitals = [];
  const createdCases = [];
  const createdHealthPacks = [];
  const createdShares = [];
  const trackedAuditUsers = [];

  let T1_PACK_ID = null;
  let T1_SHARE_ID = null;

  try {
    // ==================================================================
    // TEST 1: Nested data.healthData mirrors the patient profile
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({
        bloodGroup: 'AB+',
        allergies: 'Penicillin',
        medications: 'Metformin 500mg, Aspirin',
        conditions: 'Type-2 Diabetes',
        medicalConditions: 'Type-2 Diabetes',
        heartCondition: null,
      });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      await healthPackService.createHealthPack(patient.id, {
        bloodGroup: 'AB+',
        allergies: 'Penicillin',
        medications: 'Metformin 500mg, Aspirin',
        conditions: 'Type-2 Diabetes',
        medicalConditions: 'Type-2 Diabetes',
        heartCondition: 'NO',
        diabetesStatus: 'YES',
        hypertensionStatus: 'NO',
      });

      const share = await healthPackService.shareHealthPackWithHospital(
        patient.id, hospital.hospital.id, hospital.user.id
      );
      T1_SHARE_ID = share.id;

      const packRecord = await prisma.healthPack.findFirst({
        where: { patientId: patient.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      T1_PACK_ID = packRecord.id;
      createdHealthPacks.push(packRecord.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.caseId } },
      ]);

      assert(!err, 'Test 1: No error thrown by getCaseHealthPack', JSON.stringify(err && err.message));
      assert(body.status === 200, 'Test 1: HTTP 200 OK', `got ${body.status}`);
      assert(body.successBody?.success === true, 'Test 1: success:true in response');
      const data = body.successBody?.data;
      assert(data && data.healthData, 'Test 1: medical data is NESTED under data.healthData');
      assert(data?.healthData?.bloodGroup === 'AB+', 'Test 1: healthData.bloodGroup = AB+', `got ${data?.healthData?.bloodGroup}`);
      assert(data?.healthData?.allergies === 'Penicillin', 'Test 1: healthData.allergies = Penicillin', `got ${data?.healthData?.allergies}`);
      assert(data?.healthData?.medications === 'Metformin 500mg, Aspirin', 'Test 1: healthData.medications matches', `got ${data?.healthData?.medications}`);
      assert(data?.healthData?.conditions === 'Type-2 Diabetes', 'Test 1: healthData.conditions matches', `got ${data?.healthData?.conditions}`);
      // The nested value matches the DB (data integrity).
      const dbPatient = await prisma.patient.findUnique({ where: { id: patient.id } });
      assert(data?.healthData?.bloodGroup === dbPatient.bloodGroup, 'Test 1: nested value matches DB patient profile');
    }

    // ==================================================================
    // TEST 2: Optional/missing fields are non-fatal
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'O+' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      // Minimal pack: only bloodGroup provided.
      await healthPackService.createHealthPack(patient.id, { bloodGroup: 'O+' });
      const packRecord = await prisma.healthPack.findFirst({
        where: { patientId: patient.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      createdHealthPacks.push(packRecord.id);

      await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(!err, 'Test 2: No error thrown for pack with missing optional fields');
      assert(body.status === 200 && body.successBody?.data?.healthData, 'Test 2: HTTP 200 with healthData despite missing options', `got ${body.status}`);
      assert(body.successBody.data.healthData.bloodGroup === 'O+', 'Test 2: bloodGroup still correct', `got ${body.successBody.data.healthData.bloodGroup}`);
      assert(body.successBody.data.healthData.medications === undefined || body.successBody.data.healthData.medications === null,
        'Test 2: missing fields serialize without throwing');
    }

    // ==================================================================
    // TEST 3: Heart / diabetes / hypertension are exact, not auto-UNKNOWN
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'B+', heartCondition: 'YES', diabetesStatus: 'YES', hypertensionStatus: 'NO' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      await healthPackService.createHealthPack(patient.id, {
        bloodGroup: 'B+',
        heartCondition: 'YES',
        diabetesStatus: 'YES',
        hypertensionStatus: 'NO',
      });
      const packRecord = await prisma.healthPack.findFirst({
        where: { patientId: patient.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      createdHealthPacks.push(packRecord.id);

      await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(!err, 'Test 3: No error thrown');
      assert(body.status === 200, 'Test 3: HTTP 200 OK');
      const values = body.successBody?.data?.healthData || {};
      assert(values.heartCondition === 'YES', 'Test 3: healthData.heartCondition = YES', `got ${values.heartCondition}`);
      assert(values.diabetesStatus === 'YES', 'Test 3: healthData.diabetesStatus = YES', `got ${values.diabetesStatus}`);
      assert(values.hypertensionStatus === 'NO', 'Test 3: healthData.hypertensionStatus = NO', `got ${values.hypertensionStatus}`);
    }

    // ==================================================================
    // TEST 4: Patient profile update syncs the ACTIVE HealthPack
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'O+', medications: 'Old Med' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      await healthPackService.createHealthPack(patient.id, { bloodGroup: 'O+', medications: 'Old Med' });

      // Patient updates their medical profile via the real controller.
      const { body, err } = await callController(patientController.updateProfile, [
        {
          user: { userId: user.id, role: 'PATIENT' },
          body: { bloodGroup: 'A-', medications: 'Insulin 10U', allergies: 'Sulfur', heartCondition: 'YES', diabetesStatus: 'NO' },
        },
      ]);

      assert(!err, 'Test 4: Profile update succeeded without error', JSON.stringify(err && err.message));
      assert(body.status === 200 && body.successBody?.success === true, 'Test 4: HTTP 200 success from updateProfile', `got ${body.status}`);
      assert(body.successBody?.patient?.bloodGroup === 'A-', 'Test 4: DB patient profile updated to A-', `got ${body.successBody?.patient?.bloodGroup}`);

      const packRecord = await prisma.healthPack.findFirst({
        where: { patientId: patient.id, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      createdHealthPacks.push(packRecord.id);

      const decrypted = decryptPackStore(packRecord);
      assert(decrypted.bloodGroup === 'A-', 'Test 4: HealthPack reflects updated bloodGroup A-', `got ${decrypted.bloodGroup}`);
      assert(decrypted.medications === 'Insulin 10U', 'Test 4: HealthPack reflects updated medications', `got ${decrypted.medications}`);
      assert(decrypted.allergies === 'Sulfur', 'Test 4: HealthPack reflects updated allergies', `got ${decrypted.allergies}`);
      assert(decrypted.heartCondition === 'YES' && decrypted.diabetesStatus === 'NO', 'Test 4: HealthPack reflects updated cardiac/diabetes values');
    }

    // ==================================================================
    // TEST 5: Different patient's hospital cannot read this case (403)
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'A+', conditions: 'Seizure Disorder' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);
      const emergencyCase = await createCase(patient.id);
      createdCases.push(emergencyCase.id);

      // A DIFFERENT hospital that is assigned/requested to patient's own case.
      const hospital2 = await createHospitalUser();
      createdUsers.push(hospital2.user.id);
      createdHospitals.push(hospital2.hospital.id);
      trackedAuditUsers.push(hospital2.user.id);

      // Give hospital2 a relationship to a DIFFERENT case of the same patient
      // so it is a "real" requesting hospital, but not for this one.
      const otherCase = await createCase(patient.id);
      createdCases.push(otherCase.id);
      await prisma.hospitalRequest.create({
        data: { emergencyCaseId: otherCase.id, hospitalId: hospital2.hospital.id },
      });

      // hospital2 tries to read the first case it was never assigned/requested for.
      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital2.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(err === undefined, 'Test 5: Authorization failure handled in controller (no unhandled error)', JSON.stringify(err && err.message));
      assert(body.status === 403, 'Test 5: HTTP 403 for a hospital with no relationship to this case', `got ${body.status}`);
      assert(body.json && body.json.error && body.json.error.includes('Unauthorized'),
        'Test 5: Controller returns Unauthorized error message', JSON.stringify(body.json));
      assert(!body.json?.data, 'Test 5: No medical data leaked in 403 response');
    }

    // ==================================================================
    // TEST 6: Hospital-role user without a Hospital profile is rejected
    // ==================================================================
    {
      const { user: patientUser, patient } = await createPatientUser({ bloodGroup: 'O-' });
      createdUsers.push(patientUser.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(patientUser.id);

      await healthPackService.createHealthPack(patient.id, { bloodGroup: 'O-' });
      const packRecord = await prisma.healthPack.findFirst({ where: { patientId: patient.id } });
      createdHealthPacks.push(packRecord.id);

      const emergencyCase = await createCase(patient.id);
      createdCases.push(emergencyCase.id);

      // Hospital-role user with NO hospital profile row.
      const impostor = await prisma.user.create({
        data: {
          email: `impostor.${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`,
          password: 'mock',
          role: 'HOSPITAL',
          status: 'ACTIVE',
          name: 'Impostor',
        },
      });
      createdUsers.push(impostor.id);
      trackedAuditUsers.push(impostor.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: impostor.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(err === undefined, 'Test 6: Missing hospital profile handled in controller', JSON.stringify(err && err.message));
      assert(body.status === 404, 'Test 6: HTTP 404 when hospital profile missing', `got ${body.status}`);
      assert(body.json && body.json.error && body.json.error.includes('not found'),
        'Test 6: Controller returns not-found error message', JSON.stringify(body.json));
    }

    // ==================================================================
    // TEST 7: Expired share record is rejected (403)
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'A+' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      await healthPackService.createHealthPack(patient.id, { bloodGroup: 'A+' });
      const packRecord = await prisma.healthPack.findFirst({ where: { patientId: patient.id } });
      createdHealthPacks.push(packRecord.id);

      // Share was granted but already expired.
      const expiredShare = await prisma.healthPackShare.create({
        data: {
          healthPackId: packRecord.id,
          sharedWithHospitalId: hospital.hospital.id,
          sharedWithUserId: hospital.user.id,
          consentGranted: true,
          expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        },
      });
      createdShares.push(expiredShare.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(err === undefined, 'Test 7: Expired-share failure handled in controller', JSON.stringify(err && err.message));
      assert(body.status === 403, 'Test 7: HTTP 403 for expired share', `got ${body.status}`);
      assert(body.json && body.json.error && body.json.error.toLowerCase().includes('expired'),
        'Test 7: Controller returns expired/unauthorized message', JSON.stringify(body.json));
    }

    // ==================================================================
    // TEST 8: HEALTH_PACK_VIEWED audit record written on success
    // ==================================================================
    {
      if (!T1_PACK_ID) throw new Error('TEST 8 requires TEST 1 pack fixture');
      const audited = await prisma.auditLog.findFirst({
        where: {
          action: 'HEALTH_PACK_VIEWED',
          entityId: T1_PACK_ID,
        },
        orderBy: { createdAt: 'desc' },
      });
      assert(audited !== null, 'Test 8: HEALTH_PACK_VIEWED audit record exists for pack');
      assert(audited.details && audited.details.event === 'HEALTH_PACK_DECRYPTED', 'Test 8: Audit details include HEALTH_PACK_DECRYPTED event');

      // No decrypted medical plaintext is ever persisted in audit logs.
      const rawDetails = JSON.stringify(audited.details || {});
      assert(rawDetails.indexOf('AB+') === -1 && rawDetails.indexOf('Metformin') === -1,
        'Test 8: Audit log does not contain decrypted medical plaintext');
    }

    // ==================================================================
    // TEST 9: Decryption failure returns a safe error (no plaintext leak)
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'O+' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      await healthPackService.createHealthPack(patient.id, { bloodGroup: 'O+', medications: 'SuperSecretMeds' });
      const packRecord = await prisma.healthPack.findFirst({ where: { patientId: patient.id } });
      createdHealthPacks.push(packRecord.id);

      await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);

      // Corrupt the ciphertext (non-decodable garbage).
      await prisma.healthPack.update({
        where: { id: packRecord.id },
        data: { encryptedData: 'TAMPERED' + '00'.repeat(packRecord.encryptedData.length % 64), iv: 'garbage' },
      });

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(err !== undefined, 'Test 9: Decryption failure propagated to error handler', JSON.stringify(err && err.status));
      assert(body.status === 200 && body.successBody === null, 'Test 9: No success payload emitted for corrupt data',
        `status=${body.status} json=${JSON.stringify(body.successBody)}`);
      assert(err ? err.message.indexOf('SuperSecretMeds') === -1 : true, 'Test 9: Error message does not leak decrypted medications plaintext');
    }

    // ==================================================================
    // TEST 10: Hospital accept flow (auto-share) works end-to-end
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ bloodGroup: 'AB-', medications: 'Atorvastatin 20mg' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      // No ACTIVE pack exists: accepting hospital must still get a pack.
      const noPackCount = await prisma.healthPack.count({ where: { patientId: patient.id } });
      assert(noPackCount === 0, 'Test 10: Patient starts with no HealthPack');

      const share1 = await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);
      const autoPack = await prisma.healthPack.findFirst({ where: { patientId: patient.id, status: 'ACTIVE' } });
      createdHealthPacks.push(autoPack.id);

      assert(share1 && share1.id, 'Test 10: Auto-share created for accepting hospital');
      assert(autoPack !== null, 'Test 10: ACTIVE HealthPack auto-generated on accept');
      const decrypted = decryptPackStore(autoPack);
      assert(decrypted.bloodGroup === 'AB-', 'Test 10: Auto-generated pack reflects profile bloodGroup', `got ${decrypted.bloodGroup}`);
      assert(decrypted.medications === 'Atorvastatin 20mg', 'Test 10: Auto-generated pack reflects profile medications', `got ${decrypted.medications}`);

      // Accepting hospital can then decrypt it via the case endpoint.
      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);
      assert(!err, 'Test 10: Accepting hospital decrypts pack without error');
      assert(body.status === 200 && body.successBody?.data?.healthData?.bloodGroup === 'AB-',
        'Test 10: data.healthData.bloodGroup = AB- after accept');

      // Re-accepting does not duplicate shares (idempotent reuse).
      const share2 = await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);
      assert(share2.id === share1.id, 'Test 10: Re-share reuses existing ACTIVE share (no duplicates)');
    }

    // ==================================================================
    // TEST 11: Authorized hospital receives the registered patient name
    // ==================================================================
    {
      const REGISTERED_NAME = 'Rohan Mehta';
      const { user, patient } = await createPatientUser({
        name: REGISTERED_NAME,
        bloodGroup: 'B+',
        conditions: 'Hypertension',
      });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      await healthPackService.createHealthPack(patient.id, {
        bloodGroup: 'B+',
        conditions: 'Hypertension',
        medicalConditions: 'Hypertension',
      });
      const packRecord = await prisma.healthPack.findFirst({ where: { patientId: patient.id } });
      createdHealthPacks.push(packRecord.id);
      await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(!err, 'Test 11: No error thrown retrieving HealthPack with patient name');
      assert(body.status === 200 && body.successBody?.data?.patient, 'Test 11: HTTP 200 with data.patient object');
      const patientPayload = body.successBody.data.patient;
      assert(patientPayload.name === REGISTERED_NAME, 'Test 11: data.patient.name equals registered name', `got ${patientPayload.name}`);
      assert(patientPayload.id === patient.id, 'Test 11: data.patient.id equals Patient id');
      assert(body.successBody.data.patientId === patient.id, 'Test 11: data.patientId unchanged at top level');

      // The returned medical data still flows (nothing regressed by adding name).
      assert(body.successBody.data.healthData?.bloodGroup === 'B+', 'Test 11: Medical data still present alongside name');
    }

    // ==================================================================
    // TEST 12: Genuinely-missing patient name falls back to "Patient"
    // ==================================================================
    {
      const { user, patient } = await createPatientUser({ name: '', bloodGroup: 'O+' });
      createdUsers.push(user.id);
      createdPatients.push(patient.id);
      trackedAuditUsers.push(user.id);

      // Simulate a stored Profile whose name is genuinely unavailable.
      await prisma.patient.update({ where: { id: patient.id }, data: { name: '' } });

      const hospital = await createHospitalUser();
      createdUsers.push(hospital.user.id);
      createdHospitals.push(hospital.hospital.id);
      trackedAuditUsers.push(hospital.user.id);

      const emergencyCase = await createCase(patient.id, hospital.hospital.id);
      createdCases.push(emergencyCase.id);

      await healthPackService.createHealthPack(patient.id, { bloodGroup: 'O+' });
      const packRecord = await prisma.healthPack.findFirst({ where: { patientId: patient.id } });
      createdHealthPacks.push(packRecord.id);
      await healthPackService.shareHealthPackWithHospital(patient.id, hospital.hospital.id, hospital.user.id);

      const { body, err } = await callController(healthPackController.getCaseHealthPack, [
        { user: { userId: hospital.user.id, role: 'HOSPITAL' }, params: { caseId: emergencyCase.id } },
      ]);

      assert(!err, 'Test 12: No error thrown for patient with no stored name', JSON.stringify(err && err.message));
      assert(body.status === 200, 'Test 12: HTTP 200 with missing patient name', `got ${body.status}`);
      const patientPayload = body.successBody?.data?.patient;
      assert(patientPayload && patientPayload.name === 'Patient', 'Test 12: Missing name falls back to "Patient" (no fake data)', `got ${patientPayload && patientPayload.name}`);
      assert(patientPayload && patientPayload.id === patient.id, 'Test 12: Patient ID still correct when name missing');
      assert(patientPayload && patientPayload.name !== 'Emergency Patient', 'Test 12: "Emergency Patient" is never used as display fallback');
    }

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    // Safest-order cleanup: shares -> packs -> cases (hospital requests cascade) -> patients/hospitals -> users -> audit logs.
    try {
      if (T1_SHARE_ID && createdShares.indexOf(T1_SHARE_ID) === -1) createdShares.push(T1_SHARE_ID);
      await prisma.healthPackShare.deleteMany({ where: { id: { in: createdShares } } });
      await prisma.healthPack.deleteMany({ where: { id: { in: createdHealthPacks } } });
      await prisma.emergencyCase.deleteMany({ where: { id: { in: createdCases } } });
      await prisma.patient.deleteMany({ where: { id: { in: createdPatients } } });
      await prisma.hospital.deleteMany({ where: { id: { in: createdHospitals } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: trackedAuditUsers } } });
    } catch (cleanupError) {
      console.error('[CLEANUP ERROR]', JSON.stringify(cleanupError, Object.getOwnPropertyNames(cleanupError)));
    }

    await prisma.$disconnect();
  }

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runHealthPackDataFlowTests();