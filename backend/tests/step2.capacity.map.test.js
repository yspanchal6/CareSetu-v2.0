const { HospitalDirectoryService } = require('../src/services/hospital-directory.service');

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ PASS: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }
}

async function runStep2CapacityAndMapTests() {
  console.log('==================================================');
  console.log('  RUNNING STEP 2 CAPACITY-SAFETY & MAP TESTS      ');
  console.log('==================================================\n');

  try {
    const resGov = await HospitalDirectoryService.getDirectory({ source: 'GOVERNMENT_DATA', limit: 50 });
    const resReg = await HospitalDirectoryService.getDirectory({ source: 'CARESETU_REGISTERED', limit: 50 });
    const resCombined = await HospitalDirectoryService.getDirectory({ source: 'ALL', limit: 100 });

    // 1. PM-JAY historical admissions NOT shown as current beds
    const pmjayRecords = resGov.data.filter(r => r.source === 'PM_JAY');
    const pmjayWithBedCount = pmjayRecords.filter(r => r.bedCount !== null && r.bedCount !== undefined);
    assert(pmjayRecords.length > 0 && pmjayWithBedCount.length === 0, '1. PM-JAY historical admissions NOT shown as current beds', `Found ${pmjayRecords.length} PM-JAY records, ${pmjayWithBedCount.length} with bedCount`);

    // 2. PM-JAY historical admissions NOT shown as available capacity
    const pmjayHasAdmissionData = pmjayRecords.every(r => r.admissionData !== null && typeof r.admissionData === 'object');
    assert(pmjayHasAdmissionData, '2. PM-JAY historical admissions data isolated in admissionData object', `All ${pmjayRecords.length} PM-JAY records contain structured admissionData JSON`);

    // 3. PM-JAY data clearly identified as historical/state-level data
    const pmjayCategory = pmjayRecords.every(r => r.hospitalType === 'State Cumulative Admissions' || r.category === 'AB PM-JAY Authorized Admissions');
    assert(pmjayCategory, '3. PM-JAY data clearly identified as historical state-level dataset', 'Category verified');

    // 4. Missing capacity does not produce a fake value
    const govNoBeds = resGov.data.filter(r => r.bedCount === null);
    assert(govNoBeds.length > 0 && govNoBeds.every(r => r.bedCount === null), '4. Missing capacity does not produce fake values', `${govNoBeds.length} records safely contain null bedCount`);

    // 5. Only verified current or appropriately dated capacity appears as capacity
    const districtHospitals = resGov.data.filter(r => r.source === 'DATA_GOV_IN');
    const dhWithBeds = districtHospitals.filter(r => typeof r.bedCount === 'number');
    assert(dhWithBeds.length > 0 && dhWithBeds.every(r => r.bedCount > 0), '5. Verified capacity appears only when supplied by source', `${dhWithBeds.length} District Hospitals contain valid numeric bed counts`);

    // 6. No fake emergency availability is generated for government records
    const govEmergency = resGov.data.filter(r => r.emergencyAvailable === true);
    assert(govEmergency.length === 0, '6. No fake emergency availability is generated for government records', `0 government records claim emergency availability`);

    // 7. Map: Valid coordinates create markers
    const withCoords = resCombined.data.filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number' && r.latitude !== 0 && r.longitude !== 0);
    assert(withCoords.length > 0, '7. Map: Valid coordinates present for geocoded hospitals', `${withCoords.length} records contain valid latitude/longitude for map markers`);

    // 8. Map: Missing coordinates do not create fake markers
    const withoutCoords = resCombined.data.filter(r => r.latitude === null || r.longitude === null);
    assert(withoutCoords.length > 0 && withoutCoords.every(r => r.latitude === null && r.longitude === null), '8. Map: Missing coordinates do not create fake coordinates', `${withoutCoords.length} records safely have null coordinates`);

    // 9. Map: Marker selection preserves source information
    const markerSources = new Set(withCoords.map(r => r.sourceType));
    assert(markerSources.has('CARESETU_REGISTERED') && markerSources.has('GOVERNMENT_DATA'), '9. Map: Marker selection preserves source information', `Sources in markers: ${Array.from(markerSources).join(', ')}`);

    // 10. Government records are NOT presented as CareSetu-verified hospitals
    const govVerified = resGov.data.filter(r => r.isVerified === true);
    assert(govVerified.length === 0, '10. Government records are NOT presented as CareSetu-verified hospitals', `0 government records claim isVerified = true`);

    console.log('\n==================================================');
    console.log(`  CAPACITY & MAP TESTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED`);
    console.log('==================================================');

    process.exit(failCount === 0 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ CAPACITY & MAP TEST FATAL ERROR:', err);
    process.exit(1);
  }
}

runStep2CapacityAndMapTests();
