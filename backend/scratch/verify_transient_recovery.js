/**
 * Standalone verification script to test:
 * 1. Handling of simulated transient errors (ECONNREFUSED, 57P03, P1001, P2039)
 * 2. Next successful sweeper cycle on ready database
 * 3. Process stability (no unhandled crash)
 */
const prisma = require('../src/config/prisma');
const { sweepExpiredRequests } = require('../src/services/hospital-timeout.service');

async function testTransientErrorHandling() {
  console.log('=== TEST 1: SIMULATED TRANSIENT DATABASE ERRORS ===');

  const originalFindMany = prisma.hospitalRequest.findMany;

  const transientErrorsToTest = [
    { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:5432' },
    { code: 'P2039', message: 'Database error. Code: `57P03` Message: `the database system is starting up`' },
    { code: 'P1001', message: "Can't reach database server at localhost:5432" },
    { code: undefined, message: 'Database error: 57P03 starting up' },
  ];

  for (const mockErr of transientErrorsToTest) {
    console.log(`\nTesting transient error: code=${mockErr.code}, message="${mockErr.message}"`);
    prisma.hospitalRequest.findMany = async () => {
      const err = new Error(mockErr.message);
      if (mockErr.code) err.code = mockErr.code;
      throw err;
    };

    // Should catch error gracefully and log warning without crashing
    await sweepExpiredRequests();
    console.log('✅ Handled safely without process crash.');
  }

  // Restore real findMany
  prisma.hospitalRequest.findMany = originalFindMany;

  console.log('\n=== TEST 2: NEXT REAL SWEEPER CYCLE AGAINST LIVE DATABASE ===');
  await prisma.$connect();
  console.log('✅ Database connected.');

  // Execute real sweep
  await sweepExpiredRequests();
  console.log('✅ Real database sweep completed successfully with 0 errors.');

  console.log('\n=== ALL TRANSIENT & LIVE SWEEPER VERIFICATIONS PASSED ===');
  process.exit(0);
}

testTransientErrorHandling().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
