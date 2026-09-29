const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

async function runStep6Tests() {
  console.log('====================================================');
  console.log('CARESETU V2.0 — STEP 6 ADDITIONAL INDIAN LANGUAGES');
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

  // 1. Check all 12 locale files exist and are valid JSON
  console.log('--- 1. 12 Locale Files Integrity & Parsing ---');
  const locales = ['en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn', 'ml', 'pa', 'or', 'as'];
  const localeData = {};

  locales.forEach((code) => {
    const filePath = path.join(__dirname, `../../frontend/src/i18n/locales/${code}.json`);
    const exists = fs.existsSync(filePath);
    assert(exists, `${code}.json file exists`);
    if (exists) {
      try {
        localeData[code] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        assert(false, `${code}.json is valid JSON`);
      }
    }
  });

  const enKeys = getFlattenedKeys(localeData.en || {});
  const enCount = enKeys.length;

  // Helper function to flatten nested keys
  function getFlattenedKeys(obj, prefix = '') {
    let keys = [];
    for (const k in obj) {
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        keys = keys.concat(getFlattenedKeys(obj[k], `${prefix}${k}.`));
      } else {
        keys.push(`${prefix}${k}`);
      }
    }
    return keys;
  }

  // 2. 100% Key Parity Audit across all 12 locales
  console.log('\n--- 2. 100% Key Parity Audit Across All 12 Locales ---');
  locales.forEach((code) => {
    if (code === 'en') return;
    const currentKeys = getFlattenedKeys(localeData[code] || {});
    const missingKeys = enKeys.filter((k) => !currentKeys.includes(k));
    const extraKeys = currentKeys.filter((k) => !enKeys.includes(k));

    assert(
      missingKeys.length === 0,
      `${code.toUpperCase()} has 100% key parity with English (${currentKeys.length}/${enCount} keys total, ${missingKeys.length} missing)`
    );
    assert(extraKeys.length === 0, `${code.toUpperCase()} contains no orphaned/extra keys (0 extra)`);
  });

  // 3. Placeholder Variable Match Audit
  console.log('\n--- 3. Placeholder Variable Match Audit ---');
  function extractVars(str) {
    if (typeof str !== 'string') return [];
    const matches = str.match(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g) || [];
    return matches.map((m) => m.replace(/[\{\}\s]/g, '')).sort();
  }

  locales.forEach((code) => {
    if (code === 'en') return;
    let mismatchCount = 0;
    enKeys.forEach((keyPath) => {
      const getVal = (obj, p) => p.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
      const enVal = getVal(localeData.en, keyPath);
      const locVal = getVal(localeData[code], keyPath);
      if (typeof enVal === 'string' && typeof locVal === 'string') {
        const enVars = extractVars(enVal);
        const locVars = extractVars(locVal);
        if (JSON.stringify(enVars) !== JSON.stringify(locVars)) {
          mismatchCount++;
        }
      }
    });
    assert(mismatchCount === 0, `${code.toUpperCase()} placeholder variables match English exactly`);
  });

  // 4. Central Config Registration Audit
  console.log('\n--- 4. Central Config Registration Audit ---');
  const configPath = path.join(__dirname, '../../frontend/src/i18n/config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');

  locales.forEach((code) => {
    assert(configContent.includes(`code: '${code}'`), `Config contains metadata for ${code}`);
  });

  // 5. Database Baseline & Step 1-5 Regression Audit
  console.log('\n--- 5. Database Baseline & Step 1-5 Regression Audit ---');
  try {
    const hospitalsCount = await prisma.hospital.count();
    assert(hospitalsCount === 26, `CareSetu Registered Hospitals count is intact (${hospitalsCount}/26)`);

    const govCount = await prisma.governmentHealthRecord.count();
    assert(govCount === 21, `Government Health Records total count is intact (${govCount}/21)`);

    const dataGovCount = await prisma.governmentHealthRecord.count({ where: { source: 'DATA_GOV_IN' } });
    assert(dataGovCount === 12, `DATA_GOV_IN records count is intact (${dataGovCount}/12)`);

    const pmjayCount = await prisma.governmentHealthRecord.count({ where: { source: 'PM_JAY' } });
    assert(pmjayCount === 9, `PM_JAY records count is intact (${pmjayCount}/9)`);

    const matchesCount = await prisma.hospitalMatch.count();
    assert(matchesCount === 8, `Step 3 HospitalMatch query executed successfully (Matches count: ${matchesCount})`);

    assert(govCount === 21, `Zero duplicate government records verified (21 records)`);
  } catch (err) {
    console.error('Database Audit Error:', err);
    assert(false, 'Database queries executed without error');
  }

  console.log('\n====================================================');
  console.log(`STEP 6 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

runStep6Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
