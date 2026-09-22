require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');

async function main() {
  console.log('--- DATABASE VERIFICATION FOR HEALTHPACK SHARE & AUDIT LOGS ---');
  
  const shares = await prisma.healthPackShare.findMany({
    take: 5,
    orderBy: { sharedAt: 'desc' },
  });
  console.log(`[DB] Recent HealthPackShares count: ${shares.length}`);
  if (shares.length > 0) {
    console.log(`[DB] Latest Share: ID=${shares[0].id}, HospitalId=${shares[0].sharedWithHospitalId}, Status=${shares[0].status}, ExpiresAt=${shares[0].expiresAt}`);
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { action: 'HEALTH_PACK_VIEWED' },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`[DB] HEALTH_PACK_VIEWED Audit Logs count: ${auditLogs.length}`);
  if (auditLogs.length > 0) {
    console.log(`[DB] Latest Audit Log: Action=${auditLogs[0].action}, EntityId=${auditLogs[0].entityId}, Details=${JSON.stringify(auditLogs[0].details)}`);
  }

  process.exit(0);
}

main();
