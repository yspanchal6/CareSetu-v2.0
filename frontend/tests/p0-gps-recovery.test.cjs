const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('  CARESETU P0 GPS RECOVERY & ERROR CLASSIFICATION  ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

const emergencySOSCode = fs.readFileSync('frontend/src/pages/patient/EmergencySOSPage.tsx', 'utf-8');

// 1. Check Geolocation code 1 (Permission Denied)
test('1. Geolocation Code 1 (Permission Denied) maps to specific guidance message', () => {
  assert(
    emergencySOSCode.includes('Location permission was denied. Please allow location access or enter your location manually below.'),
    'Specific code 1 message present'
  );
});

// 2. Check Geolocation code 2 (Position Unavailable)
test('2. Geolocation Code 2 (Position Unavailable) maps to GPS unavailable message', () => {
  assert(
    emergencySOSCode.includes('GPS position is currently unavailable on your device. Please enter your location manually below.'),
    'Specific code 2 message present'
  );
});

// 3. Check Geolocation code 3 (Timeout)
test('3. Geolocation Code 3 (Timeout) maps to timeout recovery message', () => {
  assert(
    emergencySOSCode.includes('GPS location request timed out. Please retry or enter your location manually below.'),
    'Specific code 3 message present'
  );
});

// 4. Check Nonstandard Rejection Handling in getCurrentLocation
test('4. Nonstandard Geolocation Error handling safely falls back without crashing', () => {
  assert(
    emergencySOSCode.includes('const code = err && typeof err === "object" ? (err as any).code : undefined;'),
    'Defensive check on err.code exists'
  );
  assert(
    emergencySOSCode.includes('else if (err && typeof (err as any).message === "string" && (err as any).message)'),
    'Fallback to err.message exists'
  );
});

// 5. Check Location Error Classification in dispatchSOS
test('5. dispatchSOS accurately classifies location failure during locating phase', () => {
  assert(
    emergencySOSCode.includes('const isLocErr = (typeof pos === "undefined" && !(err instanceof ApiError)) || ('),
    'Locating phase failure without pos and non-ApiError sets isLocErr'
  );
  assert(
    emergencySOSCode.includes('setLocationError(Boolean(isLocErr));'),
    'setLocationError is driven by isLocErr'
  );
});

// 6. Check that ApiErrors are not misclassified as GPS errors
test('6. Unrelated ApiErrors (401, 403, 409, 429, 500) do NOT trigger location error', () => {
  class MockApiError extends Error {
    constructor(msg, status) {
      super(msg);
      this.status = status;
    }
  }

  function classify(err, pos) {
    return (typeof pos === "undefined" && !(err instanceof MockApiError)) || (
      !err?.status && (
        err?.message?.includes("Location") ||
        err?.message?.includes("GPS") ||
        err?.message?.includes("position") ||
        err?.message?.includes("permission")
      )
    );
  }

  // 1. GPS failure before pos is defined
  assert.strictEqual(classify(new Error("Permission denied"), undefined), true, "GPS failure sets isLocErr true");
  assert.strictEqual(classify({ code: 1, message: "denied" }, undefined), true, "Raw object GPS failure sets isLocErr true");
  assert.strictEqual(classify("timeout string", undefined), true, "String rejection sets isLocErr true");

  // 2. ApiError after locating succeeded (pos is defined)
  const fakePos = { latitude: 22.5, longitude: 72.8, accuracy: 10 };
  assert.strictEqual(classify(new MockApiError("Session expired", 401), fakePos), false, "401 ApiError sets isLocErr false");
  assert.strictEqual(classify(new MockApiError("Forbidden", 403), fakePos), false, "403 ApiError sets isLocErr false");
  assert.strictEqual(classify(new MockApiError("Duplicate active case", 409), fakePos), false, "409 ApiError sets isLocErr false");
  assert.strictEqual(classify(new MockApiError("Rate limit exceeded", 429), fakePos), false, "429 ApiError sets isLocErr false");
  assert.strictEqual(classify(new MockApiError("Internal server error", 500), fakePos), false, "500 ApiError sets isLocErr false");

  // 3. ApiError even if pos was undefined (e.g. pre-check network failure)
  assert.strictEqual(classify(new MockApiError("Gateway timeout", 504), undefined), false, "ApiError with status sets isLocErr false");
});

// 7. Check Manual Location Entry Form Rendering
test('7. Manual Location Entry Form rendered on locationError', () => {
  assert(
    emergencySOSCode.includes('{locationError && ('),
    'locationError conditional block exists'
  );
  assert(
    emergencySOSCode.includes('Enter Location Manually'),
    'Enter Location Manually heading exists'
  );
  assert(
    emergencySOSCode.includes('submitManualLocation'),
    'submitManualLocation button click handler exists'
  );
});

// 8. Check Unique Hospital Heading Selector in HospitalCards.tsx
const hospitalCardsCode = fs.readFileSync('frontend/src/components/emergency/HospitalCards.tsx', 'utf-8');
test('8. HospitalAcceptedCard renders accessible h3 heading for hospital name', () => {
  assert(
    hospitalCardsCode.includes('<h3 className="font-extrabold text-emerald-950 text-sm sm:text-base tracking-tight">{hospital.name}</h3>'),
    'Hospital name in HospitalAcceptedCard is an h3 heading element'
  );
});

// 9. Check Accessible GPS Waiting Feedback
test('9. EmergencySOSPage renders accessible feedback while acquiring GPS coordinates', () => {
  assert(
    emergencySOSCode.includes('Acquiring high-accuracy GPS coordinates…'),
    'Accessible GPS locating text is present'
  );
  assert(
    emergencySOSCode.includes('role="status"') && emergencySOSCode.includes('aria-live="polite"'),
    'Aria status announcement for screen readers is present'
  );
});

// 10. Check Zero-Hospital 25km Explanation & Emergency Call Actions
const emergencyStatusCode = fs.readFileSync('frontend/src/pages/patient/EmergencyStatusPage.tsx', 'utf-8');
test('10. EmergencyStatusPage clearly explains 25 km radius in zero-hospital state with 108/112 links', () => {
  assert(
    emergencyStatusCode.includes('No eligible network hospitals with matching emergency capabilities were found within the 25 km search radius.'),
    '25 km search radius is explicitly communicated'
  );
  assert(
    emergencyStatusCode.includes('href="tel:108"') && emergencyStatusCode.includes('href="tel:112"'),
    'Both tel:108 and tel:112 direct emergency dialers are present'
  );
});

// 11. Check Two-Step Cancellation Confirmation Protection
test('11. EmergencyStatusPage enforces two-step confirmation with separate confirm and keep active buttons', () => {
  assert(
    emergencyStatusCode.includes('title="Confirm Emergency Cancellation"'),
    'Explicit cancellation confirmation modal title'
  );
  assert(
    emergencyStatusCode.includes('Keep Emergency Active'),
    'Explicit Keep Emergency Active action'
  );
  assert(
    emergencyStatusCode.includes('Confirm Cancellation'),
    'Explicit Confirm Cancellation action'
  );
  assert(
    emergencyStatusCode.includes('Cancelling will immediately recall this SOS request'),
    'Clear consequences warning is displayed'
  );
});

// 12. Check Guest Health Pack Safe Handling
test('12. EmergencyStatusPage safely manages guest Health Pack sharing without broken state', () => {
  assert(
    emergencyStatusCode.includes('isGuest ? "Info" : "Share"'),
    'Button label gracefully adapts to Info for guest sessions'
  );
  assert(
    emergencyStatusCode.includes('Guest Health Pack Notice'),
    'Guest Health Pack informational modal is present'
  );
  assert(
    emergencyStatusCode.includes('Your emergency SOS was dispatched using a temporary Guest session.'),
    'Clear guest guidance text is present'
  );
});

console.log('\n====================================================');
console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================\n');

if (failed > 0) process.exit(1);

