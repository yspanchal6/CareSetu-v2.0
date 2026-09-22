const prisma = require('../src/config/prisma');

async function cleanZombieData() {
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const result = await prisma.hospitalRequest.updateMany({
      where: {
        status: 'PENDING',
        requestedAt: { lt: cutoff },
      },
      data: {
        status: 'EXPIRED',
        respondedAt: new Date(),
        rejectionReason: 'Historical cleanup on startup',
      },
    });

    console.log(`[Zombie Cleanup] Updated ${result.count} stale hospital requests to EXPIRED.`);

    const statusCounts = await prisma.hospitalRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });

    console.log('[Zombie Cleanup] Current hospital request status breakdown:');
    console.table(statusCounts);
  } catch (err) {
    console.error('[Zombie Cleanup] Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanZombieData();
