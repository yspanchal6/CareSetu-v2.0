/**
 * CareSetu V2.0 — Emergency SOS Service Contract & Hospital Matching Regression Test
 */

const assert = require('assert');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const hospitalMatchingService = require('../src/services/hospital-matching.service');
const { HospitalMatchingService } = require('../src/services/hospital-matching.service');
const emergencyService = require('../src/services/emergency.service');

async function runContractTests() {
  console.log('==================================================');
  console.log('  RUNNING EMERGENCY SOS SERVICE CONTRACT TESTS     ');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Check Service Export Contract
  await test('1. Hospital Matching Service Export Contract', () => {
    assert(typeof hospitalMatchingService === 'object', 'Export is an object');
    assert(typeof hospitalMatchingService.findBestHospitals === 'function', 'findBestHospitals function is exported at root level');
    assert(typeof HospitalMatchingService === 'function', 'HospitalMatchingService class is exported');
    assert(typeof HospitalMatchingService.findBestHospitals === 'function', 'HospitalMatchingService.findBestHospitals static method exists');
  });

  // 2. Test findBestHospitals with Valid Coordinates
  await test('2. findBestHospitals Execution with Valid Coordinates', async () => {
    const results = await hospitalMatchingService.findBestHospitals({
      latitude: 22.558218,
      longitude: 72.889097,
      emergencyType: 'CARDIAC',
      radiusKm: 100
    });

    assert(Array.isArray(results), 'Result is an array');
    if (results.length > 0) {
      const match = results[0];
      assert(match.hospital && match.hospital.id, 'Candidate contains hospital object with id');
      assert(typeof match.distanceKm === 'number', 'Candidate contains numerical distanceKm');
      assert(typeof match.capabilityMatched === 'boolean', 'Candidate contains boolean capabilityMatched');
      assert(typeof match.availabilityMatched === 'boolean', 'Candidate contains boolean availabilityMatched');
      assert(typeof match.matchScore === 'number', 'Candidate contains numerical matchScore');
    }
  });

  // 3. Test findBestHospitals with Out-of-Bounds Coordinates
  await test('3. findBestHospitals Graceful Handling of Invalid Coordinates', async () => {
    const invalidLat = await hospitalMatchingService.findBestHospitals({
      latitude: 999.0,
      longitude: 72.889097,
    });
    assert(Array.isArray(invalidLat) && invalidLat.length === 0, 'Invalid latitude returns empty array without throwing error');

    const nanCoords = await hospitalMatchingService.findBestHospitals({
      latitude: NaN,
      longitude: undefined,
    });
    assert(Array.isArray(nanCoords) && nanCoords.length === 0, 'NaN coordinates return empty array without throwing error');
  });

  // 4. Test Specialty Filtering (CARDIAC & TRAUMA)
  await test('4. findBestHospitals Specialty Capability Filter', async () => {
    const cardiacMatches = await hospitalMatchingService.findBestHospitals({
      latitude: 22.558218,
      longitude: 72.889097,
      emergencyType: 'CARDIAC',
    });

    if (cardiacMatches.length > 0) {
      assert(
        cardiacMatches.every(m => m.hospital.hasCardiology === true || (Array.isArray(m.hospital.capabilities) && m.hospital.capabilities.some(c => c.toLowerCase().includes('cardio')))),
        'All matched cardiac candidates possess cardiology capability'
      );
    }
  });

  console.log('\n==================================================');
  console.log(`  CONTRACT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
}

runContractTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test runner exception:', err);
    process.exit(1);
  });
