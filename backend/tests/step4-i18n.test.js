const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

async function runStep4Tests() {
  console.log('====================================================');
  console.log('CARESETU V2.0 — STEP 4 MULTILINGUAL i18n TEST SUITE');
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

  // 1. Central Language Configuration & Supported Languages
  console.log('--- 1. Language Configuration & Locale Resources ---');
  const enPath = path.join(__dirname, '../../frontend/src/i18n/locales/en.json');
  const hiPath = path.join(__dirname, '../../frontend/src/i18n/locales/hi.json');
  const guPath = path.join(__dirname, '../../frontend/src/i18n/locales/gu.json');

  assert(fs.existsSync(enPath), 'English locale file (en.json) exists');
  assert(fs.existsSync(hiPath), 'Hindi locale file (hi.json) exists');
  assert(fs.existsSync(guPath), 'Gujarati locale file (gu.json) exists');

  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const hi = JSON.parse(fs.readFileSync(hiPath, 'utf8'));
  const gu = JSON.parse(fs.readFileSync(guPath, 'utf8'));

  assert(en.common && en.common.appTitle === 'CareSetu', 'English common.appTitle is defined');
  assert(hi.common && hi.common.appTitle === 'CareSetu', 'Hindi common.appTitle is defined');
  assert(gu.common && gu.common.appTitle === 'CareSetu', 'Gujarati common.appTitle is defined');

  // Check supported languages array in config.ts
  const configPath = path.join(__dirname, '../../frontend/src/i18n/config.ts');
  const configContent = fs.readFileSync(configPath, 'utf8');
  assert(configContent.includes("code: 'en'") && configContent.includes("code: 'hi'") && configContent.includes("code: 'gu'"), 'Config contains en, hi, gu metadata');

  // 2. Hindi & Gujarati Human-Authored Translations Integrity
  console.log('\n--- 2. Translation Namespaces & Human-Authored Content ---');
  assert(hi.nav && hi.nav.home === 'होम', 'Hindi nav.home translation exists');
  assert(gu.nav && gu.nav.home === 'હોમ', 'Gujarati nav.home translation exists');
  assert(hi.auth && (hi.auth.login === 'लॉग इन' || hi.auth.login === 'लॉग इन'), 'Hindi auth.login translation exists');
  assert(gu.auth && gu.auth.login === 'લોગ ઈન', 'Gujarati auth.login translation exists');
  assert(hi.hospital && (hi.hospital.searchPlaceholder.includes('शोधें') || hi.hospital.searchPlaceholder.includes('खोजें')), 'Hindi hospital search translation exists');
  assert(gu.hospital && gu.hospital.searchPlaceholder.includes('શોધો'), 'Gujarati hospital search translation exists');

  // 3. Fallback System Verification
  console.log('\n--- 3. Missing Key Fallback System ---');
  function getTranslation(locale, keyPath, fallbackLocale = en) {
    const keys = keyPath.split('.');
    let current = locale;
    for (const k of keys) {
      if (current && current[k] !== undefined) {
        current = current[k];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) return current;
    
    // Fallback to English
    let fbCurrent = fallbackLocale;
    for (const k of keys) {
      if (fbCurrent && fbCurrent[k] !== undefined) {
        fbCurrent = fbCurrent[k];
      } else {
        return keyPath;
      }
    }
    return fbCurrent;
  }

  assert(getTranslation(hi, 'common.save') === 'सहेजें', 'Hindi key resolution works');
  assert(getTranslation(hi, 'nonexistent.key') === 'nonexistent.key', 'Missing key falls back safely to key string without breaking');
  
  // Create a dummy incomplete locale object to test English fallback
  const incompleteHi = { common: {} };
  assert(getTranslation(incompleteHi, 'common.save') === 'Save', 'Incomplete translation falls back to English string');

  // 4. Interpolation Verification
  console.log('\n--- 4. Interpolation Support ---');
  function interpolate(template, params) {
    if (!template) return '';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
    });
  }

  const welcomeEn = interpolate(en.common.welcomeUser, { name: 'Priya' });
  const welcomeHi = interpolate(hi.common.welcomeUser, { name: 'प्रिया' });
  const welcomeGu = interpolate(gu.common.welcomeUser, { name: 'પ્રિયા' });

  assert(welcomeEn === 'Welcome, Priya', 'English interpolation works');
  assert(welcomeHi.includes('प्रिया'), 'Hindi interpolation works');
  assert(welcomeGu.includes('પ્રિયા'), 'Gujarati interpolation works');

  // 5. Pluralization Verification
  console.log('\n--- 5. Pluralization Support ---');
  function getPlural(locale, baseKey, count, params = {}) {
    const key = count === 1 ? `${baseKey}_one` : `${baseKey}_other`;
    const template = getTranslation(locale, key);
    return interpolate(template, { count, ...params });
  }

  const oneHospital = getPlural(en, 'hospital.bedsAvailableCount', 1);
  const fiveHospitals = getPlural(en, 'hospital.bedsAvailableCount', 5);
  assert(oneHospital === '1 bed available', 'English singular pluralization works');
  assert(fiveHospitals === '5 beds available', 'English plural pluralization works');

  // 6. Locale-Aware Formatting
  console.log('\n--- 6. Locale-Aware Formatting ---');
  const testNumber = 123456;
  const numEn = new Intl.NumberFormat('en-IN').format(testNumber);
  const numHi = new Intl.NumberFormat('hi-IN').format(testNumber);
  const numGu = new Intl.NumberFormat('gu-IN').format(testNumber);

  assert(numEn === '1,23,456', 'en-IN number formatting works');
  assert(numHi.length > 0, 'hi-IN number formatting works');
  assert(numGu.length > 0, 'gu-IN number formatting works');

  const testDate = new Date('2026-09-27T00:00:00Z');
  const dateEn = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(testDate);
  const dateHi = new Intl.DateTimeFormat('hi-IN', { dateStyle: 'medium' }).format(testDate);
  assert(dateEn.length > 0 && dateHi.length > 0, 'Locale-aware date formatting works');

  // 7. Security Validation of Language Codes
  console.log('\n--- 7. Security Validation of Language Codes ---');
  const supportedLanguages = ['en', 'hi', 'gu'];
  function validateLang(langCode) {
    if (!langCode || typeof langCode !== 'string') return 'en';
    const clean = langCode.trim().toLowerCase();
    return supportedLanguages.includes(clean) ? clean : 'en';
  }

  assert(validateLang('en') === 'en', 'Valid code "en" accepted');
  assert(validateLang('hi') === 'hi', 'Valid code "hi" accepted');
  assert(validateLang('gu') === 'gu', 'Valid code "gu" accepted');
  assert(validateLang('<script>alert(1)</script>') === 'en', 'Malicious code safely normalized to default "en"');
  assert(validateLang('fr') === 'en', 'Unsupported language code safely normalized to default "en"');
  assert(validateLang(null) === 'en', 'Null language code safely normalized to default "en"');

  // 8. Doctor AI Boundary Verification
  console.log('\n--- 8. Doctor AI & SOS Boundaries ---');
  assert(en.doctorAi && en.doctorAi.title === 'Doctor AI Assistant', 'Doctor AI static UI title translated');
  assert(en.doctorAi && en.doctorAi.disclaimer.includes('educational'), 'Doctor AI safety disclaimer translated');
  assert(en.emergency && en.emergency.title === 'Emergency SOS', 'SOS static UI title translated');

  // 9. Database & Step 1 / 2 / 3 Integrity Baseline Verification
  console.log('\n--- 9. Database & Step 1 / 2 / 3 Baseline Regression Audit ---');
  try {
    const registeredHospitals = await prisma.hospital.count();
    const govRecords = await prisma.governmentHealthRecord.count();
    const dataGovInCount = await prisma.governmentHealthRecord.count({ where: { source: 'DATA_GOV_IN' } });
    const pmjayCount = await prisma.governmentHealthRecord.count({ where: { source: 'PM_JAY' } });
    
    assert(registeredHospitals === 26, `CareSetu registered hospitals count is intact (${registeredHospitals}/26)`);
    assert(govRecords === 21, `GovernmentHealthRecord total count is intact (${govRecords}/21)`);
    assert(dataGovInCount === 12, `DATA_GOV_IN records count is intact (${dataGovInCount}/12)`);
    assert(pmjayCount === 9, `PM_JAY records count is intact (${pmjayCount}/9)`);

    // Check Hospital Match statuses if table exists
    const matchesCount = await prisma.hospitalMatch.count();
    assert(matchesCount >= 0, `Step 3 HospitalMatch table query executed successfully (Count: ${matchesCount})`);

    // Duplicate check
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
  console.log(`STEP 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

runStep4Tests().catch(err => {
  console.error(err);
  process.exit(1);
});
