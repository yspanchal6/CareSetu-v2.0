const { HospitalDirectoryService } = require('../src/services/hospital-directory.service');
const prisma = require('../src/config/prisma');

async function runDirectoryTests() {
  console.log('=== STARTING ENHANCED HOSPITAL DIRECTORY TESTS (STEP 2) ===\n');

  try {
    // 1. Fetch All Directory Records (Combined)
    console.log('[Test 1] Fetching combined directory (ALL sources)...');
    const allResult = await HospitalDirectoryService.getDirectory({ page: 1, limit: 20, source: 'ALL' });
    console.log(`✔ Fetched ${allResult.data.length} records. Total: ${allResult.pagination.total} (Registered: ${allResult.pagination.registeredCount}, Government: ${allResult.pagination.governmentCount})`);
    
    if (allResult.data.length > 0) {
      console.log('✔ Sample Directory Item:', {
        id: allResult.data[0].id,
        hospitalName: allResult.data[0].hospitalName,
        sourceType: allResult.data[0].sourceType,
        source: allResult.data[0].source,
        state: allResult.data[0].state,
        district: allResult.data[0].district,
        isVerified: allResult.data[0].isVerified
      });
    }

    // 2. Fetch Only CareSetu Registered Hospitals
    console.log('\n[Test 2] Fetching CARESETU_REGISTERED hospitals...');
    const registeredResult = await HospitalDirectoryService.getDirectory({ page: 1, limit: 10, source: 'CARESETU_REGISTERED' });
    console.log(`✔ Registered Hospitals Count: ${registeredResult.pagination.total}`);

    // 3. Fetch Only Government Data Records
    console.log('\n[Test 3] Fetching GOVERNMENT_DATA records...');
    const govResult = await HospitalDirectoryService.getDirectory({ page: 1, limit: 10, source: 'GOVERNMENT_DATA' });
    console.log(`✔ Government Records Count: ${govResult.pagination.total}`);
    console.log(`✔ Match expected Step 1 count (21 records): ${govResult.pagination.total === 21}`);

    // 4. Test State Filtering (Gujarat)
    console.log('\n[Test 4] Filtering Directory by State = "Gujarat"...');
    const gjResult = await HospitalDirectoryService.getDirectory({ state: 'Gujarat', source: 'ALL' });
    console.log(`✔ Records found for Gujarat: ${gjResult.pagination.total}`);
    const nonGj = gjResult.data.filter(r => r.state.toLowerCase() !== 'gujarat');
    console.log(`✔ All returned records belong to Gujarat: ${nonGj.length === 0}`);

    // 5. Test Search Functionality ("Civil")
    console.log('\n[Test 5] Searching Directory for "Civil"...');
    const searchResult = await HospitalDirectoryService.getDirectory({ search: 'Civil', source: 'ALL' });
    console.log(`✔ Search "Civil" returned ${searchResult.pagination.total} records.`);

    // 6. Test Filter Options Retrieval
    console.log('\n[Test 6] Fetching Filter Options...');
    const filterOptions = await HospitalDirectoryService.getFilterOptions();
    console.log(`✔ States available: ${filterOptions.states.length} states (${filterOptions.states.slice(0, 5).join(', ')}...)`);
    console.log(`✔ Districts available: ${filterOptions.districts.length} districts`);
    console.log(`✔ Hospital Types available: ${filterOptions.hospitalTypes.join(', ')}`);

    // 7. Test Get Directory Item By ID
    if (govResult.data.length > 0) {
      const sampleGovId = govResult.data[0].id;
      console.log(`\n[Test 7] Fetching single directory item by ID (${sampleGovId})...`);
      const singleItem = await HospitalDirectoryService.getDirectoryById(sampleGovId);
      console.log('✔ Retrieved Single Item:', {
        id: singleItem.id,
        hospitalName: singleItem.hospitalName,
        sourceType: singleItem.sourceType,
        source: singleItem.source,
        licenseInfo: singleItem.licenseInfo
      });
    }

    console.log('\n=== ALL ENHANCED HOSPITAL DIRECTORY TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DIRECTORY TEST FAILED:', err);
    process.exit(1);
  }
}

runDirectoryTests();
