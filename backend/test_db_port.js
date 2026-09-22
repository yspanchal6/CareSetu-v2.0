const { Pool } = require('pg');

async function testCaresetuDB() {
  const pool = new Pool({
    connectionString: 'postgresql://caresetu:caresetu_dev_password@localhost:8080/caresetu',
  });
  try {
    const res = await pool.query('SELECT count(*) FROM users');
    console.log('>>> SUCCESS! Connected to caresetu database on port 8080. User count:', res.rows[0]);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

testCaresetuDB();
