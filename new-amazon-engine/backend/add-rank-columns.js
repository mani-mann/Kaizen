/**
 * Add previous_rank and rank_change columns to asin_keywords_tracking table
 */

require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
};

const shouldUseSSL = (() => {
  try {
    if (process.env.PGSSL) return process.env.PGSSL !== 'disable';
    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL);
      const sslmode = url.searchParams.get('sslmode');
      if (sslmode === 'disable') return false;
      if (sslmode === 'require') return true;
    }
    return true;
  } catch (_) {
    return process.env.PGSSL ? process.env.PGSSL !== 'disable' : true;
  }
})();

const pool = new Pool({
  ...poolConfig,
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

async function addColumns() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Adding rank comparison columns...\n');
    console.log(`🔌 Connecting to: ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}\n`);

    // Add previous_rank column
    console.log('1️⃣ Adding previous_rank column...');
    await client.query(`
      ALTER TABLE asin_keywords_tracking 
      ADD COLUMN IF NOT EXISTS previous_rank INTEGER;
    `);
    console.log('   ✅ previous_rank column added\n');

    // Add rank_change column
    console.log('2️⃣ Adding rank_change column...');
    await client.query(`
      ALTER TABLE asin_keywords_tracking 
      ADD COLUMN IF NOT EXISTS rank_change INTEGER;
    `);
    console.log('   ✅ rank_change column added\n');

    // Verify columns
    console.log('3️⃣ Verifying columns...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'asin_keywords_tracking' 
        AND column_name IN ('previous_rank', 'rank_change')
      ORDER BY column_name;
    `);

    if (result.rows.length === 2) {
      console.log('\n✅ Both columns added successfully:');
      result.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log(`\n⚠️  Expected 2 columns, found ${result.rows.length}`);
    }

    console.log('\n🎉 Columns added successfully!');
    console.log('\n💡 The system will now automatically:');
    console.log('   1. Look up previous week\'s rank for each keyword');
    console.log('   2. Calculate rank change (negative = improved, positive = declined)');
    console.log('   3. Store both previous_rank and rank_change');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns();
