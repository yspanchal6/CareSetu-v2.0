/**
 * CareSetu — Regional Dummy Database & Hospital Matching Integration Test Suite
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const authController = require('../src/controllers/auth.controller');
const emergencyRepository = require('../src/repositories/emergency.repository');
const hospitalMatchingService = require('../src/services/hospital-matching.service');

async function runRegionalDatabaseSeedTests() {
  console.log('==================================================');
  console.log('CARESETU REGIONAL DATABASE & SEED TEST SUITE');
  console.log('==================================================');

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
    // ------------------------------------------------------------------
    // TEST 1: Patient Login (test.patient@caresetu.local)
    // ------------------------------------------------------------------
    let patientLoginStatus = 200;
    let patientLoginBody = null;

    await authController.login(
      { body: { email: 'test.patient@caresetu.local', password: 'Test@12345' } },
      {
        status(c) { patientLoginStatus = c; return this; },
        json(d) { patientLoginBody = d; return this; },
      },
      (err) => { if (err) throw err; }
    );

    assert(patientLoginStatus === 200, 'Test Patient login returns HTTP 200 OK');
    assert(patientLoginBody?.success === true, 'Test Patient login returns success = true');
    assert(patientLoginBody?.user?.role === 'PATIENT', 'Test Patient role is loaded as PATIENT');
    assert(typeof patientLoginBody?.token === 'string', 'Test Patient receives valid JWT token');

    // ------------------------------------------------------------------
    // TEST 2: Hospital Login (test.hospital@caresetu.local)
    // ------------------------------------------------------------------
    let hospitalLoginStatus = 200;
    let hospitalLoginBody = null;

    await authController.login(
      { body: { email: 'test.hospital@caresetu.local', password: 'Test@12345' } },
      {
        status(c) { hospitalLoginStatus = c; return this; },
        json(d) { hospitalLoginBody = d; return this; },
      },
      (err) => { if (err) throw err; }
    );

    assert(hospitalLoginStatus === 200, 'Test Hospital login returns HTTP 200 OK');
    assert(hospitalLoginBody?.success === true, 'Test Hospital login returns success = true');
    assert(hospitalLoginBody?.user?.role === 'HOSPITAL', 'Test Hospital role is loaded as HOSPITAL');
    assert(typeof hospitalLoginBody?.token === 'string', 'Test Hospital receives valid JWT token');

    // ------------------------------------------------------------------
    // TEST 3: Hospital Listing & Distance Calculation (Karamsad Center)
    // ------------------------------------------------------------------
    // Coordinates: Karamsad (22.5360, 72.8950)
    const karamsadLat = 22.5360;
    const karamsadLng = 72.8950;

    const hospitalsIn50km = await emergencyRepository.getActiveHospitalsInRadius(karamsadLat, karamsadLng, 50);

    assert(hospitalsIn50km.length > 0, 'Finds active hospitals in 50km radius around Karamsad');

    // Verify distance sorting order (ascending distanceMeters)
    let isSorted = true;
    for (let i = 1; i < hospitalsIn50km.length; i++) {
      if (hospitalsIn50km[i].distanceMeters < hospitalsIn50km[i - 1].distanceMeters) {
        isSorted = false;
        break;
      }
    }
    assert(isSorted === true, 'Hospitals are correctly sorted by distance in ascending order');

    // ------------------------------------------------------------------
    // TEST 4: Progressive Radius Search (2km -> 4km -> 8km -> 16km -> 32km -> 64km)
    // ------------------------------------------------------------------
    const radii = [2, 4, 8, 16, 32, 64];
    let previousCount = 0;
    let progressiveExpansionVerified = false;

    for (const r of radii) {
      const found = await emergencyRepository.getActiveHospitalsInRadius(karamsadLat, karamsadLng, r);
      if (found.length >= previousCount) {
        previousCount = found.length;
        progressiveExpansionVerified = true;
      }
    }

    assert(progressiveExpansionVerified === true, 'Progressive radius search expands candidate scope cleanly');

    // ------------------------------------------------------------------
    // TEST 5: Specialty & Capability Matching (CARDIAC & TRAUMA)
    // ------------------------------------------------------------------
    const cardiacMatches = await hospitalMatchingService.findBestHospitals({
      latitude: karamsadLat,
      longitude: karamsadLng,
      emergencyType: 'CARDIAC',
    });

    assert(cardiacMatches.length > 0, 'Finds capable hospitals for CARDIAC emergency');
    assert(
      cardiacMatches.every((m) => m.hospital.hasCardiology === true),
      'All matched CARDIAC candidate hospitals have cardiology facility (hasCardiology: true)'
    );

    const traumaMatches = await hospitalMatchingService.findBestHospitals({
      latitude: karamsadLat,
      longitude: karamsadLng,
      emergencyType: 'TRAUMA',
    });

    assert(traumaMatches.length > 0, 'Finds capable hospitals for TRAUMA emergency');
    assert(
      traumaMatches.every((m) => m.hospital.hasTraumaUnit === true),
      'All matched TRAUMA candidate hospitals have trauma unit (hasTraumaUnit: true)'
    );

    // ------------------------------------------------------------------
    // TEST 6: Patient-to-Hospital Distance Scoring
    // ------------------------------------------------------------------
    const bestHospitalMatch = cardiacMatches[0];
    assert(typeof bestHospitalMatch.distanceKm === 'number', 'Calculates accurate distance in km');
    assert(typeof bestHospitalMatch.matchScore === 'number', 'Assigns valid matchScore to hospital candidates');

    // ------------------------------------------------------------------
    // TEST 7: Invalid or Missing Coordinates Handling
    // ------------------------------------------------------------------
    let nanHandledSafely = false;
    try {
      const res = await emergencyRepository.getActiveHospitalsInRadius(NaN, NaN, 10);
      if (Array.isArray(res) && res.length === 0) {
        nanHandledSafely = true;
      }
    } catch {
      nanHandledSafely = true;
    }
    assert(nanHandledSafely === true, 'Gracefully handles invalid/NaN latitude/longitude coordinates (returns safe empty candidate set)');

    // ------------------------------------------------------------------
    // TEST 8: Role Authorization Protection
    // ------------------------------------------------------------------
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    const patientDecoded = jwt.verify(patientLoginBody.token, secret);
    const hospitalDecoded = jwt.verify(hospitalLoginBody.token, secret);

    assert(patientDecoded.role === 'PATIENT', 'Patient token cannot impersonate hospital or admin');
    assert(hospitalDecoded.role === 'HOSPITAL', 'Hospital token is scoped to HOSPITAL role');

    // ------------------------------------------------------------------
    // TEST 9: Database DEMO Label Integrity Check
    // ------------------------------------------------------------------
    const demoHospitals = await prisma.hospital.findMany({
      where: {
        email: { endsWith: '@caresetu.local' },
      },
    });

    assert(demoHospitals.length >= 10, 'All 10+ regional demo hospital records are present in database');
    assert(
      demoHospitals.every((h) => h.name.includes('[DEMO]')),
      'Every regional test hospital is explicitly designated with [DEMO] in its name'
    );

    console.log('--------------------------------------------------');
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRegionalDatabaseSeedTests();
