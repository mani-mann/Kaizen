/**
 * Setup script for ASIN Keywords Tracking Table
 * Creates the table and indexes for storing weekly keyword data
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
    if (process.env.PGSSL) return process.env.PGSSL !== 'disable';
    return true;
  } catch (_) {
    return process.env.PGSSL ? process.env.PGSSL !== 'disable' : true;
  }
})();

const pool = new Pool({
  ...poolConfig,
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
});

async function setupTable() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Setting up ASIN Keywords Tracking Table...\n');

    // Read SQL file - try create_table_cloud.sql first (simpler), fallback to full version
    let sqlFile = path.join(__dirname, 'create_table_cloud.sql');
    if (!fs.existsSync(sqlFile)) {
      sqlFile = path.join(__dirname, 'create_asin_keywords_table.sql');
    }
    
    console.log(`📄 Reading SQL file: ${path.basename(sqlFile)}`);
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Remove comments and split by semicolons
    const cleanedSql = sql
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('COMMENT');
      })
      .join('\n');

    // Split by semicolons and execute each statement
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length > 10); // Filter out very short fragments

    console.log(`\n📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement.length > 10) {
        try {
          // Show what we're executing (first 50 chars)
          const preview = statement.substring(0, 50).replace(/\s+/g, ' ');
          console.log(`   [${i + 1}/${statements.length}] Executing: ${preview}...`);
          
          await client.query(statement + ';');
          console.log(`   ✅ Success`);
        } catch (err) {
          if (err.message.includes('already exists')) {
            console.log(`   ℹ️  Already exists, skipping`);
          } else {
            console.error(`   ❌ Error:`, err.message);
            // Don't exit - continue with other statements
          }
        }
      }
    }

    // Verify table was created
    console.log('\n✨ Verifying table structure...');
    const tableCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'asin_keywords_tracking' 
      ORDER BY ordinal_position;
    `);

    if (tableCheck.rows.length > 0) {
      console.log('\n✅ Table created successfully with columns:');
      tableCheck.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('⚠️  Table structure not found');
    }

    // Check indexes
    console.log('\n📌 Verifying indexes...');
    const indexCheck = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'asin_keywords_tracking'
      ORDER BY indexname;
    `);

    if (indexCheck.rows.length > 0) {
      console.log(`✅ Found ${indexCheck.rows.length} indexes:`);
      indexCheck.rows.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
    }

    console.log('\n🎉 Setup complete! Table is ready to store keyword data.');
    console.log('\n💡 Next steps:');
    console.log('   1. Process ASINs through the ASIN to Keyword page');
    console.log('   2. Data will be automatically saved to this table');
    console.log('   3. Query the table to track keyword rankings over time');

  } catch (error) {
    console.error('❌ Error setting up table:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup
setupTable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
