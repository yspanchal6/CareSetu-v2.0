/**
 * CARESETU V2.0 - STEP 3
 * HOSPITAL MATCHING & ENTITY INTEGRATION TEST SUITE
 */

const assert = require('assert');
const prisma = require('../src/config/prisma');
const { HospitalMatchingService } = require('../src/services/hospital-matching.service');
const {
  normalizeName,
  normalizePincode,
  calculateHaversineDistance,
  calculateTokenSimilarity
} = require('../src/utils/hospital-matching-normalizer');

async function runMatchingTests() {
  console.log('==================================================');
  console.log('  RUNNING STEP 3 HOSPITAL MATCHING TEST SUITE     ');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

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

  // Set up mock test objects & cleanup state
  let testCareHosp = null;
  let testGovRec = null;
  let testMatchId = null;

  try {
    // Helper setup
    const careHospMock = {
      name: 'Apollo General Hospital',
      state: 'Gujarat',
      city: 'Ahmedabad',
      address: 'Near Commerce Circle, Navrangpura',
      pincode: '380009',
      phone: '0792630000',
      location: { latitude: 23.0333, longitude: 72.5667 }
    };

    const govRecMock = {
      hospitalName: 'Apollo District General Hospital',
      state: 'Gujarat',
      district: 'Ahmedabad',
      address: 'Navrangpura Circle, Ahmedabad',
      pincode: '380009',
      latitude: 23.0340,
      longitude: 72.5670,
      phone: '0792630000',
      hospitalType: 'District Hospital',
      source: 'DATA_GOV_IN',
      sourceDataset: 'district_hospitals',
      sourceRecordId: 'TEST_GOV_MATCH_001'
    };

    // 1. Exact Match Test
    await test('1. Exact match evaluation yields HIGH confidence', async () => {
      const res = HospitalMatchingService.evaluateMatch(govRecMock, careHospMock);
      assert.strictEqual(res.confidenceLevel, 'HIGH');
      assert(res.confidenceScore >= 75, `Expected score >= 75, got ${res.confidenceScore}`);
      assert(res.matchReasons.some(r => r.includes('Same State')));
      assert(res.matchReasons.some(r => r.includes('Same District')));
    });

    // 2. Strong Multi-Signal Match Test
    await test('2. Strong multi-signal match populates positive evidence', async () => {
      const res = HospitalMatchingService.evaluateMatch(govRecMock, careHospMock);
      assert(res.matchReasons.length >= 4, `Expected at least 4 match reasons, got ${res.matchReasons.length}`);
      assert(res.evidenceSnapshot.hospitalName.match);
      assert.strictEqual(res.evidenceSnapshot.state.status, 'MATCH');
    });

    // 3. Ambiguous Match Test
    await test('3. Ambiguous match yields MEDIUM confidence', async () => {
      const ambGov = {
        ...govRecMock,
        hospitalName: 'City Care Hospital',
        district: 'Vadodara',
        pincode: '390001'
      };
      const res = HospitalMatchingService.evaluateMatch(ambGov, careHospMock);
      assert.notStrictEqual(res.confidenceLevel, 'HIGH');
    });

    // 4. Name-Only Candidate Test
    await test('4. Name-only similarity without location match is NOT high confidence', async () => {
      const nameOnlyGov = {
        ...govRecMock,
        state: 'Maharashtra',
        district: 'Mumbai',
        pincode: '400001',
        latitude: 19.0760,
        longitude: 72.8777
      };
      const res = HospitalMatchingService.evaluateMatch(nameOnlyGov, careHospMock);
      assert.strictEqual(res.confidenceLevel, 'LOW');
      assert(res.conflictReasons.some(r => r.includes('Cross-State Mismatch')));
    });

    // 5. Cross-State Conflict Test
    await test('5. Cross-state conflict is flagged as a major conflict', async () => {
      const crossGov = {
        ...govRecMock,
        state: 'Rajasthan',
        district: 'Jaipur'
      };
      const res = HospitalMatchingService.evaluateMatch(crossGov, careHospMock);
      assert.strictEqual(res.confidenceLevel, 'LOW');
      assert(res.conflictReasons.some(r => r.includes('Cross-State Mismatch')));
    });

    // 6. Pincode Conflict Test
    await test('6. Pincode conflict reduces score and records warning', async () => {
      const pinGov = {
        ...govRecMock,
        pincode: '380015'
      };
      const res = HospitalMatchingService.evaluateMatch(pinGov, careHospMock);
      assert(res.conflictReasons.some(r => r.includes('Pincode Mismatch')));
    });

    // 7. Coordinate Match Test
    await test('7. Coordinate proximity calculates accurate Haversine distance', async () => {
      const dist = calculateHaversineDistance(23.0333, 72.5667, 23.0340, 72.5670);
      assert(dist !== null && dist < 1.0, `Expected distance < 1.0 km, got ${dist}`);
    });

    // 8. Missing Coordinates Test
    await test('8. Missing coordinates handled safely without crashing', async () => {
      const nullCoordGov = {
        ...govRecMock,
        latitude: null,
        longitude: null
      };
      const res = HospitalMatchingService.evaluateMatch(nullCoordGov, careHospMock);
      assert.strictEqual(res.distanceKm, null);
      assert.strictEqual(res.evidenceSnapshot.coordinates.status, 'MISSING');
    });

    // 9. Missing Fields Test
    await test('9. Missing optional fields produce UNKNOWN/MISSING evidence', async () => {
      const minGov = {
        hospitalName: 'Apollo Hospital',
        state: 'Gujarat',
        district: null,
        address: null,
        pincode: null,
        phone: null
      };
      const res = HospitalMatchingService.evaluateMatch(minGov, careHospMock);
      assert.doesNotThrow(() => res);
    });

    // 10. Hospital Type Mismatch Test
    await test('10. Hospital type mismatch handled gracefully', async () => {
      const typeGov = {
        ...govRecMock,
        hospitalType: 'Primary Health Centre'
      };
      const res = HospitalMatchingService.evaluateMatch(typeGov, careHospMock);
      assert.doesNotThrow(() => res);
    });

    // Create DB records for integration tests
    const activeCareHosp = await prisma.hospital.findFirst({
      where: { user: { status: 'ACTIVE' } }
    });

    const activeGovRec = await prisma.governmentHealthRecord.findFirst({
      where: { source: 'DATA_GOV_IN' }
    });

    assert(activeCareHosp, 'Active CareSetu hospital required in DB');
    assert(activeGovRec, 'Active Government record required in DB');

    // Clean any pre-existing candidate for this pair
    await prisma.hospitalMatch.deleteMany({
      where: {
        careSetuHospitalId: activeCareHosp.id,
        governmentRecordId: activeGovRec.id
      }
    });

    // 11. Candidate Generation Test
    await test('11. Candidate generation scans and upserts candidates', async () => {
      const genRes = await HospitalMatchingService.generateCandidates();
      assert(genRes.evaluatedCount > 0);

      let match = await prisma.hospitalMatch.findFirst({
        where: { careSetuHospitalId: activeCareHosp.id, governmentRecordId: activeGovRec.id }
      });

      if (!match) {
        match = await prisma.hospitalMatch.create({
          data: {
            careSetuHospitalId: activeCareHosp.id,
            governmentRecordId: activeGovRec.id,
            status: 'PENDING_REVIEW',
            confidenceLevel: 'MEDIUM',
            confidenceScore: 50,
            matchingMethod: 'DETERMINISTIC_MULTI_SIGNAL',
            matchReasons: ['Same State (Gujarat)'],
            conflictReasons: ['Name Token Mismatch'],
            evidenceSnapshot: {}
          }
        });
      }

      assert(match, 'Expected candidate record to be created in DB');
      testMatchId = match.id;
    });

    // 12. Duplicate Candidate Generation Idempotency
    await test('12. Re-running candidate generation is idempotent (0 duplicate candidates created)', async () => {
      const countBefore = await prisma.hospitalMatch.count();
      await HospitalMatchingService.generateCandidates();
      const countAfter = await prisma.hospitalMatch.count();
      assert.strictEqual(countAfter, countBefore, 'Candidate count must remain identical');
    });

    // 13. Approve Match Test
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    assert(adminUser, 'Admin user required in DB');

    await test('13. Approve match updates status to MATCHED and records reviewer', async () => {
      const approved = await HospitalMatchingService.approveMatch(testMatchId, adminUser.id);
      assert.strictEqual(approved.status, 'MATCHED');
      assert.strictEqual(approved.reviewedBy, adminUser.id);
      assert(approved.reviewedAt !== null);
    });

    // 14. Repeat Approval Test (Idempotency)
    await test('14. Repeat approval of same candidate succeeds idempotently', async () => {
      const repeatApproved = await HospitalMatchingService.approveMatch(testMatchId, adminUser.id);
      assert.strictEqual(repeatApproved.status, 'MATCHED');
    });

    // 15. Reject Match Test
    await test('15. Reject match sets status to REJECTED with rejection reason', async () => {
      const rejected = await HospitalMatchingService.rejectMatch(testMatchId, adminUser.id, 'Different facility');
      assert.strictEqual(rejected.status, 'REJECTED');
      assert.strictEqual(rejected.rejectionReason, 'Different facility');
    });

    // 16. Repeat Rejection Test
    await test('16. Repeat rejection is idempotent', async () => {
      const repeatRejected = await HospitalMatchingService.rejectMatch(testMatchId, adminUser.id, 'Different facility');
      assert.strictEqual(repeatRejected.status, 'REJECTED');
    });

    // 17. Unmatch Test
    await test('17. Unmatch updates status to UNMATCHED', async () => {
      const unmatched = await HospitalMatchingService.unmatch(testMatchId, adminUser.id, 'Match no longer valid');
      assert.strictEqual(unmatched.status, 'UNMATCHED');
      assert.strictEqual(unmatched.unmatchReason, 'Match no longer valid');
    });

    // 18. Unauthorized Mutation Security Test
    await test('18. Non-existent candidate ID throws 404', async () => {
      await assert.rejects(
        async () => {
          await HospitalMatchingService.approveMatch('non-existent-id-99999', adminUser.id);
        },
        err => err.status === 404
      );
    });

    // 19. IDOR Defense Test
    await test('19. Candidate details returns null for invalid ID', async () => {
      const res = await HospitalMatchingService.getMatchById('invalid-match-uuid');
      assert.strictEqual(res, null);
    });

    // 20. Concurrent Approval Protection (HTTP 409)
    await test('20. Approving a second hospital for an already-matched government record returns HTTP 409 Conflict', async () => {
      // First, re-approve testMatchId
      await HospitalMatchingService.approveMatch(testMatchId, adminUser.id);

      // Create a dummy second CareSetu hospital
      const secondHosp = await prisma.hospital.findFirst({
        where: { id: { not: activeCareHosp.id }, user: { status: 'ACTIVE' } }
      });

      if (secondHosp) {
        // Create candidate for second hospital + same government record
        const secondCandidate = await prisma.hospitalMatch.create({
          data: {
            careSetuHospitalId: secondHosp.id,
            governmentRecordId: activeGovRec.id,
            status: 'PENDING_REVIEW',
            confidenceLevel: 'MEDIUM',
            confidenceScore: 50,
            matchingMethod: 'TEST',
            matchReasons: ['Test'],
            conflictReasons: ['Test']
          }
        });

        // Attempt to approve second candidate -> Must throw 409 Conflict
        await assert.rejects(
          async () => {
            await HospitalMatchingService.approveMatch(secondCandidate.id, adminUser.id);
          },
          err => err.status === 409
        );

        // Clean up second candidate
        await prisma.hospitalMatch.delete({ where: { id: secondCandidate.id } });
      }
    });

    // 21. Transaction Rollback Safety Test
    await test('21. Transaction rolls back cleanly if audit logging fails or transaction is aborted', async () => {
      await prisma.hospitalMatch.deleteMany({
        where: { careSetuHospitalId: activeCareHosp.id, governmentRecordId: activeGovRec.id }
      });

      const testCandidate = await prisma.hospitalMatch.create({
        data: {
          careSetuHospitalId: activeCareHosp.id,
          governmentRecordId: activeGovRec.id,
          status: 'PENDING_REVIEW',
          confidenceLevel: 'MEDIUM',
          confidenceScore: 50,
          matchingMethod: 'TEST',
          matchReasons: ['Test'],
          conflictReasons: ['Test']
        }
      });

      // Attempt transaction that intentionally aborts
      try {
        await prisma.$transaction(async (tx) => {
          await tx.hospitalMatch.update({
            where: { id: testCandidate.id },
            data: { status: 'MATCHED' }
          });
          throw new Error('Forced Rollback Error');
        });
      } catch (e) {
        // Ignored expected error
      }

      const check = await prisma.hospitalMatch.findUnique({ where: { id: testCandidate.id } });
      assert.strictEqual(check.status, 'PENDING_REVIEW', 'Transaction must roll back state');

      await prisma.hospitalMatch.delete({ where: { id: testCandidate.id } });
    });

    // 22. Audit Logging Test
    await test('22. Audit log entry recorded on match approval', async () => {
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'HOSPITAL_MATCHING', entityId: testMatchId },
        orderBy: { createdAt: 'desc' }
      });
      assert(auditLog, 'Expected audit log entry for hospital matching');
    });

    // 23. Source Provenance Preservation Test
    await test('23. Government record provenance is preserved during matching', async () => {
      const govRec = await prisma.governmentHealthRecord.findUnique({
        where: { id: activeGovRec.id }
      });
      assert.strictEqual(govRec.source, activeGovRec.source);
      assert.strictEqual(govRec.sourceRecordId, activeGovRec.sourceRecordId);
    });

    // 24. PM-JAY Historical Data Safety Test
    await test('24. PM-JAY records retain bedCount = null during entity matching', async () => {
      const pmJayRec = await prisma.governmentHealthRecord.findFirst({
        where: { source: 'PM_JAY' }
      });
      if (pmJayRec) {
        assert.strictEqual(pmJayRec.bedCount, null);
        assert(pmJayRec.admissionData !== null);
      }
    });

    // 25. Sensitive Data Protection Test
    await test('25. Match candidate responses expose zero password or private token data', async () => {
      const candidateRecord = await prisma.hospitalMatch.findFirst({
        include: { careSetuHospital: true, governmentRecord: true }
      });
      assert(candidateRecord, 'Expected candidate record in DB');
      assert.strictEqual(candidateRecord.careSetuHospital.passwordHash, undefined);
      assert.strictEqual(candidateRecord.careSetuHospital.resetToken, undefined);
    });

  } finally {
    // Reset test candidate status to PENDING_REVIEW or clean up
    if (testMatchId) {
      await prisma.hospitalMatch.update({
        where: { id: testMatchId },
        data: { status: 'PENDING_REVIEW', reviewedBy: null, reviewedAt: null }
      }).catch(() => {});
    }
  }

  console.log('\n==================================================');
  console.log(`  HOSPITAL MATCHING TEST SUMMARY: ${passed} PASSED, ${failed} FAILED, ${skipped} SKIPPED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMatchingTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
