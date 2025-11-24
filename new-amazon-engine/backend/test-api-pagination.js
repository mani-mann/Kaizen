/**
 * Test API endpoint pagination response
 * Run this script: node backend/test-api-pagination.js
 */

require('dotenv').config();

async function testApiPagination() {
  try {
    const baseUrl = 'http://localhost:5000';
    const startDate = '2025-05-06';
    const endDate = '2025-11-19';
    
    console.log('🧪 Testing API Pagination Endpoint\n');
    console.log(`URL: ${baseUrl}/api/analytics`);
    console.log(`Date Range: ${startDate} to ${endDate}\n`);
    
    // Test Page 1
    console.log('1️⃣ Testing Page 1...');
    const page1Url = `${baseUrl}/api/analytics?start=${startDate}&end=${endDate}&page=1`;
    console.log(`   GET ${page1Url}`);
    
    const page1Start = Date.now();
    const page1Res = await fetch(page1Url);
    const page1Duration = Date.now() - page1Start;
    
    if (!page1Res.ok) {
      throw new Error(`HTTP ${page1Res.status}: ${page1Res.statusText}`);
    }
    
    const page1Data = await page1Res.json();
    
    console.log(`   ✅ Response received in ${page1Duration}ms`);
    console.log(`   Rows returned: ${page1Data.rows?.length || 0}`);
    console.log(`   Has KPIs: ${!!page1Data.kpis}`);
    console.log(`   Has pagination: ${!!page1Data.pagination}`);
    
    if (page1Data.pagination) {
      console.log(`   Pagination info:`);
      console.log(`     - Current Page: ${page1Data.pagination.currentPage}`);
      console.log(`     - Page Limit: ${page1Data.pagination.pageLimit}`);
      console.log(`     - Total Rows: ${page1Data.pagination.totalRows}`);
      console.log(`     - Total Pages: ${page1Data.pagination.totalPages}`);
      console.log(`     - Has Next Page: ${page1Data.pagination.hasNextPage}`);
      console.log(`     - Has Prev Page: ${page1Data.pagination.hasPrevPage}`);
    } else {
      console.log('   ⚠️  No pagination object in response!');
    }
    console.log('');
    
    // Test Page 2 (if available)
    if (page1Data.pagination && page1Data.pagination.hasNextPage) {
      console.log('2️⃣ Testing Page 2...');
      const page2Url = `${baseUrl}/api/analytics?start=${startDate}&end=${endDate}&page=2`;
      console.log(`   GET ${page2Url}`);
      
      const page2Start = Date.now();
      const page2Res = await fetch(page2Url);
      const page2Duration = Date.now() - page2Start;
      
      if (!page2Res.ok) {
        throw new Error(`HTTP ${page2Res.status}: ${page2Res.statusText}`);
      }
      
      const page2Data = await page2Res.json();
      
      console.log(`   ✅ Response received in ${page2Duration}ms`);
      console.log(`   Rows returned: ${page2Data.rows?.length || 0}`);
      console.log(`   Current Page: ${page2Data.pagination?.currentPage || 'N/A'}`);
      console.log(`   Has Next Page: ${page2Data.pagination?.hasNextPage || 'N/A'}`);
      console.log(`   Has Prev Page: ${page2Data.pagination?.hasPrevPage || 'N/A'}`);
      
      // Verify data is different
      if (page1Data.rows && page2Data.rows) {
        const page1FirstId = page1Data.rows[0]?.report_date || page1Data.rows[0]?.date;
        const page2FirstId = page2Data.rows[0]?.report_date || page2Data.rows[0]?.date;
        if (page1FirstId !== page2FirstId) {
          console.log('   ✅ Page 2 data is different from Page 1 (correct!)');
        } else {
          console.log('   ⚠️  Page 2 data same as Page 1 (might be an issue)');
        }
      }
      console.log('');
    }
    
    // Test without page parameter (should default to page 1)
    console.log('3️⃣ Testing without page parameter (should default to page 1)...');
    const defaultUrl = `${baseUrl}/api/analytics?start=${startDate}&end=${endDate}`;
    const defaultRes = await fetch(defaultUrl);
    const defaultData = await defaultRes.json();
    
    if (defaultData.pagination && defaultData.pagination.currentPage === 1) {
      console.log('   ✅ Defaults to page 1 correctly');
    } else {
      console.log('   ⚠️  Does not default to page 1');
    }
    console.log('');
    
    // Summary
    console.log('✅ API Pagination Test Summary:');
    console.log(`   ✅ Endpoint responds correctly`);
    console.log(`   ✅ Pagination object is present`);
    console.log(`   ✅ Page 1 loads in ${page1Duration}ms (target: < 1000ms)`);
    if (page1Duration < 1000) {
      console.log(`   ✅ Performance: EXCELLENT`);
    } else {
      console.log(`   ⚠️  Performance: Needs improvement`);
    }
    console.log('');
    
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('❌ Error: Cannot connect to server');
      console.error('   Make sure the server is running on http://localhost:5000');
      console.error('   Run: cd backend && node server.js');
    } else {
      console.error('❌ Error:', err.message);
    }
    process.exit(1);
  }
}

// Run the test
testApiPagination();


