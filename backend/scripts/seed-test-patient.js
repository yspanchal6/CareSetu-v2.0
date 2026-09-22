/**
 * CareSetu — Development Test Patient Account Seeder
 * Creates an idempotent test patient account for local dev/testing during OTP gateway downtime.
 * 
 * Safety Rules:
 * - Strictly disallowed in NODE_ENV === 'production'
 * - Idempotent: creates if missing, updates if exists, removes on --clean flag
 * - Hashed with production bcrypt (12 rounds)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

const TEST_EMAIL = 'test.patient@caresetu.local';
const TEST_PASSWORD = 'Test@12345';
const TEST_PHONE = '9876543210';
const TEST_NAME = 'Test Patient';

async function seedTestPatient() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY ERROR] Test patient account seeding is STRICTLY FORBIDDEN in production environment!');
    process.exit(1);
  }

  const isCleanup = process.argv.includes('--clean') || process.argv.includes('--cleanup');

  if (isCleanup) {
    console.log('[CLEANUP] Removing dev test patient account...');
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) {
      await prisma.user.delete({ where: { id: existing.id } });
      console.log('[CLEANUP] Test patient account removed successfully.');
    } else {
      console.log('[CLEANUP] No test patient account found to remove.');
    }
    return;
  }

  console.log('[SEED] Provisioning dev test patient account...');

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);

  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    include: { patient: true },
  });

  let user;
  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: hashedPassword,
        status: 'ACTIVE',
        isVerified: true,
      },
      include: { patient: true },
    });
    console.log('[SEED] Existing test patient account updated with fresh credentials.');
  } else {
    user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: TEST_NAME,
        password: hashedPassword,
        role: 'PATIENT',
        status: 'ACTIVE',
        isVerified: true,
        patient: {
          create: {
            name: TEST_NAME,
            age: 28,
            gender: 'Other',
            phone: TEST_PHONE,
            location: { latitude: 23.0225, longitude: 72.5714 },
          },
        },
      },
      include: { patient: true },
    });
    console.log('[SEED] New test patient account created successfully.');
  }

  console.log('==================================================');
  console.log('DEV TEST PATIENT ACCOUNT READY');
  console.log('==================================================');
  console.log(`Email:    ${user.email}`);
  console.log(`Password: ${TEST_PASSWORD}`);
  console.log(`Role:     ${user.role}`);
  console.log(`Status:   ${user.status}`);
  console.log(`Verified: ${user.isVerified}`);
  console.log('==================================================');
}

if (require.main === module) {
  seedTestPatient()
    .catch((err) => {
      console.error('[SEED ERROR]', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { seedTestPatient, TEST_EMAIL, TEST_PASSWORD };
