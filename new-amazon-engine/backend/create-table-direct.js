/**
 * Direct table creation script - simpler version
 * Creates asin_keywords_tracking table directly
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

async function createTable() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Creating ASIN Keywords Tracking Table...\n');
    console.log(`🔌 Connecting to: ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}\n`);

    // Create table
    console.log('1️⃣ Creating table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS asin_keywords_tracking (
        id SERIAL PRIMARY KEY,
        tracking_date DATE NOT NULL,
        asin VARCHAR(20) NOT NULL,
        keyword_phrase TEXT NOT NULL,
        organic_rank INTEGER,
        product_title VARCHAR(500),
        cerebro_iq_score DECIMAL(10,2),
        search_volume INTEGER,
        cpr DECIMAL(10,2),
        competing_products INTEGER,
        previous_rank INTEGER,
        rank_change INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tracking_date, asin, keyword_phrase)
      );
    `);
    
    // Add columns if they don't exist (for existing tables)
    await client.query(`
      ALTER TABLE asin_keywords_tracking 
      ADD COLUMN IF NOT EXISTS previous_rank INTEGER;
    `);
    
    await client.query(`
      ALTER TABLE asin_keywords_tracking 
      ADD COLUMN IF NOT EXISTS rank_change INTEGER;
    `);
    console.log('   ✅ Table created\n');

    // Create indexes
    console.log('2️⃣ Creating indexes...');
    const indexes = [
      { name: 'idx_asin_keywords_tracking_date', sql: 'CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date ON asin_keywords_tracking(tracking_date DESC);' },
      { name: 'idx_asin_keywords_tracking_asin', sql: 'CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_asin ON asin_keywords_tracking(asin);' },
      { name: 'idx_asin_keywords_tracking_date_asin', sql: 'CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date_asin ON asin_keywords_tracking(tracking_date DESC, asin);' },
      { name: 'idx_asin_keywords_tracking_keyword', sql: 'CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_keyword ON asin_keywords_tracking(keyword_phrase);' },
      { name: 'idx_asin_keywords_tracking_date_asin_keyword', sql: 'CREATE INDEX IF NOT EXISTS idx_asin_keywords_tracking_date_asin_keyword ON asin_keywords_tracking(tracking_date DESC, asin, keyword_phrase);' }
    ];

    for (const idx of indexes) {
      await client.query(idx.sql);
      console.log(`   ✅ ${idx.name}`);
    }

    // Verify
    console.log('\n3️⃣ Verifying table...');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'asin_keywords_tracking' 
      ORDER BY ordinal_position;
    `);

    if (result.rows.length > 0) {
      console.log(`\n✅ Table created successfully with ${result.rows.length} columns:`);
      result.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('\n⚠️  Table not found - something went wrong');
      process.exit(1);
    }

    // Check row count
    const countResult = await client.query('SELECT COUNT(*) FROM asin_keywords_tracking;');
    console.log(`\n📊 Current rows in table: ${countResult.rows[0].count}`);

    console.log('\n🎉 Setup complete! Table is ready to store keyword data.');
    console.log('\n💡 Next steps:');
    console.log('   1. Process ASINs through the ASIN to Keyword page');
    console.log('   2. Data will be automatically saved to this table');
    console.log('   3. Query the table to track keyword rankings over time');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createTable();
