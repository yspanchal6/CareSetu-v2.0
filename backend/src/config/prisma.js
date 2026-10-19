const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl.replace(/^["']|["']$/g, '').trim();

// Connection pooling configuration with safe defaults (10 max clients for standard PostgreSQL limits)
const poolMax = Math.max(2, parseInt(process.env.DATABASE_POOL_MAX || '10', 10));
const idleTimeoutMillis = parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT || '30000', 10);
const connectionTimeoutMillis = parseInt(process.env.DATABASE_POOL_CONN_TIMEOUT || '5000', 10);

const pool = new Pool({
  connectionString,
  max: poolMax,
  idleTimeoutMillis,
  connectionTimeoutMillis,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;