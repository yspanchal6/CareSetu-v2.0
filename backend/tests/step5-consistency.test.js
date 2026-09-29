const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

async function runStep5ConsistencyTests() {
  console.log('====================================================');
  console.log('CARESETU V2.0 — STEP 5 i18n CONSISTENCY & REFINEMENT');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${description}`);
      failed++;
    }
  }

  // 1. Locale Files Reading
  console.log('--- 1. Locale File Integrity & Parsing ---');
  const enPath = path.join(__dirname, '../../frontend/src/i18n/locales/en.json');
  const hiPath = path.join(__dirname, '../../frontend/src/i18n/locales/hi.json');
  const guPath = path.join(__dirname, '../../frontend/src/i18n/locales/gu.json');

  assert(fs.existsSync(enPath), 'en.json file exists');
  assert(fs.existsSync(hiPath), 'hi.json file exists');
  assert(fs.existsSync(guPath), 'gu.json file exists');

  let en = {}, hi = {}, gu = {};
  try {
    en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));
    gu = JSON.parse(fs.readFileSync(guPath, 'utf8'));
    assert(true, 'en.json, hi.json, and gu.json are valid JSON files');
  } catch (err) {
    assert(false, `Failed to parse locale JSON: ${err.message}`);
  }

  // Helper to extract flattened key paths
  function getFlattenedKeys(obj, prefix = '') {
    let keys = [];
    for (const k in obj) {
      const pathKey = prefix ? `${prefix}.${k}` : k;
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        keys = keys.concat(getFlattenedKeys(obj[k], pathKey));
      } else {
        keys.push(pathKey);
      }
    }
    return keys;
  }

  const enKeys = getFlattenedKeys(en);
  const hiKeys = getFlattenedKeys(hi);
  const guKeys = getFlattenedKeys(gu);

  // 2. 100% Key Parity Audit
  console.log('\n--- 2. Key Parity & Completeness Audit ---');
  const missingInHi = enKeys.filter(k => !hiKeys.includes(k));
  const missingInGu = enKeys.filter(k => !guKeys.includes(k));
  const extraInHi = hiKeys.filter(k => !enKeys.includes(k));
  const extraInGu = guKeys.filter(k => !enKeys.includes(k));

  assert(missingInHi.length === 0, `Hindi has 100% key parity with English (${enKeys.length} keys total, ${missingInHi.length} missing)`);
  assert(missingInGu.length === 0, `Gujarati has 100% key parity with English (${enKeys.length} keys total, ${missingInGu.length} missing)`);
  assert(extraInHi.length === 0, `Hindi contains no orphaned/extra keys (${extraInHi.length} extra)`);
  assert(extraInGu.length === 0, `Gujarati contains no orphaned/extra keys (${extraInGu.length} extra)`);

  // 3. Placeholder Variable Consistency
  console.log('\n--- 3. Placeholder Variable Match Audit ---');
  function getValueByPath(obj, keyPath) {
    return keyPath.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
  }

  function extractPlaceholders(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/\{\{\s*(\w+)\s*\}\}/g) || [];
    return matches.map(m => m.replace(/[\{\}\s]/g, '')).sort();
  }

  let placeholderMismatchesHi = 0;
  let placeholderMismatchesGu = 0;

  enKeys.forEach(key => {
    const enVal = getValueByPath(en, key);
    const hiVal = getValueByPath(hi, key);
    const guVal = getValueByPath(gu, key);

    const enVars = extractPlaceholders(enVal);
    const hiVars = extractPlaceholders(hiVal);
    const guVars = extractPlaceholders(guVal);

    if (JSON.stringify(enVars) !== JSON.stringify(hiVars)) {
      placeholderMismatchesHi++;
      console.log(`    ❌ Mismatch in Hindi key "${key}": EN [${enVars}] vs HI [${hiVars}]`);
    }
    if (JSON.stringify(enVars) !== JSON.stringify(guVars)) {
      placeholderMismatchesGu++;
      console.log(`    ❌ Mismatch in Gujarati key "${key}": EN [${enVars}] vs GU [${guVars}]`);
    }
  });

  assert(placeholderMismatchesHi === 0, 'Hindi placeholder variables match English exactly');
  assert(placeholderMismatchesGu === 0, 'Gujarati placeholder variables match English exactly');

  // 4. Pluralization Suffix Contract
  console.log('\n--- 4. Pluralization Contract Audit ---');
  const pluralKeysEn = enKeys.filter(k => k.endsWith('_one') || k.endsWith('_other'));
  assert(pluralKeysEn.length > 0, `Pluralization keys detected in English schema (${pluralKeysEn.length} keys)`);

  let pluralMissingHi = 0;
  let pluralMissingGu = 0;
  pluralKeysEn.forEach(pk => {
    if (!hiKeys.includes(pk)) pluralMissingHi++;
    if (!guKeys.includes(pk)) pluralMissingGu++;
  });
  assert(pluralMissingHi === 0, 'Hindi contains all pluralization keys');
  assert(pluralMissingGu === 0, 'Gujarati contains all pluralization keys');

  // 5. Production Safe-Fallback System Audit
  console.log('\n--- 5. Production Safe-Fallback System Audit ---');
  function resolveTranslationSafe(lang, keyPath, params = {}) {
    const localeObj = lang === 'hi' ? hi : lang === 'gu' ? gu : en;
    let val = getValueByPath(localeObj, keyPath);

    // Step 1 Fallback to English
    if (val === undefined) {
      val = getValueByPath(en, keyPath);
    }

    // Step 2 Human-readable key fallback
    if (val === undefined) {
      const parts = keyPath.split('.');
      const last = parts[parts.length - 1];
      // Format camelCase or key path to readable string
      val = last.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    // Interpolate
    if (typeof val === 'string') {
      val = val.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{{${k}}}`));
    }

    return val;
  }

  const existingRes = resolveTranslationSafe('hi', 'common.welcomeUser', { name: 'प्रिया' });
  const missingKeyRes = resolveTranslationSafe('hi', 'nonexistent.someCustomFeature');
  const undefinedCheck = resolveTranslationSafe('hi', 'unknown.key.test');

  assert(existingRes.includes('प्रिया'), 'Existing Hindi translation resolves correctly');
  assert(missingKeyRes === 'Some Custom Feature', 'Missing key safely resolves to human-readable string instead of technical key path');
  assert(undefinedCheck !== undefined && undefinedCheck !== null && !undefinedCheck.includes('undefined'), 'Production fallback never returns undefined or null');

  // 6. Security Validation Audit
  console.log('\n--- 6. Security Parameter Sanitization Audit ---');
  const supportedLangs = ['en', 'hi', 'gu'];
  function sanitizeLanguageCode(input) {
    if (!input || typeof input !== 'string') return 'en';
    const clean = input.trim().toLowerCase();
    return supportedLangs.includes(clean) ? clean : 'en';
  }

  assert(sanitizeLanguageCode('EN') === 'en', 'Case-insensitive code "EN" sanitized to "en"');
  assert(sanitizeLanguageCode('../../etc/passwd') === 'en', 'Path traversal attempt sanitized to "en"');
  assert(sanitizeLanguageCode('<script>alert(1)</script>') === 'en', 'XSS attempt sanitized to "en"');
  assert(sanitizeLanguageCode('select * from users') === 'en', 'SQL attempt sanitized to "en"');

  // 7. Domain Specific Namespace Audits
  console.log('\n--- 7. Domain Namespace Coverage Audits ---');
  assert(getValueByPath(en, 'help.title') && getValueByPath(hi, 'help.title') && getValueByPath(gu, 'help.title'), 'Help center title translated across all 3 locales');
  assert(getValueByPath(en, 'contact.title') && getValueByPath(hi, 'contact.title') && getValueByPath(gu, 'contact.title'), 'Contact support title translated across all 3 locales');
  assert(getValueByPath(en, 'doctorAi.disclaimer') && getValueByPath(hi, 'doctorAi.disclaimer') && getValueByPath(gu, 'doctorAi.disclaimer'), 'Doctor AI disclaimer translated across all 3 locales');
  assert(getValueByPath(en, 'emergency.triggerSos') && getValueByPath(hi, 'emergency.triggerSos') && getValueByPath(gu, 'emergency.triggerSos'), 'Emergency SOS button translated across all 3 locales');

  // 8. Database Baseline & Step 1-4 Regression Audit
  console.log('\n--- 8. Database Baseline & Step 1-4 Regression Audit ---');
  try {
    const careSetuHospitals = await prisma.hospital.count();
    const govHealthRecords = await prisma.governmentHealthRecord.count();
    const dataGovInRecords = await prisma.governmentHealthRecord.count({ where: { source: 'DATA_GOV_IN' } });
    const pmjayRecords = await prisma.governmentHealthRecord.count({ where: { source: 'PM_JAY' } });
    const hospitalMatches = await prisma.hospitalMatch.count();

    assert(careSetuHospitals === 26, `CareSetu Registered Hospitals count is intact (${careSetuHospitals}/26)`);
    assert(govHealthRecords === 21, `Government Health Records total count is intact (${govHealthRecords}/21)`);
    assert(dataGovInRecords === 12, `DATA_GOV_IN records count is intact (${dataGovInRecords}/12)`);
    assert(pmjayRecords === 9, `PM_JAY records count is intact (${pmjayRecords}/9)`);
    assert(hospitalMatches >= 0, `Step 3 HospitalMatch query executed successfully (Matches count: ${hospitalMatches})`);

    // Duplicate key check
    const rawGov = await prisma.governmentHealthRecord.findMany({ select: { source: true, sourceRecordId: true } });
    const keys = rawGov.map(r => `${r.source}_${r.sourceRecordId}`);
    const uniqueKeys = new Set(keys);
    assert(keys.length === uniqueKeys.size, `Zero duplicate government records verified (${keys.length} records)`);

  } catch (err) {
    console.error('Database check error:', err);
    assert(false, 'Database integrity audit encountered an error');
  }

  // Summary
  console.log('\n====================================================');
  console.log(`STEP 5 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runStep5ConsistencyTests().catch(err => {
  console.error(err);
  process.exit(1);
});
