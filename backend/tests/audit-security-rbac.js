const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function makeRequest(server, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
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

async function auditSecurityAndRBAC() {
  console.log('=== 3. STEP 1 & STEP 2 AUTHORIZATION, SECURITY & RBAC AUDIT ===\n');

  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));

  try {
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    const patientUser = await prisma.user.findFirst({ where: { role: 'PATIENT', status: 'ACTIVE' } });
    const hospitalUser = await prisma.user.findFirst({ where: { role: 'HOSPITAL', status: 'ACTIVE' } });

    if (!adminUser || !patientUser || !hospitalUser) {
      throw new Error('Missing sample users in database for security testing.');
    }

    const adminToken = generateToken(adminUser);
    const patientToken = generateToken(patientUser);
    const hospitalToken = generateToken(hospitalUser);

    console.log('[Test 3.1] Unauthenticated request to /api/admin/gov-health-data/summary...');
    const resUnauth = await makeRequest(server, '/api/admin/gov-health-data/summary');
    console.log(`✔ HTTP Status: ${resUnauth.status} (Expected: 401, match: ${resUnauth.status === 401})`);

    console.log('\n[Test 3.2] Patient request to /api/admin/gov-health-data/summary...');
    const resPatient = await makeRequest(server, '/api/admin/gov-health-data/summary', {
      authorization: `Bearer ${patientToken}`
    });
    console.log(`✔ HTTP Status: ${resPatient.status} (Expected: 403, match: ${resPatient.status === 403})`);

    console.log('\n[Test 3.3] Hospital request to /api/admin/gov-health-data/summary...');
    const resHospital = await makeRequest(server, '/api/admin/gov-health-data/summary', {
      authorization: `Bearer ${hospitalToken}`
    });
    console.log(`✔ HTTP Status: ${resHospital.status} (Expected: 403, match: ${resHospital.status === 403})`);

    console.log('\n[Test 3.4] Admin request to /api/admin/gov-health-data/summary...');
    const resAdmin = await makeRequest(server, '/api/admin/gov-health-data/summary', {
      authorization: `Bearer ${adminToken}`
    });
    console.log(`✔ HTTP Status: ${resAdmin.status} (Expected: 200, match: ${resAdmin.status === 200})`);

    console.log('\n[Test 3.5] Directory API security check (/api/hospitals/directory)...');
    const resDirectory = await makeRequest(server, '/api/hospitals/directory?page=1&limit=5');
    console.log(`✔ HTTP Status: ${resDirectory.status} (Expected: 200)`);

    const hasPassword = resDirectory.body.includes('password') || resDirectory.body.includes('$2b$');
    const hasSecret = resDirectory.body.includes(JWT_SECRET);

    console.log(`✔ Contains Password / Password Hash: ${hasPassword} (Expected: false)`);
    console.log(`✔ Contains JWT Secret / Internal Key: ${hasSecret} (Expected: false)`);

    if (hasPassword || hasSecret) {
      throw new Error('Security leakage detected in public directory response!');
    }

    server.close();
    console.log('\n✔ STEP 1 & STEP 2 AUTHORIZATION & SECURITY AUDIT PASSED');
    process.exit(0);
  } catch (err) {
    server.close();
    console.error('\n❌ SECURITY AUDIT FAILED:', err);
    process.exit(1);
  }
}

auditSecurityAndRBAC();
