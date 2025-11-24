/**
 * Test keyword query performance and verify index usage
 * Run this script: node backend/test-keyword-performance.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testKeywordPerformance() {
  try {
    console.log('🔌 Connecting to database...\n');
    
    const startDate = '2025-05-06';
    const endDate = '2025-11-19';
    const page = 1;
    const limit = 500;
    const offset = (page - 1) * limit;
    
    console.log('📊 Test Parameters:');
    console.log(`   Date Range: ${startDate} to ${endDate}`);
    console.log(`   Page: ${page}, Limit: ${limit}, Offset: ${offset}\n`);
    
    // Test 1: Check if index exists
    console.log('1️⃣ Checking for index...');
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'amazon_ads_reports'
      AND indexname = 'idx_amazon_ads_reports_date_cost';
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log('   ✅ Index found:', indexCheck.rows[0].indexname);
      console.log('   Definition:', indexCheck.rows[0].indexdef);
    } else {
      console.log('   ⚠️  Index NOT found! Run: node backend/create-keyword-indexes.js');
    }
    console.log('');
    
    // Test 2: Get total count
    console.log('2️⃣ Getting total count...');
    const countStart = Date.now();
    const countResult = await pool.query(`
      SELECT COUNT(*) as total 
      FROM amazon_ads_reports
      WHERE report_date >= $1::date AND report_date <= $2::date
    `, [startDate, endDate]);
    const countDuration = Date.now() - countStart;
    const totalRows = parseInt(countResult.rows[0]?.total || 0);
    console.log(`   Total rows: ${totalRows}`);
    console.log(`   Count query time: ${countDuration}ms`);
    console.log('');
    
    // Test 3: Run EXPLAIN ANALYZE on the actual query
    console.log('3️⃣ Running EXPLAIN ANALYZE on keyword query...');
    const explainQuery = `
      EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
      SELECT search_term, keyword_info, match_type, campaign_name, cost, sales_1d, clicks, impressions, purchases_1d, report_date
      FROM amazon_ads_reports
      WHERE report_date >= $1::date AND report_date <= $2::date
      ORDER BY report_date DESC, cost DESC
      LIMIT $3 OFFSET $4
    `;
    
    const explainResult = await pool.query(explainQuery, [startDate, endDate, limit, offset]);
    console.log('   Query Plan:');
    console.log('   ' + '='.repeat(70));
    explainResult.rows.forEach((row, idx) => {
      console.log(`   ${row['QUERY PLAN']}`);
    });
    console.log('   ' + '='.repeat(70));
    console.log('');
    
    // Analyze the plan
    const planText = explainResult.rows.map(r => r['QUERY PLAN']).join(' ');
    const usesIndex = planText.includes('Index Scan') || planText.includes('Index Only Scan');
    const usesSeqScan = planText.includes('Seq Scan');
    const hasSort = planText.includes('Sort');
    
    console.log('4️⃣ Plan Analysis:');
    if (usesIndex) {
      console.log('   ✅ Query uses INDEX (GOOD!)');
    } else if (usesSeqScan) {
      console.log('   ❌ Query uses SEQUENTIAL SCAN (SLOW - needs index!)');
    }
    
    if (hasSort) {
      const sortMethod = planText.match(/Sort Method: (\w+)/);
      if (sortMethod) {
        console.log(`   ⚠️  Sorting required: ${sortMethod[1]}`);
        if (sortMethod[1] === 'external merge') {
          console.log('   ❌ External merge sort = very slow (sorting on disk)');
        } else if (sortMethod[1] === 'quicksort') {
          console.log('   ✅ Quicksort = acceptable (sorting in memory)');
        }
      }
    } else {
      console.log('   ✅ No sorting needed (index provides order)');
    }
    console.log('');
    
    // Test 4: Actual query performance test
    console.log('5️⃣ Performance Test - Running actual query 3 times...');
    const times = [];
    for (let i = 1; i <= 3; i++) {
      const queryStart = Date.now();
      const result = await pool.query(`
        SELECT search_term, keyword_info, match_type, campaign_name, cost, sales_1d, clicks, impressions, purchases_1d, report_date
        FROM amazon_ads_reports
        WHERE report_date >= $1::date AND report_date <= $2::date
        ORDER BY report_date DESC, cost DESC
        LIMIT $3 OFFSET $4
      `, [startDate, endDate, limit, offset]);
      const queryDuration = Date.now() - queryStart;
      times.push(queryDuration);
      console.log(`   Run ${i}: ${queryDuration}ms (returned ${result.rows.length} rows)`);
    }
    
    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('');
    console.log('6️⃣ Performance Summary:');
    console.log(`   Average: ${avgTime}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);
    console.log('');
    
    if (avgTime < 1000) {
      console.log('   ✅ EXCELLENT! Query is under 1 second');
    } else if (avgTime < 2000) {
      console.log('   ⚠️  ACCEPTABLE but could be faster');
    } else {
      console.log('   ❌ TOO SLOW! Needs optimization');
    }
    console.log('');
    
    // Test 5: Test pagination metadata
    console.log('7️⃣ Testing pagination metadata...');
    const totalPages = Math.ceil(totalRows / limit);
    console.log(`   Total rows: ${totalRows}`);
    console.log(`   Rows per page: ${limit}`);
    console.log(`   Total pages: ${totalPages}`);
    console.log(`   Current page: ${page}`);
    console.log(`   Has next page: ${page < totalPages}`);
    console.log(`   Has prev page: ${page > 1}`);
    console.log('');
    
    // Test 6: Test different pages
    if (totalPages > 1) {
      console.log('8️⃣ Testing page 2 performance...');
      const page2Start = Date.now();
      const page2Result = await pool.query(`
        SELECT search_term, keyword_info, match_type, campaign_name, cost, sales_1d, clicks, impressions, purchases_1d, report_date
        FROM amazon_ads_reports
        WHERE report_date >= $1::date AND report_date <= $2::date
        ORDER BY report_date DESC, cost DESC
        LIMIT $3 OFFSET $4
      `, [startDate, endDate, limit, limit]); // Offset = limit for page 2
      const page2Duration = Date.now() - page2Start;
      console.log(`   Page 2 query time: ${page2Duration}ms (returned ${page2Result.rows.length} rows)`);
      console.log('');
    }
    
    console.log('✅ All tests completed!\n');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await pool.end();
    console.log('👋 Disconnected from database\n');
  }
}

// Run the tests
testKeywordPerformance();


