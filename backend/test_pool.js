const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const rawUrl = process.env.DATABASE_URL || 'postgresql://caresetu:caresetu_dev_password@localhost:8080/caresetu';
const connectionString = rawUrl.replace(/^["']|["']$/g, '').trim();

console.log('Testing connectionString:', connectionString);

const pool = new Pool({ connectionString });
pool.query('SELECT 1', (err, res) => {
  if (err) {
    console.error('Direct Pool Error:', err);
  } else {
    console.log('Direct Pool Success:', res.rows);
  }
  pool.end();
});
