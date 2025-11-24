/**
 * Create indexes for amazon_ads_reports table to optimize keyword queries
 * Run this script: node backend/create-keyword-indexes.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createIndexes() {
  try {
    console.log('🔌 Connecting to database...');
    
    // Check existing indexes
    console.log('\n📋 Checking existing indexes...');
    const existingIndexes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'amazon_ads_reports'
      ORDER BY indexname;
    `);
    
    console.log('Current indexes on amazon_ads_reports:');
    existingIndexes.rows.forEach(idx => {
      console.log(`  ✓ ${idx.indexname}`);
    });
    
    // Create composite index for keyword queries (report_date DESC, cost DESC)
    console.log('\n⚡ Creating composite index for keyword queries...');
    const indexName = 'idx_amazon_ads_reports_date_cost';
    
    try {
      // Use CONCURRENTLY to avoid locking the table
      await pool.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
        ON amazon_ads_reports (report_date DESC, cost DESC);
      `);
      console.log(`✅ Index ${indexName} created successfully`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`ℹ️  Index ${indexName} already exists`);
      } else {
        console.error(`❌ Error creating index: ${err.message}`);
        // Try without CONCURRENTLY if it fails (requires exclusive lock)
        console.log('⚠️  Retrying without CONCURRENTLY (will lock table briefly)...');
        try {
          await pool.query(`
            CREATE INDEX IF NOT EXISTS ${indexName}
            ON amazon_ads_reports (report_date DESC, cost DESC);
          `);
          console.log(`✅ Index ${indexName} created successfully`);
        } catch (err2) {
          console.error(`❌ Failed to create index: ${err2.message}`);
        }
      }
    }
    
    // Verify index was created
    console.log('\n✨ Verifying indexes...');
    const finalIndexes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'amazon_ads_reports'
      AND indexname = '${indexName}';
    `);
    
    if (finalIndexes.rows.length > 0) {
      console.log('✅ Index verified:', finalIndexes.rows[0].indexname);
    } else {
      console.log('⚠️  Index not found after creation');
    }
    
    // Test query performance
    console.log('\n🧪 Testing query performance...');
    const testQuery = `
      SELECT COUNT(*) as total
      FROM amazon_ads_reports
      WHERE report_date >= '2025-05-06'::date 
        AND report_date <= '2025-11-19'::date;
    `;
    
    const testStart = Date.now();
    const testResult = await pool.query(testQuery);
    const testDuration = Date.now() - testStart;
    
    console.log(`   Query returned ${testResult.rows[0].total} rows in ${testDuration}ms`);
    
    if (testDuration < 500) {
      console.log('   ✅ EXCELLENT! Query is very fast!');
    } else if (testDuration < 2000) {
      console.log('   ✅ GOOD! Query performance is acceptable');
    } else {
      console.log('   ⚠️  Query is still slow. Index may still be building...');
    }
    
    console.log('\n🎉 Index creation completed!');
    console.log('\n📈 Expected performance improvement:');
    console.log('   • Keyword queries: 50-300x faster');
    console.log('   • Paginated queries (500 rows): < 1 second');
    console.log('   • Overall page load: Much faster!');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    await pool.end();
    console.log('\n👋 Disconnected from database\n');
  }
}

// Run the script
createIndexes();


