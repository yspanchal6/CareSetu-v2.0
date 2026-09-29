const { HospitalDirectoryService } = require('../src/services/hospital-directory.service');

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ PASS: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  } else {
    failCount++;
    console.error(`  ❌ FAIL: ${testName} ${detail ? '(' + detail + ')' : ''}`);
  }
}

async function runStep2DirectoryTests() {
  console.log('==================================================');
  console.log('  RUNNING STEP 2 ENHANCED HOSPITAL DIRECTORY TESTS  ');
  console.log('==================================================\n');

  try {
    // Test 1: CareSetu registered hospital retrieval
    const resReg = await HospitalDirectoryService.getDirectory({ source: 'CARESETU_REGISTERED', limit: 50 });
    assert(resReg.data.length > 0 && resReg.data.every(r => r.sourceType === 'CARESETU_REGISTERED'), '1. CareSetu registered hospital retrieval', `Retrieved ${resReg.data.length} records`);

    // Test 2: Government hospital retrieval
    const resGov = await HospitalDirectoryService.getDirectory({ source: 'GOVERNMENT_DATA', limit: 50 });
    assert(resGov.data.length > 0 && resGov.data.every(r => r.sourceType === 'GOVERNMENT_DATA'), '2. Government hospital retrieval', `Retrieved ${resGov.data.length} records`);

    // Test 3: Combined CareSetu + Government directory
    const resCombined = await HospitalDirectoryService.getDirectory({ source: 'ALL', limit: 100 });
    const hasReg = resCombined.data.some(r => r.sourceType === 'CARESETU_REGISTERED');
    const hasGov = resCombined.data.some(r => r.sourceType === 'GOVERNMENT_DATA');
    assert(hasReg && hasGov && resCombined.data.length === (resReg.data.length + resGov.data.length), '3. Combined CareSetu + Government directory', `Total combined: ${resCombined.data.length}`);

    // Test 4: Hospital name search
    const resNameSearch = await HospitalDirectoryService.getDirectory({ search: 'Civil' });
    assert(resNameSearch.data.length > 0 && resNameSearch.data.every(r => r.hospitalName.toLowerCase().includes('civil') || r.district.toLowerCase().includes('civil') || r.state.toLowerCase().includes('civil')), '4. Hospital name search', `Search "Civil" matched ${resNameSearch.data.length} records`);

    // Test 5: State search/filter
    const resStateFilter = await HospitalDirectoryService.getDirectory({ state: 'Gujarat' });
    assert(resStateFilter.data.length > 0 && resStateFilter.data.every(r => r.state.toLowerCase() === 'gujarat'), '5. State search/filter', `State "Gujarat" matched ${resStateFilter.data.length} records`);

    // Test 6: District search/filter
    const resDistrictFilter = await HospitalDirectoryService.getDirectory({ state: 'Gujarat', district: 'Ahmedabad' });
    assert(resDistrictFilter.data.length > 0 && resDistrictFilter.data.every(r => r.district.toLowerCase() === 'ahmedabad'), '6. District search/filter', `District "Ahmedabad" matched ${resDistrictFilter.data.length} records`);

    // Test 7: Hospital type filter
    const resTypeFilter = await HospitalDirectoryService.getDirectory({ type: 'District Hospital' });
    assert(resTypeFilter.data.length > 0 && resTypeFilter.data.every(r => r.hospitalType.toLowerCase().includes('district hospital')), '7. Hospital type filter', `Type "District Hospital" matched ${resTypeFilter.data.length} records`);

    // Test 8: Source filter
    const resSourceGov = await HospitalDirectoryService.getDirectory({ source: 'GOVERNMENT_DATA' });
    assert(resSourceGov.data.length > 0 && resSourceGov.data.every(r => r.sourceType === 'GOVERNMENT_DATA'), '8. Source filter', `Source "GOVERNMENT_DATA" matched ${resSourceGov.data.length} records`);

    // Test 9: Combined filters
    const resMultiFilter = await HospitalDirectoryService.getDirectory({
      state: 'Gujarat',
      district: 'Ahmedabad',
      source: 'GOVERNMENT_DATA',
      type: 'District Hospital'
    });
    assert(resMultiFilter.data.length > 0 && resMultiFilter.data.every(r => r.state.toLowerCase() === 'gujarat' && r.district.toLowerCase() === 'ahmedabad' && r.sourceType === 'GOVERNMENT_DATA'), '9. Combined filters', `Multi-filter matched ${resMultiFilter.data.length} records`);

    // Test 10: Server-side pagination
    const page1 = await HospitalDirectoryService.getDirectory({ page: 1, limit: 5 });
    const page2 = await HospitalDirectoryService.getDirectory({ page: 2, limit: 5 });
    const p1Ids = new Set(page1.data.map(r => r.id));
    const overlap = page2.data.filter(r => p1Ids.has(r.id));
    assert(page1.data.length === 5 && page2.data.length === 5 && overlap.length === 0, '10. Server-side pagination', `Page 1: ${page1.data.length}, Page 2: ${page2.data.length}, Overlap: ${overlap.length}`);

    // Test 11: Pagination boundaries
    const pageOutOfBounds = await HospitalDirectoryService.getDirectory({ page: 9999, limit: 10 });
    assert(pageOutOfBounds.data.length === 0 && pageOutOfBounds.pagination.total > 0, '11. Pagination boundaries', `Page 9999 returned ${pageOutOfBounds.data.length} items out of ${pageOutOfBounds.pagination.total}`);

    // Test 12: Sorting (name_asc vs name_desc)
    const sortAsc = await HospitalDirectoryService.getDirectory({ sort: 'name_asc', limit: 10 });
    const sortDesc = await HospitalDirectoryService.getDirectory({ sort: 'name_desc', limit: 10 });
    const firstAscName = sortAsc.data[0].hospitalName;
    const firstDescName = sortDesc.data[0].hospitalName;
    assert(firstAscName !== firstDescName, '12. Sorting', `ASC first: "${firstAscName}", DESC first: "${firstDescName}"`);

    // Test 13: Invalid sorting input
    const invalidSort = await HospitalDirectoryService.getDirectory({ sort: 'invalid_sort_clause_drop_table', limit: 5 });
    assert(invalidSort.data.length > 0, '13. Invalid sorting input fallback', `Handled invalid sort safely, returned ${invalidSort.data.length} records`);

    // Test 14: Hospital details lookup
    const sampleItem = resCombined.data[0];
    const details = await HospitalDirectoryService.getDirectoryById(sampleItem.id);
    assert(details && details.id === sampleItem.id && details.hospitalName === sampleItem.hospitalName, '14. Hospital details lookup', `Retrieved details for ID ${sampleItem.id}`);

    // Test 15: Source metadata
    const sampleGov = resGov.data[0];
    assert(Boolean(sampleGov.licenseInfo) && sampleGov.licenseInfo.includes('Government Open Data License'), '15. Source metadata preservation', `License: ${sampleGov.licenseInfo}`);

    // Test 16: Missing optional fields handling
    const sampleWithMissing = resGov.data.find(r => r.address === null || r.pincode === null);
    assert(sampleWithMissing !== undefined, '16. Missing optional fields handling', `Record ${sampleWithMissing?.id} safely handled null address/pincode`);

    // Test 17: Records without coordinates
    const recordsWithoutCoords = resGov.data.filter(r => r.latitude === null || r.longitude === null);
    assert(recordsWithoutCoords.length > 0, '17. Records without coordinates handling', `Found ${recordsWithoutCoords.length} government records without GPS coordinates cleanly represented as null`);

    // Test 18: Duplicate government records prevention
    const govIds = resGov.data.map(r => r.sourceRecordId);
    const uniqueGovIds = new Set(govIds);
    assert(govIds.length === uniqueGovIds.size, '18. Duplicate government records check', `All ${govIds.length} sourceRecordIds are unique`);

    // Test 19: CareSetu/Government record separation
    const invalidMixing = resCombined.data.filter(r => (r.sourceType === 'CARESETU_REGISTERED' && r.source !== 'CARESETU') || (r.sourceType === 'GOVERNMENT_DATA' && r.source === 'CARESETU'));
    assert(invalidMixing.length === 0, '19. CareSetu/Government record separation', `0 mixed/corrupted records found out of ${resCombined.data.length}`);

    console.log('\n==================================================');
    console.log(`  DIRECTORY TESTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED`);
    console.log('==================================================');

    process.exit(failCount === 0 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ DIRECTORY TEST FATAL ERROR:', err);
    process.exit(1);
  }
}

runStep2DirectoryTests();
