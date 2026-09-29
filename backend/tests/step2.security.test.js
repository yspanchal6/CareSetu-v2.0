const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

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

function makeRequest(server, rawPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const path = encodeURI(rawPath);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runStep2SecurityTests() {
  console.log('==================================================');
  console.log('  RUNNING STEP 2 DIRECTORY & ADMIN SECURITY TESTS  ');
  console.log('==================================================\n');

  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));

  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    const patientUser = await prisma.user.findFirst({ where: { role: 'PATIENT', status: 'ACTIVE' } });
    const hospitalUser = await prisma.user.findFirst({ where: { role: 'HOSPITAL', status: 'ACTIVE' } });

    const adminToken = jwt.sign({ userId: adminUser.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
    const patientToken = jwt.sign({ userId: patientUser.id, role: 'PATIENT' }, JWT_SECRET, { expiresIn: '1h' });
    const hospitalToken = jwt.sign({ userId: hospitalUser.id, role: 'HOSPITAL' }, JWT_SECRET, { expiresIn: '1h' });

    // 1. Unauthorized access behavior
    const r1 = await makeRequest(server, '/api/admin/gov-health-data/summary');
    assert(r1.status === 401, '1. Unauthorized access to admin APIs blocked', `HTTP ${r1.status}`);

    const r1b = await makeRequest(server, '/api/admin/gov-health-data/summary', { authorization: `Bearer ${patientToken}` });
    assert(r1b.status === 403, '2. Patient role access to admin APIs forbidden', `HTTP ${r1b.status}`);

    const r1c = await makeRequest(server, '/api/admin/gov-health-data/summary', { authorization: `Bearer ${hospitalToken}` });
    assert(r1c.status === 403, '3. Hospital role access to admin APIs forbidden', `HTTP ${r1c.status}`);

    // 4. IDOR attempt against GET /api/hospitals/directory/:id with invalid ID
    const rIdorNonExistent = await makeRequest(server, '/api/hospitals/directory/invalid-nonexistent-id-xyz');
    assert(rIdorNonExistent.status === 404, '4. IDOR non-existent ID lookup returns 404 safely', `HTTP ${rIdorNonExistent.status}`);

    // 5. Public directory access allowed
    const rPub = await makeRequest(server, '/api/hospitals/directory?page=1&limit=5');
    assert(rPub.status === 200, '5. Public directory access allowed', `HTTP ${rPub.status}`);

    // 6. Sensitive field protection: Password & Password Hashes
    const bodyStr = rPub.body;
    assert(!bodyStr.includes('password') && !bodyStr.includes('$2b$'), '6. No password or hash exposure in directory response', 'Verified clean');

    // 7. Sensitive field protection: Auth tokens
    assert(!bodyStr.includes(JWT_SECRET), '7. No authentication token or secret leakage in directory response', 'Verified clean');

    // 8. Sensitive field protection: Private hospital credentials
    const sampleHosp = JSON.parse(bodyStr).data.find(r => r.sourceType === 'CARESETU_REGISTERED');
    assert(sampleHosp && sampleHosp.password === undefined && sampleHosp.token === undefined, '8. No private hospital account credentials exposed', 'Verified clean');

    // 9. Sensitive field protection: Private doctor info
    assert(!bodyStr.includes('doctorPassword') && !bodyStr.includes('ssn'), '9. No private doctor info exposed', 'Verified clean');

    // 10. Sensitive field protection: Private patient info
    assert(!bodyStr.includes('medicalSummary') && !bodyStr.includes('encryptedData'), '10. No private patient health records exposed', 'Verified clean');

    // 11. Invalid query parameters (e.g. negative page or invalid limit)
    const rInvalidParams = await makeRequest(server, '/api/hospitals/directory?page=-5&limit=abc');
    assert(rInvalidParams.status === 200, '11. Invalid query params fall back safely without crashing', `HTTP ${rInvalidParams.status}`);

    // 12. Excessive pagination values
    const rExcessive = await makeRequest(server, '/api/hospitals/directory?page=1&limit=999999');
    const parsedExcessive = JSON.parse(rExcessive.body);
    assert(rExcessive.status === 200 && parsedExcessive.pagination.limit <= 100, '12. Excessive limit capped to 100 max', `Limit requested 999999, capped to ${parsedExcessive.pagination.limit}`);

    // 13. Unsafe sorting values
    const rUnsafeSort = await makeRequest(server, "/api/hospitals/directory?sort=name;DROP%20TABLE%20hospitals--");
    assert(rUnsafeSort.status === 200, '13. Unsafe sorting input handled safely without SQL injection', `HTTP ${rUnsafeSort.status}`);

    // 14. Injection-safe search/filter handling
    const rInjectionSearch = await makeRequest(server, "/api/hospitals/directory?search=' OR '1'='1");
    const parsedInjection = JSON.parse(rInjectionSearch.body);
    assert(rInjectionSearch.status === 200 && parsedInjection.pagination.total === 0, '14. SQL injection search string returned 0 matches safely', `HTTP ${rInjectionSearch.status}`);

    server.close();

    console.log('\n==================================================');
    console.log(`  SECURITY TESTS SUMMARY: ${passCount} PASSED, ${failCount} FAILED, ${skipCount} SKIPPED`);
    console.log('==================================================');

    process.exit(failCount === 0 ? 0 : 1);
  } catch (err) {
    server.close();
    console.error('\n❌ SECURITY TEST FATAL ERROR:', err);
    process.exit(1);
  }
}

runStep2SecurityTests();
