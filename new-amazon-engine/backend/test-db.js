// test-db.js
require('dotenv').config();
const { Client } = require('pg');

function shouldUseSSL() {
  try {
    if (process.env.PGSSL) return process.env.PGSSL !== 'disable';
    const url = new URL(process.env.DATABASE_URL);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode === 'disable') return false;
    if (sslmode === 'require') return true;
  } catch (_) {}
  return true;
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: shouldUseSSL() ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  console.log('🔌 Connecting to PostgreSQL...');
  try {
    await client.connect();
    console.log('✅ Connected');

    const now = await client.query('SELECT NOW() as now');
    console.log('⏱️ Server time:', now.rows[0].now);

    // Business table checks
    const bizCount = await client.query('SELECT COUNT(*)::int AS count FROM amazon_sales_traffic');
    console.log('📦 amazon_sales_traffic rows:', bizCount.rows[0].count);

    if (bizCount.rows[0].count > 0) {
      const bizRange = await client.query(`
        SELECT MIN(DATE(date)) AS min_date, MAX(DATE(date)) AS max_date
        FROM amazon_sales_traffic
      `);
      console.log('📅 Business data range:', bizRange.rows[0]);

      const bizSample = await client.query(`
        SELECT DATE(date) AS date, parent_asin, sku, sessions, page_views, units_ordered, ordered_product_sales
        FROM amazon_sales_traffic
        ORDER BY DATE(date) DESC
        LIMIT 5
      `);
      console.log('🔍 Business sample (latest 5):');
      console.table(bizSample.rows);
    }

    // Ads table checks (optional)
    try {
      const adsCount = await client.query('SELECT COUNT(*)::int AS count FROM amazon_ads_reports');
      console.log('📢 amazon_ads_reports rows:', adsCount.rows[0].count);
      if (adsCount.rows[0].count > 0) {
        const adsRange = await client.query(`
          SELECT MIN(DATE(report_date)) AS min_date, MAX(DATE(report_date)) AS max_date
          FROM amazon_ads_reports
        `);
        console.log('📅 Ads data range:', adsRange.rows[0]);

        const adsSample = await client.query(`
          SELECT DATE(report_date) AS date, search_term, campaign_name, cost, sales_1d
          FROM amazon_ads_reports
          ORDER BY DATE(report_date) DESC
          LIMIT 5
        `);
        console.log('🔍 Ads sample (latest 5):');
        console.table(adsSample.rows);
      }
    } catch (e) {
      console.log('ℹ️ Skipping ads checks:', e.message);
    }

    await client.end();
    console.log('✅ Test completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ DB test failed:', err.message);
    process.exit(1);
  }
}

main();


