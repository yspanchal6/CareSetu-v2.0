const { GovHealthDataService } = require('../src/services/gov-health-data/gov-health-data.service');
const prisma = require('../src/config/prisma');

async function runTests() {
  console.log('=== STARTING GOVERNMENT HEALTH DATA FOUNDATION TESTS ===\n');

  try {
    // 1. Initial Sync for District Hospitals
    console.log('[Test 1] Syncing District Hospitals dataset...');
    const dhResult = await GovHealthDataService.syncDataset('district_hospitals');
    console.log('✔ District Hospitals Sync Result:', dhResult);

    // 2. Initial Sync for AB PM-JAY Admissions
    console.log('\n[Test 2] Syncing AB PM-JAY Admissions dataset...');
    const pmjayResult = await GovHealthDataService.syncDataset('pmjay_admissions');
    console.log('✔ AB PM-JAY Admissions Sync Result:', pmjayResult);

    // 3. Test Deduplication by running Sync again
    console.log('\n[Test 3] Testing Deduplication by re-running sync for District Hospitals...');
    const dhReSync = await GovHealthDataService.syncDataset('district_hospitals');
    const dhTotalCount = await prisma.governmentHealthRecord.count({ where: { source: 'DATA_GOV_IN' } });
    console.log(`✔ Re-sync finished. Total records in DB for DATA_GOV_IN: ${dhTotalCount} (Expected: ${dhResult.recordsImported}, match: ${dhTotalCount === dhResult.recordsImported})`);

    // 4. Verify Summary Output
    console.log('\n[Test 4] Fetching Admin Summary...');
    const summary = await GovHealthDataService.getSummary();
    console.log('✔ Summary Data:', JSON.stringify(summary, null, 2));

    // 5. Verify Records Retrieval
    console.log('\n[Test 5] Fetching Paginated Records...');
    const recordsData = await GovHealthDataService.getRecords({ page: 1, limit: 5 });
    console.log(`✔ Fetched ${recordsData.records.length} records. Total in system: ${recordsData.pagination.total}`);
    console.log('✔ Sample Record:', {
      source: recordsData.records[0].source,
      sourceDataset: recordsData.records[0].sourceDataset,
      sourceRecordId: recordsData.records[0].sourceRecordId,
      hospitalName: recordsData.records[0].hospitalName,
      state: recordsData.records[0].state,
      licenseInfo: recordsData.records[0].licenseInfo
    });

    console.log('\n=== ALL GOVERNMENT HEALTH DATA FOUNDATION TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
