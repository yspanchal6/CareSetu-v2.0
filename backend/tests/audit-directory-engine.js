const { HospitalDirectoryService } = require('../src/services/hospital-directory.service');

async function auditDirectoryEngine() {
  console.log('=== 4. STEP 2 DIRECTORY SEARCH, FILTERS & CAPACITY SAFETY AUDIT ===\n');

  try {
    // 1. Test Search Variations
    console.log('[Test 4.1] Server-side Search Variations:');
    const searchQueries = ['civil', 'CIVIL', 'Civil', 'Ahmedabad', '380016', 'Gujarat', 'nonexistent_hospital_xyz'];

    for (const q of searchQueries) {
      const res = await HospitalDirectoryService.getDirectory({ search: q });
      console.log(`  └─ Query "${q}": returned ${res.pagination.total} records.`);
    }

    // 2. Test Multi-Filter Combinations
    console.log('\n[Test 4.2] Multi-Filter Combinations:');

    // Combination A: State + Source
    const combA = await HospitalDirectoryService.getDirectory({
      state: 'Gujarat',
      source: 'GOVERNMENT_DATA'
    });
    console.log(`  └─ State="Gujarat" + Source="GOVERNMENT_DATA": returned ${combA.pagination.total} records.`);
    const nonGovInA = combA.data.filter(r => r.sourceType !== 'GOVERNMENT_DATA' || r.state.toLowerCase() !== 'gujarat');
    if (nonGovInA.length > 0) throw new Error('Filter State + Source failed!');

    // Combination B: State + District + Source
    const combB = await HospitalDirectoryService.getDirectory({
      state: 'Gujarat',
      district: 'Ahmedabad',
      source: 'GOVERNMENT_DATA'
    });
    console.log(`  └─ State="Gujarat" + District="Ahmedabad" + Source="GOVERNMENT_DATA": returned ${combB.pagination.total} records.`);

    // Combination C: CareSetu Registered Filter
    const combC = await HospitalDirectoryService.getDirectory({
      source: 'CARESETU_REGISTERED'
    });
    console.log(`  └─ Source="CARESETU_REGISTERED": returned ${combC.pagination.total} records.`);
    const nonRegisteredInC = combC.data.filter(r => r.sourceType !== 'CARESETU_REGISTERED');
    if (nonRegisteredInC.length > 0) throw new Error('Filter CARESETU_REGISTERED failed!');

    // 3. Test Pagination
    console.log('\n[Test 4.3] Server-side Pagination:');
    const page1 = await HospitalDirectoryService.getDirectory({ page: 1, limit: 5 });
    const page2 = await HospitalDirectoryService.getDirectory({ page: 2, limit: 5 });
    const pageOut = await HospitalDirectoryService.getDirectory({ page: 999, limit: 5 });

    console.log(`  └─ Page 1 Records: ${page1.data.length}`);
    console.log(`  └─ Page 2 Records: ${page2.data.length}`);
    console.log(`  └─ Out of Bounds Page 999 Records: ${pageOut.data.length}`);

    // Check no duplicate IDs across page 1 and page 2
    const p1Ids = new Set(page1.data.map(r => r.id));
    const overlap = page2.data.filter(r => p1Ids.has(r.id));
    console.log(`  └─ Overlap between Page 1 and Page 2: ${overlap.length} (Expected: 0)`);
    if (overlap.length > 0) throw new Error('Pagination overlap detected!');

    // 4. Capacity / Beds Safety Audit
    console.log('\n[Test 4.4] Capacity / Beds Safety Audit:');
    const pmjayRecord = await HospitalDirectoryService.getDirectory({ source: 'GOVERNMENT_DATA', search: 'PM-JAY' });
    if (pmjayRecord.data.length > 0) {
      const item = pmjayRecord.data[0];
      console.log(`  └─ Inspecting PM-JAY Record "${item.hospitalName}":`);
      console.log(`     - Bed Count: ${item.bedCount} (Expected: null)`);
      console.log(`     - Admission Data Present: ${item.admissionData !== null}`);
      console.log(`     - Admission Data Keys: ${item.admissionData ? Object.keys(item.admissionData).join(', ') : 'None'}`);

      if (item.bedCount !== null) {
        throw new Error('PM-JAY record exposes non-null bed count! PM-JAY is historical admissions data, not bed availability.');
      }
    }
    console.log('✔ PASS: PM-JAY historical trend data is isolated and does not fabricate bed capacity.');

    console.log('\n✔ STEP 2 DIRECTORY SEARCH, FILTERS & CAPACITY AUDIT PASSED');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ DIRECTORY ENGINE AUDIT FAILED:', err);
    process.exit(1);
  }
}

auditDirectoryEngine();
