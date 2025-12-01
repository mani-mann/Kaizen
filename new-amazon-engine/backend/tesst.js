// tesst.js – quick sanity check for a single product's business data
//
// Usage:
//   node tesst.js                          # uses default ASIN B0FL7XHVML and its full date range
//   node tesst.js B0FL7XHVML               # same as above, explicit ASIN
//   node tesst.js B0FL7XHVML 2025-10-01 2025-10-31   # e.g. fetch October data
//
// This script prints per-day Sessions, Page Views, Units Ordered, and Sales (₹)
// for the given product, and also fills in any missing calendar days with zeros
// so you can compare directly with the Business Reports chart.

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
  const asin = String(process.argv[2] || 'B0FL7XHVML').toUpperCase();
  let startArg = process.argv[3] || null;
  let endArg = process.argv[4] || null;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: shouldUseSSL() ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  console.log('🔌 Connecting to PostgreSQL...');
  await client.connect();
  console.log('✅ Connected');

  // Resolve date range for this product if not explicitly given
  if (!startArg || !endArg) {
    console.log(`🔍 Resolving available date range for parent_asin = ${asin} ...`);
    const rangeRes = await client.query(
      `
        SELECT 
          MIN((date AT TIME ZONE 'Asia/Kolkata')::date) AS min_date,
          MAX((date AT TIME ZONE 'Asia/Kolkata')::date) AS max_date
        FROM amazon_sales_traffic
        WHERE UPPER(parent_asin) = $1
      `,
      [asin]
    );

    const { min_date, max_date } = rangeRes.rows[0] || {};
    if (!min_date || !max_date) {
      console.log(`⚠️ No rows found in amazon_sales_traffic for parent_asin = ${asin}`);
      await client.end();
      return;
    }

    startArg = startArg || min_date.toISOString().slice(0, 10);
    endArg = endArg || max_date.toISOString().slice(0, 10);
  }

  console.log(`📅 Using date range: ${startArg} → ${endArg}`);

  // Aggregate metrics per calendar day for this product
  const dataRes = await client.query(
    `
      SELECT 
        (date AT TIME ZONE 'Asia/Kolkata')::date AS day,
        SUM(CAST(sessions AS INTEGER))              AS sessions,
        SUM(CAST(page_views AS INTEGER))            AS page_views,
        SUM(CAST(units_ordered AS INTEGER))         AS units_ordered,
        SUM(CAST(ordered_product_sales AS DECIMAL)) AS ordered_product_sales
      FROM amazon_sales_traffic
      WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date
        AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
        AND UPPER(parent_asin) = $3
      GROUP BY (date AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date ASC
    `,
    [startArg, endArg, asin]
  );

  const rows = dataRes.rows || [];
  console.log(`📦 Found ${rows.length} business day(s) with data for ${asin} in this range.`);

  // Build a map keyed by local YYYY-MM-DD (no UTC shift)
  const byDate = new Map();
  for (const r of rows) {
    const d = new Date(r.day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;
    byDate.set(key, {
      day: key,
      sessions: Number(r.sessions || 0),
      pageViews: Number(r.page_views || 0),
      unitsOrdered: Number(r.units_ordered || 0),
      sales: Number(r.ordered_product_sales || 0),
    });
  }

  // Generate a full calendar range and fill missing days with zeros
  const start = new Date(startArg);
  const end = new Date(endArg);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const full = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (byDate.has(key)) {
      full.push(byDate.get(key));
    } else {
      full.push({
        day: key,
        sessions: 0,
        pageViews: 0,
        unitsOrdered: 0,
        sales: 0,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  console.log('\n📊 Per-day metrics for product:', asin);
  console.table(
    full.map((d) => ({
      day: d.day,
      sessions: d.sessions,
      pageViews: d.pageViews,
      unitsOrdered: d.unitsOrdered,
      sales: d.sales.toFixed(2),
    }))
  );

  const totals = full.reduce(
    (acc, d) => {
      acc.sessions += d.sessions;
      acc.pageViews += d.pageViews;
      acc.unitsOrdered += d.unitsOrdered;
      acc.sales += d.sales;
      if (d.sessions || d.pageViews || d.unitsOrdered || d.sales) {
        acc.activeDays += 1;
      }
      return acc;
    },
    { sessions: 0, pageViews: 0, unitsOrdered: 0, sales: 0, activeDays: 0 }
  );

  console.log('\n📈 Summary for this range:');
  console.log({
    totalSessions: totals.sessions,
    totalPageViews: totals.pageViews,
    totalUnitsOrdered: totals.unitsOrdered,
    totalSales: totals.sales,
    calendarDays: full.length,
    activeDaysWithAnyData: totals.activeDays,
  });

  await client.end();
  console.log('\n✅ tesst.js completed');
}

main().catch((err) => {
  console.error('❌ tesst.js failed:', err?.message || err);
  process.exit(1);
});


