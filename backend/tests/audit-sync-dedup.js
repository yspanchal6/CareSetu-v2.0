const { GovHealthDataService } = require('../src/services/gov-health-data/gov-health-data.service');
const prisma = require('../src/config/prisma');

async function auditSyncAndDedup() {
  console.log('=== 2. STEP 1 DEDUPLICATION & SYNC FAILURE SAFETY AUDIT ===\n');

  try {
    // 1. Check Initial Count
    const countBefore = await prisma.governmentHealthRecord.count();
    console.log(`Initial Government Records Count: ${countBefore}`);

    // 2. Re-Sync District Hospitals
    console.log('\n[Action] Executing duplicate sync for "district_hospitals"...');
    await GovHealthDataService.syncDataset('district_hospitals');
    const countAfterDh = await prisma.governmentHealthRecord.count();
    console.log(`Count after re-syncing District Hospitals: ${countAfterDh} (Change: ${countAfterDh - countBefore})`);

    // 3. Re-Sync PM-JAY Admissions
    console.log('\n[Action] Executing duplicate sync for "pmjay_admissions"...');
    await GovHealthDataService.syncDataset('pmjay_admissions');
    const countAfterPmjay = await prisma.governmentHealthRecord.count();
    console.log(`Count after re-syncing PM-JAY Admissions: ${countAfterPmjay} (Change: ${countAfterPmjay - countBefore})`);

    if (countAfterPmjay !== countBefore) {
      throw new Error(`Deduplication failed! Record count increased from ${countBefore} to ${countAfterPmjay}`);
    }
    console.log('✔ PASS: Composite uniqueness [source, sourceRecordId] prevented duplicate creation.');

    // 4. Test Sync Failure Handling
    console.log('\n[Action] Simulating sync failure with invalid dataset key...');
    let failureHandled = false;
    try {
      await GovHealthDataService.syncDataset('invalid_dataset_key');
    } catch (err) {
      failureHandled = true;
      console.log(`✔ Caught expected sync failure error: "${err.message}"`);
    }

    if (!failureHandled) {
      throw new Error('Sync failure did not throw error as expected!');
    }

    // 5. Verify Previous Data Retained After Failed Sync
    const countAfterFailure = await prisma.governmentHealthRecord.count();
    console.log(`\nGovernment Records Count after failed sync: ${countAfterFailure}`);
    if (countAfterFailure !== countBefore) {
      throw new Error(`Failed sync corrupted previous records! Expected ${countBefore}, got ${countAfterFailure}`);
    }
    console.log('✔ PASS: Failed sync preserved previous successful dataset intact.');

    // 6. Check GovernmentSyncLog for Failed Log
    const failedLog = await prisma.governmentSyncLog.findFirst({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' }
    });
    console.log('✔ Logged Failure Entry:', failedLog ? {
      sourceDataset: failedLog.sourceDataset,
      status: failedLog.status,
      errorMessage: failedLog.errorMessage
    } : 'None');

    console.log('\n✔ STEP 1 DEDUPLICATION & FAILURE SAFETY AUDIT PASSED');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ SYNC & DEDUP AUDIT FAILED:', err);
    process.exit(1);
  }
}

auditSyncAndDedup();
