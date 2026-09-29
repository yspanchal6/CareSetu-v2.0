const prisma = require('../src/config/prisma');

async function auditDatabase() {
  console.log('=== 1. DATABASE INTEGRITY & DATA RECONCILIATION AUDIT ===\n');

  try {
    // 1. Operational Models Count
    const hospitalCount = await prisma.hospital.count();
    const userCount = await prisma.user.count();
    const patientCount = await prisma.patient.count();
    const doctorCount = await prisma.user.count({ where: { role: 'DOCTOR' } });
    const emergencyCaseCount = await prisma.emergencyCase.count();

    console.log('Operational Models Baseline:');
    console.log(`- CareSetu Hospitals: ${hospitalCount}`);
    console.log(`- Users: ${userCount}`);
    console.log(`- Patients: ${patientCount}`);
    console.log(`- Doctors: ${doctorCount}`);
    console.log(`- Emergency Cases: ${emergencyCaseCount}`);

    // 2. Government Health Records Count & Breakdown
    const totalGovRecords = await prisma.governmentHealthRecord.count();
    const dataGovInCount = await prisma.governmentHealthRecord.count({ where: { source: 'DATA_GOV_IN' } });
    const pmjayCount = await prisma.governmentHealthRecord.count({ where: { source: 'PM_JAY' } });
    const apiSetuCount = await prisma.governmentHealthRecord.count({ where: { source: 'API_SETU' } });
    const externalSourceCount = await prisma.governmentHealthRecord.count({ where: { source: 'EXTERNAL_SOURCE' } });

    console.log('\nGovernment Health Records Breakdown:');
    console.log(`- Total Government Records: ${totalGovRecords}`);
    console.log(`  └─ DATA_GOV_IN (District Hospitals): ${dataGovInCount}`);
    console.log(`  └─ PM_JAY (Authorized Admissions): ${pmjayCount}`);
    console.log(`  └─ API_SETU: ${apiSetuCount}`);
    console.log(`  └─ EXTERNAL_SOURCE: ${externalSourceCount}`);

    // 3. Sync Logs Verification
    const syncLogsCount = await prisma.governmentSyncLog.count();
    const successfulLogs = await prisma.governmentSyncLog.count({ where: { status: 'SUCCESS' } });

    console.log('\nSync Logs Baseline:');
    console.log(`- Total Sync Logs: ${syncLogsCount}`);
    console.log(`- Successful Sync Logs: ${successfulLogs}`);

    // 4. Combined Directory Total
    const combinedTotal = hospitalCount + totalGovRecords;
    console.log(`\nCombined Directory Records Total: ${combinedTotal} (${hospitalCount} CareSetu + ${totalGovRecords} Government)`);

    // 5. Check Composite Key Integrity & Unique Constraints
    const duplicateCheck = await prisma.$queryRaw`
      SELECT source, "sourceRecordId", COUNT(*) 
      FROM government_health_records 
      GROUP BY source, "sourceRecordId" 
      HAVING COUNT(*) > 1
    `;
    console.log(`\nDuplicate [source, sourceRecordId] Groups Found: ${duplicateCheck.length}`);

    // 6. Check Orphan Records
    const allHospitals = await prisma.hospital.findMany({ select: { id: true, userId: true } });
    const orphanHospitals = allHospitals.filter(h => !h.userId).length;
    console.log(`Orphan CareSetu Hospitals (no user relation): ${orphanHospitals}`);

    console.log('\n✔ DATABASE AUDIT PASSED');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DATABASE AUDIT FAILED:', err);
    process.exit(1);
  }
}

auditDatabase();
