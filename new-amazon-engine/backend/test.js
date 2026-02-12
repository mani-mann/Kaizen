/**
 * Backend Data Test
 * Tests either Data API (when DATA_API_URL is set) or PostgreSQL connection
 */
require('dotenv').config();

const USE_DATA_API = !!(process.env.DATA_API_URL && process.env.DATA_API_URL.trim());

async function testDataApi() {
  const fetch = require('node-fetch');
  const dataApi = require('./data-api');

  console.log('📡 Testing Data API mode...');
  console.log(`   API URL: ${process.env.DATA_API_URL}\n`);

  try {
    // 1. Probe API health
    console.log('🔍 1. Checking API health...');
    const healthy = await dataApi.probeApi();
    if (!healthy) {
      throw new Error('API not reachable');
    }
    console.log('   ✅ API is reachable\n');

    // 2. Fetch ads data
    console.log('🔍 2. Fetching ads data...');
    const adsRows = await dataApi.fetchAdsData();
    console.log(`   ✅ Fetched ${adsRows.length} ad records`);

    if (adsRows.length > 0) {
      const sample = adsRows[0];
      const totalCost = adsRows.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
      const totalSales = adsRows.reduce((s, r) => s + (parseFloat(r.sales_1d) || 0), 0);
      const totalClicks = adsRows.reduce((s, r) => s + (parseInt(r.clicks) || 0), 0);
      const dates = [...new Set(adsRows.map(r => String(r.report_date).slice(0, 10)))];
      console.log(`   Sample date: ${sample.report_date}`);
      console.log(`   Total cost: $${totalCost.toFixed(2)}`);
      console.log(`   Total sales: $${totalSales.toFixed(2)}`);
      console.log(`   Total clicks: ${totalClicks}`);
      console.log(`   Date range: ${dates.length} unique dates`);
    }
    console.log('');

    // 3. Fetch sales data
    console.log('🔍 3. Fetching sales data...');
    const salesRows = await dataApi.fetchSalesData();
    console.log(`   ✅ Fetched ${salesRows.length} sales records`);

    if (salesRows.length > 0) {
      const totalSessions = salesRows.reduce((s, r) => s + (parseInt(r.sessions) || 0), 0);
      const totalPageViews = salesRows.reduce((s, r) => s + (parseInt(r.page_views) || 0), 0);
      const totalUnits = salesRows.reduce((s, r) => s + (parseInt(r.units_ordered) || 0), 0);
      const totalSales = salesRows.reduce((s, r) => s + (parseFloat(r.ordered_product_sales) || 0), 0);
      const agg = dataApi.aggregateSalesByDate(salesRows);
      console.log(`   Aggregated: ${agg.length} unique dates`);
      console.log(`   Total sessions: ${totalSessions}`);
      console.log(`   Total page views: ${totalPageViews}`);
      console.log(`   Total units ordered: ${totalUnits}`);
      console.log(`   Total sales: $${totalSales.toFixed(2)}`);
    }
    console.log('');

    // 4. Test date filtering (filter in-memory from fetched data)
    console.log('🔍 4. Testing date filtering...');
    const toYmd = (v) => v ? String(v).slice(0, 10) : null;
    const sampleDate = adsRows.length > 0 ? toYmd(adsRows[0].report_date) : null;
    if (sampleDate) {
      const filteredAds = adsRows.filter(r => toYmd(r.report_date) === sampleDate);
      const filteredSales = salesRows.filter(r => toYmd(r.date) === sampleDate);
      console.log(`   Ads for ${sampleDate}: ${filteredAds.length} records`);
      console.log(`   Sales for ${sampleDate}: ${filteredSales.length} records`);
    } else {
      console.log('   ⚠️ No sample date (empty ads data)');
    }
    console.log('');

    // 5. Test server health endpoint
    console.log('🔍 5. Testing server /health endpoint...');
    const backendPort = process.env.PORT || 5000;
    const healthRes = await fetch(`http://localhost:${backendPort}/health`);
    if (healthRes.ok) {
      const health = await healthRes.json();
      console.log(`   ✅ Server running, database status: ${health.database}`);
    } else {
      console.log('   ⚠️ Server not running or /health failed (start with: npm start)');
    }
    console.log('');

    console.log('🎉 Data API test PASSED\n');
    return true;
  } catch (err) {
    console.error('\n❌ Data API test FAILED:', err.message);
    console.error('   Stack:', err.stack);
    return false;
  }
}

async function testPostgres() {
  const { Client } = require('pg');

  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    const targetDate = '2026-01-22';
    console.log(`🔍 Checking data for date: ${targetDate}\n`);

    // Ads
    const adsResult = await client.query(
      `SELECT COUNT(*) as total, SUM(CAST(cost AS DECIMAL)) as cost, SUM(CAST(sales_1d AS DECIMAL)) as sales, SUM(CAST(clicks AS INTEGER)) as clicks
       FROM amazon_ads_reports WHERE report_date = $1::date`,
      [targetDate]
    );
    const ads = adsResult.rows[0];
    console.log('📊 amazon_ads_reports:');
    console.log(`   Records: ${ads.total}, Cost: $${parseFloat(ads.cost || 0).toFixed(2)}, Sales: $${parseFloat(ads.sales || 0).toFixed(2)}, Clicks: ${ads.clicks || 0}\n`);

    // Sales
    const salesResult = await client.query(
      `SELECT COUNT(*) as total, SUM(CAST(sessions AS INTEGER)) as sessions, SUM(CAST(ordered_product_sales AS DECIMAL)) as sales
       FROM amazon_sales_traffic WHERE date = $1::date`,
      [targetDate]
    );
    const sales = salesResult.rows[0];
    console.log('📈 amazon_sales_traffic:');
    console.log(`   Records: ${sales.total}, Sessions: ${sales.sessions || 0}, Sales: $${parseFloat(sales.sales || 0).toFixed(2)}\n`);

    // Date range
    console.log('📅 Database date range:');
    const adsRange = await client.query('SELECT MIN(report_date) as mn, MAX(report_date) as mx FROM amazon_ads_reports');
    const salesRange = await client.query('SELECT MIN(date) as mn, MAX(date) as mx FROM amazon_sales_traffic');
    console.log(`   Ads: ${adsRange.rows[0].mn || 'N/A'} to ${adsRange.rows[0].mx || 'N/A'}`);
    console.log(`   Sales: ${salesRange.rows[0].mn || 'N/A'} to ${salesRange.rows[0].mx || 'N/A'}\n`);

    console.log('🎉 PostgreSQL test PASSED\n');
    return true;
  } catch (err) {
    console.error('\n❌ PostgreSQL test FAILED:', err.message);
    return false;
  } finally {
    await client.end();
    console.log('👋 Disconnected from database\n');
  }
}

async function main() {
  console.log('🧪 Backend Data Test\n');
  console.log('='.repeat(50));

  if (USE_DATA_API) {
    await testDataApi();
  } else {
    await testPostgres();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
