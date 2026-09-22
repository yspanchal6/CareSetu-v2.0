const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');
const bcryptjs = require('bcryptjs');

async function testLogin() {
  console.log('=== TESTING DB USERS & LOGIN COMPARISON ===');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      password: true,
      role: true,
      status: true,
      isVerified: true
    }
  });

  console.log(`Found ${users.length} users in DB:`);
  for (const u of users) {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Status: ${u.status}, Verified: ${u.isVerified}`);
    if (u.email === 'patient@test.com') {
      const matchNative = await bcrypt.compare('password123', u.password);
      const matchJs = await bcryptjs.compare('password123', u.password);
      console.log(`  Testing 'patient@test.com' with 'password123':`);
      console.log(`  native bcrypt: ${matchNative}, bcryptjs: ${matchJs}`);
    }
    if (u.email === 'shreekrishna@caresetu.com') {
      const matchNative = await bcrypt.compare('hospital123', u.password);
      const matchJs = await bcryptjs.compare('hospital123', u.password);
      console.log(`  Testing 'shreekrishna@caresetu.com' with 'hospital123':`);
      console.log(`  native bcrypt: ${matchNative}, bcryptjs: ${matchJs}`);
    }
  }

  await prisma.$disconnect();
}

testLogin().catch(console.error);
