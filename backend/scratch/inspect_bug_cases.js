const prisma = require('../src/config/prisma');

async function inspectCases() {
  const caseIds = ['CASE-20260915-837D3D', 'CASE-20260914-7FB245'];
  for (const cId of caseIds) {
    const c = await prisma.emergencyCase.findFirst({
      where: { OR: [{ caseId: cId }, { id: cId }] },
      include: { hospitalRequests: true },
    });

    if (!c) {
      console.log(`Case ${cId}: NOT FOUND in DB`);
    } else {
      console.log(`Case ${c.caseId}:`);
      console.log(`  DB ID: ${c.id}`);
      console.log(`  Case Status: ${c.status}`);
      console.log(`  Assigned Hospital ID: ${c.hospitalId}`);
      console.log(`  Hospital Requests (${c.hospitalRequests.length}):`);
      for (const r of c.hospitalRequests) {
        console.log(`    - Hospital ID: ${r.hospitalId} | Request Status: ${r.status}`);
      }
    }
    console.log('');
  }

  // Also query hospital 1b9ab5f5-ffc1-4cde-bfb6-7b94a1feaab1 mentioned in log
  const targetHospitalId = '1b9ab5f5-ffc1-4cde-bfb6-7b94a1feaab1';
  const hospital = await prisma.hospital.findUnique({
    where: { id: targetHospitalId },
  });
  console.log(`Target Hospital ${targetHospitalId}: ${hospital ? hospital.name : 'NOT FOUND'}`);

  await prisma.$disconnect();
}

inspectCases().catch(err => {
  console.error(err);
  prisma.$disconnect();
});
