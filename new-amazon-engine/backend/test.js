require('dotenv').config();
const { Client } = require('pg');

// Database connection
const client = new Client({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

async function checkJanuary5Data() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    const targetDate = '2026-01-06';
    console.log(`\n🔍 Checking data for date: ${targetDate}`);

    // Check amazon_ads_reports table
    console.log('\n📊 Checking amazon_ads_reports table...');
    const adsQuery = `
      SELECT
        COUNT(*) as total_records,
        MIN(report_date) as earliest_date,
        MAX(report_date) as latest_date,
        SUM(CAST(cost AS DECIMAL)) as total_cost,
        SUM(CAST(sales_1d AS DECIMAL)) as total_sales,
        SUM(CAST(clicks AS INTEGER)) as total_clicks
      FROM amazon_ads_reports
      WHERE report_date = $1::date
    `;

    const adsResult = await client.query(adsQuery, [targetDate]);
    const adsData = adsResult.rows[0];

    console.log(`   Records found: ${adsData.total_records}`);
    console.log(`   Total cost: $${parseFloat(adsData.total_cost || 0).toFixed(2)}`);
    console.log(`   Total sales: $${parseFloat(adsData.total_sales || 0).toFixed(2)}`);
    console.log(`   Total clicks: ${adsData.total_clicks || 0}`);

    // Check amazon_sales_traffic table
    console.log('\n📈 Checking amazon_sales_traffic table...');
    const salesQuery = `
      SELECT
        COUNT(*) as total_records,
        SUM(CAST(sessions AS INTEGER)) as total_sessions,
        SUM(CAST(page_views AS INTEGER)) as total_page_views,
        SUM(CAST(units_ordered AS INTEGER)) as total_units_ordered,
        SUM(CAST(ordered_product_sales AS DECIMAL)) as total_sales
      FROM amazon_sales_traffic
      WHERE date = $1::date
    `;

    const salesResult = await client.query(salesQuery, [targetDate]);
    const salesData = salesResult.rows[0];

    console.log(`   Records found: ${salesData.total_records}`);
    console.log(`   Total sessions: ${salesData.total_sessions || 0}`);
    console.log(`   Total page views: ${salesData.total_page_views || 0}`);
    console.log(`   Total units ordered: ${salesData.total_units_ordered || 0}`);
    console.log(`   Total sales: $${parseFloat(salesData.total_sales || 0).toFixed(2)}`);

    // Summary
    console.log('\n📋 SUMMARY:');
    const hasAdsData = parseInt(adsData.total_records) > 0;
    const hasSalesData = parseInt(salesData.total_records) > 0;

    console.log(`   Ads data for ${targetDate}: ${hasAdsData ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`   Sales data for ${targetDate}: ${hasSalesData ? '✅ EXISTS' : '❌ NOT FOUND'}`);

    if (hasAdsData || hasSalesData) {
      console.log(`\n🎉 SUCCESS: Data exists for ${targetDate}!`);
    } else {
      console.log(`\n⚠️  WARNING: No data found for ${targetDate}`);
    }

    // Show date range in database
    console.log('\n📅 Database date range:');
    const dateRangeQuery = `
      SELECT
        (SELECT MIN(report_date) FROM amazon_ads_reports) as ads_min_date,
        (SELECT MAX(report_date) FROM amazon_ads_reports) as ads_max_date,
        (SELECT MIN(date) FROM amazon_sales_traffic) as sales_min_date,
        (SELECT MAX(date) FROM amazon_sales_traffic) as sales_max_date
    `;

    const dateRangeResult = await client.query(dateRangeQuery);
    const range = dateRangeResult.rows[0];

    console.log(`   Ads data range: ${range.ads_min_date || 'N/A'} to ${range.ads_max_date || 'N/A'}`);
    console.log(`   Sales data range: ${range.sales_min_date || 'N/A'} to ${range.sales_max_date || 'N/A'}`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check your .env file has correct database credentials');
    console.error('   2. Verify PostgreSQL is running');
    console.error('   3. Check network connectivity to database');
  } finally {
    await client.end();
    console.log('\n👋 Disconnected from database\n');
  }
}

// Run the check
console.log('🧪 Testing data for January 5, 2026...\n');
checkJanuary5Data();