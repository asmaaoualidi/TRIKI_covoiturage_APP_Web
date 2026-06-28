// Run: node test-db.js
// Checks DB connection and reports errors clearly
require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
  console.log('Testing DB connection...');
  console.log(`Host: ${process.env.DB_HOST}, User: ${process.env.DB_USER}, DB: ${process.env.DB_NAME}`);
  
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    console.log('✅ DB connection OK');
    
    // Check tables
    const [tables] = await conn.query('SHOW TABLES');
    console.log('Tables found:', tables.map(r => Object.values(r)[0]).join(', '));
    
    // Check trajets columns
    const [cols] = await conn.query('DESCRIBE trajets');
    const colNames = cols.map(c => c.Field);
    console.log('trajets columns:', colNames.join(', '));
    
    const hasGeo = colNames.includes('lat_depart');
    console.log(hasGeo ? '✅ Geo columns present' : '⚠️  Geo columns MISSING — run the ALTER TABLE from sqlf.sql');
    
    await conn.end();
  } catch (err) {
    console.error('❌ DB Error:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('→ Wrong DB_USER or DB_PASS in .env');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('→ MySQL not running, or wrong DB_HOST/PORT');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.log('→ Database does not exist, run: CREATE DATABASE covoiturage_db;');
    }
  }
}
test();
