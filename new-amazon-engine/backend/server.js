require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');

const app = express();

// CORS Configuration
const SERVER_ORIGIN = process.env.SERVER_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [SERVER_ORIGIN, 'http://localhost:5500', 'http://127.0.0.1:5000', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow any origin
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

app.use(express.json());

// Enable gzip compression with optimal settings for faster responses
try { 
  app.use(require('compression')({
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Compress all text-based content
      if (req.headers['x-no-compression']) return false;
      return require('compression').filter(req, res);
    }
  })); 
} catch (_) {}

// Serve static files from the public directory with caching
app.use(express.static('../public', {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache CSS/JS for 1 week
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    // Cache images for 1 month
    if (path.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
    // Don't cache HTML files
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// Avoid noisy 404s for browser favicon requests
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// --------------------
// PostgreSQL Client Setup
// --------------------
// Respect sslmode in DATABASE_URL and allow overriding via PGSSL env
const shouldUseSSL = (() => {
  try {
    if (process.env.PGSSL) return process.env.PGSSL !== 'disable';
    const url = new URL(process.env.DATABASE_URL);
    const sslmode = url.searchParams.get('sslmode');
    if (sslmode === 'disable') return false;
    if (sslmode === 'require') return true;
  } catch (_) {
    // fall through
  }
  // Default to SSL on (common for managed Postgres)
  return true;
})();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
});
// Track connection status explicitly (client.connected is not reliable)
let dbConnected = false;

// Simple in-memory cache for KPI calculations
const kpiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear cache function for debugging
function clearCache() {
  kpiCache.clear();
  console.log('🧹 Cache cleared');
}

// Simple cache helper function
function getCachedData(key) {
  const cached = kpiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  kpiCache.set(key, {
    data: data,
    timestamp: Date.now()
  });
}

client.connect()
  .then(() => {
    dbConnected = true;
    console.log("✅ Connected to PostgreSQL");
  })
  .catch(err => {
    console.error("❌ DB Connection Error:", err);
    console.log("💡 To fix this error:");
    console.log("   1. Make sure PostgreSQL is running");
    console.log("   2. Check your DATABASE_URL in .env file");
    console.log("   3. Verify database exists and credentials are correct");
    console.log("   4. For local development, try: PGSSL=disable");
  });

client.on('error', (err) => {
  dbConnected = false;
  console.error('❌ PostgreSQL client error:', err);
});

client.on('end', () => {
  dbConnected = false;
  console.warn('⚠️ PostgreSQL connection ended');
});

// Lightweight DB probe and reconnect helpers used by health checks
async function probeDb() {
  try {
    // Use a very cheap query
    await client.query('SELECT 1');
    return true;
  } catch (_) {
    return false;
  }
}

async function reconnectDbIfNeeded() {
  if (dbConnected) return true;
  try {
    // Attempt to connect; pg Client.connect() is idempotent if already connected
    await client.connect();
    dbConnected = true;
    console.log('🔌 Reconnected to PostgreSQL');
    return true;
  } catch (err) {
    console.warn('⚠️ Reconnect attempt failed:', err?.message || err);
    return false;
  }
}

// --------------------
// Fetch Keyword Data with Date Filtering
// --------------------
async function fetchKeywordData(startDate = null, endDate = null) {
  try {
    // Check if database is connected
    if (!dbConnected) {
      console.log("⚠️ Database not connected, returning empty data");
      return [];
    }
    
    const startTime = Date.now();
    
    // Select only the columns used by the frontend
    let query = `SELECT search_term, keyword_info, match_type, campaign_name, cost, sales_1d, clicks, impressions, purchases_1d, report_date
                 FROM amazon_ads_reports`;
    let params = [];
    
    if (startDate && endDate) {
      // Optimized: Use direct date comparison instead of DATE() function for better index usage
      query += " WHERE report_date >= $1::date AND report_date <= $2::date";
      params = [startDate, endDate];
      // Fetch ALL data for accurate calculations, but optimize the query
      query += ' ORDER BY report_date DESC, cost DESC';
    } else {
      // When no date range specified, fetch ALL data (removed 5000 limit to show all campaigns)
      // With 18K-20K records, this should still be fast enough
      query += ' ORDER BY report_date DESC, cost DESC';
    }
    
    const res = await client.query(query, params);
    const duration = Date.now() - startTime;
    console.log(`📊 Fetched ${res.rows.length} keyword records in ${duration}ms${startDate && endDate ? ' for date range' : ' (recent data)'}`);
    
    // Warn if query is slow
    if (duration > 2000) {
      console.warn(`⚠️ Slow query detected (${duration}ms). Consider adding database indexes.`);
    }
    
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching keywords:", err);
    console.log("⚠️ Database error, returning empty data");
    return [];
  }
}

// --------------------
// Fetch Business Data with Date Filtering and Aggregation by Parent ASIN
// --------------------
async function fetchBusinessData(startDate = null, endDate = null) {
  try {
    // Check if database is connected
    if (!dbConnected) {
      console.log("⚠️ Database not connected, returning empty aggregated data (no mock)");
      return [];
    }
    
    console.log('🔍 fetchBusinessData called with:', { startDate, endDate });
    
    // If no date range provided, aggregate by date for chart data
    if (!startDate || !endDate) {
      console.log('📊 Fetching ALL business data aggregated by date for chart');
      const query = `
        SELECT 
          (date AT TIME ZONE 'Asia/Kolkata')::date as date,
          SUM(CAST(sessions AS INTEGER)) as sessions,
          SUM(CAST(page_views AS INTEGER)) as page_views,
          SUM(CAST(units_ordered AS INTEGER)) as units_ordered,
          SUM(CAST(ordered_product_sales AS DECIMAL)) as ordered_product_sales
        FROM amazon_sales_traffic
        WHERE date IS NOT NULL
        GROUP BY (date AT TIME ZONE 'Asia/Kolkata')::date
        ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC
      `;
      
      const res = await client.query(query);
      console.log(`📊 Aggregated ${res.rows.length} unique dates from business data (ALL dates)`);
      
      // Debug: Show first few rows of business data
      if (res.rows.length > 0) {
        console.log('🔍 First 5 business data rows:', res.rows.slice(0, 5).map(row => ({
          date: row.date,
          ordered_product_sales: row.ordered_product_sales
        })));
        
        // Debug: Check specifically for September 8th
        const sep8Data = res.rows.filter(row => {
          const date = new Date(row.date);
          return date.getMonth() === 8 && date.getDate() === 8; // September 8th
        });
        console.log('🔍 September 8th business data:', sep8Data);
      }
      
      return res.rows;
    }
    
    // If date range provided, aggregate by date for specific date range
    // Use direct date comparison without timezone conversion to match stored dates
    let query = `
      SELECT 
        (date AT TIME ZONE 'Asia/Kolkata')::date as date,
        SUM(CAST(sessions AS INTEGER)) as sessions,
        SUM(CAST(page_views AS INTEGER)) as page_views,
        SUM(CAST(units_ordered AS INTEGER)) as units_ordered,
        SUM(CAST(ordered_product_sales AS DECIMAL)) as ordered_product_sales
      FROM amazon_sales_traffic
      WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
        AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
      GROUP BY (date AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC
    `;
    
    console.log('🔍 ===== EXECUTING BUSINESS DATA QUERY =====');
    console.log('🔍 Query:', query);
    console.log('🔍 Parameters:', [startDate, endDate]);
    
    // First, let's check what dates actually exist in the database
    console.log('🔍 ===== DEBUGGING: CHECKING DATABASE DATES =====');
    const debugQuery = `
      SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date, COUNT(*) as count
      FROM amazon_sales_traffic 
      GROUP BY (date AT TIME ZONE 'Asia/Kolkata')::date
      ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC
      LIMIT 10
    `;
    const debugResult = await client.query(debugQuery);
    console.log('🔍 Available dates in database (first 10):', debugResult.rows);
    
    // Check raw date values
    const rawDateQuery = `SELECT date FROM amazon_sales_traffic ORDER BY date DESC LIMIT 5`;
    const rawDateResult = await client.query(rawDateQuery);
    console.log('🔍 Raw date values in database:', rawDateResult.rows.map(r => r.date));
    
    const res = await client.query(query, [startDate, endDate]);
    console.log(`📊 Found ${res.rows.length} records for date range ${startDate} to ${endDate}`);
    console.log('🔍 Query result sample:', res.rows.slice(0, 3));
    console.log('🔍 All dates in result:', res.rows.map(r => ({ date: r.date, sessions: r.sessions, sales: r.ordered_product_sales })));
    
    if (res.rows.length === 0) {
      console.log('⚠️ ===== NO DATA FOUND - DEBUGGING =====');
      console.log('🔍 Let me check what dates actually exist in the database...');
      
      // Check all available dates
      const dateCheck = await client.query("SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date FROM amazon_sales_traffic ORDER BY date LIMIT 10");
      console.log('🔍 Available dates in database:', dateCheck.rows.map(r => r.date));
      
      // Check raw date values
      const rawDateCheck = await client.query('SELECT date FROM amazon_sales_traffic ORDER BY date LIMIT 5');
      console.log('🔍 Raw date values:', rawDateCheck.rows.map(r => r.date));
      
      // Check if there's data in August 2025 at all
      const augCheck = await client.query('SELECT COUNT(*) as count FROM amazon_sales_traffic WHERE EXTRACT(YEAR FROM date) = 2025 AND EXTRACT(MONTH FROM date) = 8');
      console.log('🔍 Records in August 2025:', augCheck.rows[0].count);
      
      // Check what dates exist around the requested range
      const rangeCheck = await client.query("SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date FROM amazon_sales_traffic WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date - INTERVAL '7 days' AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date + INTERVAL '7 days' ORDER BY date", [startDate, endDate]);
      console.log('🔍 Dates around requested range (±7 days):', rangeCheck.rows.map(r => r.date));
      
      // Check total records in table
      const totalCheck = await client.query('SELECT COUNT(*) as count FROM amazon_sales_traffic');
      console.log('🔍 Total records in amazon_sales_traffic table:', totalCheck.rows[0].count);
      
      console.log('🔍 ===== CHECKING FOR AVAILABLE DATES WITHIN SELECTED RANGE =====');
      
      // Check if there are ANY dates within the selected range that have data
      const availableDatesQuery = `
        SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date
        FROM amazon_sales_traffic
        WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
          AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
        ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC
      `;
      
      const availableDatesResult = await client.query(availableDatesQuery, [startDate, endDate]);
      console.log('🔍 Available dates within selected range:', availableDatesResult.rows.map(r => r.date));
      
      if (availableDatesResult.rows.length > 0) {
        // Get data for all available dates within the selected range
        const availableDataQuery = `
          SELECT 
            (date AT TIME ZONE 'Asia/Kolkata')::date as date,
            SUM(CAST(sessions AS INTEGER)) as sessions,
            SUM(CAST(page_views AS INTEGER)) as page_views,
            SUM(CAST(units_ordered AS INTEGER)) as units_ordered,
            SUM(CAST(ordered_product_sales AS DECIMAL)) as ordered_product_sales
          FROM amazon_sales_traffic
          WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
            AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
          GROUP BY (date AT TIME ZONE 'Asia/Kolkata')::date
          ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC
        `;
        
        const availableDataResult = await client.query(availableDataQuery, [startDate, endDate]);
        console.log('✅ Found data for', availableDataResult.rows.length, 'dates within selected range');
        console.log('🔍 Available dates with data:', availableDataResult.rows.map(r => r.date));
        return availableDataResult.rows;
      }
      
      console.log('🔍 No data found within selected range, returning empty array');
      return [];
    } else {
      console.log('🔍 ===== DATA FOUND =====');
      console.log('🔍 Sample data found:', res.rows.slice(0, 2));
      console.log('🔍 Showing data for available dates within the selected range');
      console.log('🔍 Found data for dates:', res.rows.map(r => r.date));
      console.log('🔍 Data summary:', res.rows.map(r => ({
        date: r.date,
        sessions: r.sessions,
        pageViews: r.page_views,
        unitsOrdered: r.units_ordered,
        sales: r.ordered_product_sales
      })));
    }
    
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching business data:", err);
    console.log("⚠️ Database error, returning empty data");
    return [];
  }
}

// --------------------
// Fetch Business Rows (per SKU/ASIN) for Table View
// --------------------
async function fetchBusinessRows(startDate, endDate, includeAll = false) {
  try {
    if (!dbConnected) {
      console.log("⚠️ Database not connected, returning empty business rows (no mock)");
      return [];
    }

    if (!startDate || !endDate) {
      // Fallback: last 30 days if not provided
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      startDate = toYmd(start);
      endDate = toYmd(end);
    }

    let query;
    if (includeAll) {
      // Include ALL individual entries (for complete export)
      query = `
        SELECT 
          (date AT TIME ZONE 'Asia/Kolkata')::date as date,
          COALESCE(NULLIF(parent_asin, ''), 'Unknown') as parent_asin,
          COALESCE(NULLIF(sku, ''), 'Unknown') as sku,
          COALESCE(NULLIF(parent_asin, ''), NULLIF(sku, ''), 'Unknown Product') as product_title,
          CAST(sessions AS INTEGER) as sessions,
          CAST(page_views AS INTEGER) as page_views,
          CAST(units_ordered AS INTEGER) as units_ordered,
          CAST(ordered_product_sales AS DECIMAL) as ordered_product_sales
        FROM amazon_sales_traffic
        WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
          AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
        ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC, ordered_product_sales DESC NULLS LAST
      `;
    } else {
      // Only include rows with activity (for frontend table)
      query = `
        SELECT 
          (date AT TIME ZONE 'Asia/Kolkata')::date as date,
          COALESCE(NULLIF(parent_asin, ''), 'Unknown') as parent_asin,
          COALESCE(NULLIF(sku, ''), 'Unknown') as sku,
          COALESCE(NULLIF(parent_asin, ''), NULLIF(sku, ''), 'Unknown Product') as product_title,
          CAST(sessions AS INTEGER) as sessions,
          CAST(page_views AS INTEGER) as page_views,
          CAST(units_ordered AS INTEGER) as units_ordered,
          CAST(ordered_product_sales AS DECIMAL) as ordered_product_sales
        FROM amazon_sales_traffic
        WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
          AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
          AND (CAST(sessions AS INTEGER) > 0 
               OR CAST(page_views AS INTEGER) > 0 
               OR CAST(units_ordered AS INTEGER) > 0 
               OR CAST(ordered_product_sales AS DECIMAL) > 0)
        ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC, ordered_product_sales DESC NULLS LAST
      `;
    }

    const res = await client.query(query, [startDate, endDate]);
    console.log(`📦 Fetched ${res.rows.length} business rows for table between ${startDate} and ${endDate}`);
    
    // If no data found for the specific date range, return empty array
    if (res.rows.length === 0) {
      console.log('🔍 No detailed rows found for selected date range - returning empty array');
      return [];
    }
    
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching business rows:", err);
    return [];
  }
}

// Lightweight date bounds query to avoid scanning all rows into memory
async function getGlobalDateRange() {
  try {
    if (!dbConnected) return null;
    const [adMinMax, bizMinMax] = await Promise.all([
      client.query('SELECT MIN(report_date) AS min, MAX(report_date) AS max FROM amazon_ads_reports'),
      client.query("SELECT MIN((date AT TIME ZONE 'Asia/Kolkata')::date) AS min, MAX((date AT TIME ZONE 'Asia/Kolkata')::date) AS max FROM amazon_sales_traffic")
    ]);
    const dates = [];
    if (adMinMax.rows[0].min) { dates.push(new Date(adMinMax.rows[0].min)); }
    if (adMinMax.rows[0].max) { dates.push(new Date(adMinMax.rows[0].max)); }
    if (bizMinMax.rows[0].min) { dates.push(new Date(bizMinMax.rows[0].min)); }
    if (bizMinMax.rows[0].max) { dates.push(new Date(bizMinMax.rows[0].max)); }
    if (!dates.length) return null;
    return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
  } catch (e) {
    console.error('getGlobalDateRange error:', e);
    return null;
  }
}

// --------------------
// KPI Calculations
// --------------------
function calculateKeywordKPIs(data) {
  let totalCost = 0, totalSales = 0, totalClicks = 0, totalImpressions = 0, totalPurchases = 0;

  data.forEach(row => {
    totalCost += parseFloat(row.cost || 0);
    totalSales += parseFloat(row.sales_1d || 0);
    totalClicks += parseInt(row.clicks || 0);
    totalImpressions += parseInt(row.impressions || 0);
    totalPurchases += parseInt(row.purchases_1d || 0);
  });

  return {
    totalCost,
    totalSales,
    acos: totalSales > 0 ? (totalCost / totalSales) * 100 : 0,
    roas: totalCost > 0 ? totalSales / totalCost : 0,
    clicks: totalClicks,
    avgCPC: totalClicks > 0 ? totalCost / totalClicks : 0,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    tcos: totalSales > 0 ? (totalCost / totalSales) * 100 : 0,
  };
}

function calculateBusinessKPIs(data) {
  let totalSessions = 0, totalPageViews = 0, totalUnitsOrdered = 0, totalSales = 0;

  data.forEach(row => {
    totalSessions += parseInt(row.sessions || 0);
    totalPageViews += parseInt(row.page_views || 0);
    totalUnitsOrdered += parseInt(row.units_ordered || 0);
    totalSales += parseFloat(row.ordered_product_sales || 0);
  });

  return {
    totalSessions,
    totalPageViews,
    totalUnitsOrdered,
    totalSales,
    avgSessionsPerDay: data.length > 0 ? totalSessions / data.length : 0,
    conversionRate: totalSessions > 0 ? (totalUnitsOrdered / totalSessions) * 100 : 0,
    avgOrderValue: totalUnitsOrdered > 0 ? totalSales / totalUnitsOrdered : 0,
  };
}

// --------------------
// Enhanced KPI Calculations for Dashboard
// --------------------
function calculateDashboardKPIs(keywordData, businessData) {
  let totalAdSpend = 0, totalAdSales = 0, totalSales = 0, totalClicks = 0, totalImpressions = 0;
  let totalSessions = 0, totalPageViews = 0, totalUnitsOrdered = 0;

  // Calculate from keyword data (ads data)
  keywordData.forEach(row => {
    totalAdSpend += parseFloat(row.cost || 0);
    totalAdSales += parseFloat(row.sales_1d || 0);
    totalClicks += parseInt(row.clicks || 0);
    totalImpressions += parseInt(row.impressions || 0);
  });

  // Calculate from business data (ordered_product_sales = TOTAL SALES including ad + organic)
  if (businessData && businessData.length > 0) {
    businessData.forEach(row => {
      totalSales += parseFloat(row.ordered_product_sales || 0);
      totalSessions += parseInt(row.sessions || 0);
      totalPageViews += parseInt(row.page_views || 0);
      totalUnitsOrdered += parseInt(row.units_ordered || 0);
    });
  }

  // FIXED LOGIC: ordered_product_sales already includes both ad and organic sales
  // Only use ad sales as fallback if NO business data is available at all
  if (totalSales === 0 && totalAdSales > 0 && (!businessData || businessData.length === 0)) {
    console.log('⚠️ No business data available, using ad sales as total sales fallback');
    totalSales = totalAdSales;
  } else if (totalSales > 0) {
    console.log('✅ Using business data total sales (includes ad + organic)');
  }

  console.log('🔍 KPI Calculation Debug:', {
    totalAdSpend: totalAdSpend.toFixed(2),
    totalAdSales: totalAdSales.toFixed(2),
    totalSales: totalSales.toFixed(2),
    businessDataLength: businessData ? businessData.length : 0,
    keywordDataLength: keywordData ? keywordData.length : 0,
    dataIntegrityCheck: totalSales >= totalAdSales ? 'PASS' : 'FAIL',
    calculatedACOS: totalAdSales > 0 ? ((totalAdSpend / totalAdSales) * 100).toFixed(2) + '%' : '0%',
    calculatedTCOS: totalSales > 0 ? ((totalAdSpend / totalSales) * 100).toFixed(2) + '%' : '0%',
    calculatedROAS: totalAdSpend > 0 ? (totalAdSales / totalAdSpend).toFixed(2) : '0',
    businessDataSample: businessData ? businessData.slice(0, 3).map(row => ({
      date: row.date,
      ordered_product_sales: row.ordered_product_sales
    })) : 'No business data'
  });

  return {
    adSpend: totalAdSpend,
    adSales: totalAdSales,
    totalSales: totalSales,
    acos: totalAdSales > 0 ? (totalAdSpend / totalAdSales) * 100 : 0,
    tacos: totalSales > 0 ? (totalAdSpend / totalSales) * 100 : 0,
    roas: totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0,
    adClicks: totalClicks,
    avgCpc: totalClicks > 0 ? totalAdSpend / totalClicks : 0,
    impressions: totalImpressions,
    ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    sessions: totalSessions,
    pageViews: totalPageViews,
    unitsOrdered: totalUnitsOrdered,
    conversionRate: totalSessions > 0 ? (totalUnitsOrdered / totalSessions) * 100 : 0
  };
}


// --------------------
// Transform Database Data for Frontend
// --------------------
function transformKeywordDataForFrontend(dbData, businessData = []) {
  console.log('🔍 transformKeywordDataForFrontend called with:', {
    dbDataLength: dbData.length,
    businessDataLength: businessData.length,
    sampleBusinessData: businessData.slice(0, 3)
  });
  
  // First, aggregate business data by date to get total sales per date
  const businessDataByDate = {};
  businessData.forEach(bizRow => {
    // Use YYYY-MM-DD format for consistent date matching
    const date = new Date(bizRow.date);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!businessDataByDate[dateStr]) {
      businessDataByDate[dateStr] = {
        totalSales: 0,
        totalSessions: 0,
        totalPageViews: 0,
        totalUnitsOrdered: 0
      };
    }
    businessDataByDate[dateStr].totalSales += parseFloat(bizRow.ordered_product_sales || 0);
    businessDataByDate[dateStr].totalSessions += parseInt(bizRow.sessions || 0);
    businessDataByDate[dateStr].totalPageViews += parseInt(bizRow.page_views || 0);
    businessDataByDate[dateStr].totalUnitsOrdered += parseInt(bizRow.units_ordered || 0);
  });

  console.log('🔍 Business data by date:', Object.keys(businessDataByDate).map(date => ({
    date,
    totalSales: businessDataByDate[date].totalSales
  })));
  
  // Debug: Show all available business dates
  console.log('🔍 All business dates available:', Object.keys(businessDataByDate));

  // CRITICAL FIX: Create a map to track which dates have been processed for total sales
  // This prevents duplicate total sales values when multiple keywords exist for the same date
  const processedDates = new Set();
  const totalSalesByDate = {};

  return dbData.map(row => {
    // Find matching business data for the same date to get real total sales
    // Use YYYY-MM-DD format to match business data keys
    const keywordDate = new Date(row.report_date);
    const keywordDateStr = keywordDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const matchingBusinessData = businessDataByDate[keywordDateStr];
    
    // FIXED LOGIC: ordered_product_sales = TOTAL SALES (ad + organic)
    // Only use business data total sales once per date to avoid duplication
    let realTotalSales = 0;
    
    if (matchingBusinessData && matchingBusinessData.totalSales > 0) {
      // Use business data total sales only once per date
      if (!processedDates.has(keywordDateStr)) {
        realTotalSales = matchingBusinessData.totalSales;
        totalSalesByDate[keywordDateStr] = realTotalSales;
        processedDates.add(keywordDateStr);
        // Only log first occurrence (reduced logging)
      } else {
        // For subsequent keywords on the same date, use 0 to avoid duplication
        realTotalSales = 0;
        // Removed excessive duplicate logging
      }
    } else {
      // No business data available - use 0 instead of ad sales to avoid confusion
      realTotalSales = 0;
      // Only log if this is a new date without business data
      if (!processedDates.has(keywordDateStr)) {
        processedDates.add(keywordDateStr);
      }
    }
    
    // Debug: Check if we have business data for this date
    if (keywordDateStr.includes('2025-09-08') || keywordDateStr.includes('Sep 8')) {
      console.log('🔍 Sep 8 business data lookup:', {
        keywordDateStr,
        businessDataAvailable: Object.keys(businessDataByDate),
        matchingBusinessData: matchingBusinessData ? matchingBusinessData.totalSales : 'No match',
        fallbackAdSales: parseFloat(row.sales_1d || 0),
        finalTotalSales: realTotalSales,
        isFirstOccurrence: !processedDates.has(keywordDateStr)
      });
    }
    
    // Debug: Log when totalSales equals spend
    if (realTotalSales === parseFloat(row.cost || 0)) {
      console.error(`🚨 Backend Bug: Date ${keywordDateStr} has totalSales=${realTotalSales} equals spend=${row.cost}`);
      console.log('Business data available:', !!matchingBusinessData);
      console.log('Business sales value:', matchingBusinessData?.totalSales);
    }
    
    // Debug logging for September dates
    if (keywordDateStr.includes('Sep 08 2025') || keywordDateStr.includes('Sep 08') || 
        keywordDateStr.includes('Sep 25 2025') || keywordDateStr.includes('Sep 25')) {
      console.log('🔍 September data:', {
        keywordDateStr,
        adSales: parseFloat(row.sales_1d || 0),
        realTotalSales,
        hasBusinessData: !!matchingBusinessData,
        businessDataValue: matchingBusinessData?.totalSales,
        businessDataKeys: Object.keys(businessDataByDate),
        isFirstOccurrence: !processedDates.has(keywordDateStr)
      });
    }
    
    // Debug: Show first few keyword dates being processed
    if (dbData.indexOf(row) < 5) {
      console.log('🔍 Keyword date being processed:', {
        index: dbData.indexOf(row),
        keywordDateStr,
        hasMatchingBusinessData: !!matchingBusinessData,
        realTotalSales,
        isFirstOccurrence: !processedDates.has(keywordDateStr)
      });
    }
    
    const result = {
      searchTerm: row.search_term || 'Unknown',
      keywords: row.keyword_info || row.match_type || '',
      campaignName: row.campaign_name || 'Unknown Campaign',
      spend: parseFloat(row.cost || 0),
      sales: parseFloat(row.sales_1d || 0),
      // Use real business data for total sales instead of fake calculation
      totalSales: realTotalSales,
      clicks: parseInt(row.clicks || 0),
      impressions: parseInt(row.impressions || 0),
      date: row.report_date
    };
    
    // Debug: Log when totalSales equals ad sales (indicates no business data match)
    if (realTotalSales === parseFloat(row.sales_1d || 0) && parseFloat(row.sales_1d || 0) > 0) {
      console.log('⚠️ No business data match for date:', {
        date: keywordDateStr,
        adSales: parseFloat(row.sales_1d || 0),
        totalSales: realTotalSales,
        hasBusinessData: !!matchingBusinessData
      });
    }
    
    // Debug: Log the final result for September 8th
    if (keywordDateStr.includes('2025-09-08')) {
      console.log('🔍 Final result for Sep 8:', {
        date: result.date,
        spend: result.spend,
        sales: result.sales,
        totalSales: result.totalSales,
        realTotalSales: realTotalSales,
        rowIndex: dbData.indexOf(row),
        totalRows: dbData.length
      });
    }
    
    return result;
  });
}

// --------------------
// API Endpoints
// --------------------

// ✅ Health check endpoint
app.get('/health', async (req, res) => {
  // Allow health to be called from any origin (covers file:// and other ports)
  try {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  } catch (_) {}
  // Live-check DB; auto-reconnect if needed
  let database = dbConnected ? 'Connected' : 'Disconnected';
  if (!dbConnected) {
    const re = await reconnectDbIfNeeded();
    database = re ? 'Connected' : 'Disconnected';
  }
  if (database === 'Connected') {
    const ok = await probeDb();
    if (!ok) database = 'Disconnected';
  }
  res.json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database
  });
});

// ✅ Test endpoint to verify API calls are reaching the backend
app.get('/api/test', (req, res) => {
  console.log('🧪 TEST ENDPOINT CALLED - API is working!');
  res.json({ 
    message: 'Test endpoint working!', 
    timestamp: new Date().toISOString(),
    query: req.query
  });
});

// ✅ Debug endpoint to clear cache and check status
app.get('/debug/clear-cache', (req, res) => {
  clearCache();
  res.json({ 
    message: 'Cache cleared',
    database: dbConnected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// ✅ Root endpoint – Dashboard summary
app.get('/', async (req, res) => {
  try {
    const keywordData = await fetchKeywordData();
    const businessData = await fetchBusinessData();

    const keywordKPIs = calculateKeywordKPIs(keywordData);
    const businessKPIs = calculateBusinessKPIs(businessData);

    res.json({
      message: "🚀 Welcome to Amazon Analytics API",
      endpoints: ["/health", "/api/keywords", "/api/business-data", "/api/analytics"],
      summary: {
        keywordKPIs,
        businessKPIs
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

// ✅ Keywords endpoint
app.get('/api/keywords', async (req, res) => {
  try {
    const data = await fetchKeywordData();
    const kpis = calculateKeywordKPIs(data);
    res.json({ data, kpis });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// Test endpoint removed - duplicate endpoint was causing conflicts

// ✅ Business data endpoint - dedicated to business data only
app.get('/api/business-data', async (req, res) => {
  try {
    console.log('🚀 ===== BUSINESS DATA API ENDPOINT CALLED =====');
    console.log('🔍 Request received at:', new Date().toISOString());
    console.log('🔍 Query parameters:', req.query);
    
    if (!dbConnected) {
      console.log('❌ Database not connected (business-data) - returning empty payload with 200');
      const emptyKpis = {
        totalSessions: 0,
        totalPageViews: 0,
        totalUnitsOrdered: 0,
        totalSales: 0,
        avgSessionsPerDay: 0,
        conversionRate: 0
      };
      return res.json({ data: [], kpis: emptyKpis, hasData: false, reason: 'db_disconnected' });
    }
    const { start, end, includeAll } = req.query;
    console.log('🔍 ===== BUSINESS DATA API CALLED - UPDATED VERSION =====');
    console.log('🔍 Query params received:', { start, end, includeAll });
    console.log('🔍 Full request query:', req.query);
    console.log('🔍 Database connected status:', dbConnected);
    // Use actual database data (no forced mock). If DB is unavailable, return empty data.
    
    let startDate = null, endDate = null;
    if (start && end) {
      // Use date strings directly to avoid any timezone conversion
      startDate = start; // e.g., "2025-07-01"
      endDate = end;     // e.g., "2025-07-02"
      console.log('🔍 Date range set:', { startDate, endDate });

      // Disable heuristic that widened single-day range to Lifetime to avoid hidden range changes
      
      // DEBUG: Check what dates exist in the database for this range
      console.log('🔍 ===== CHECKING DATABASE FOR DATE RANGE =====');
      try {
        const dateCheckQuery = `
          SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date, COUNT(*) as record_count
          FROM amazon_sales_traffic 
          WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
          GROUP BY (date AT TIME ZONE 'Asia/Kolkata')::date
          ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date
        `;
        const dateCheckResult = await client.query(dateCheckQuery, [startDate, endDate]);
        console.log('🔍 Dates found in database for range:', dateCheckResult.rows);
        console.log('🔍 Total dates with data:', dateCheckResult.rows.length);
        
        // Also check what dates exist in the entire database
        const allDatesQuery = `
          SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date
          FROM amazon_sales_traffic 
          ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date DESC
          LIMIT 20
        `;
        const allDatesResult = await client.query(allDatesQuery);
        console.log('🔍 Recent dates in entire database:', allDatesResult.rows.map(r => r.date));
        
      } catch (debugErr) {
        console.error('🔍 Error checking database dates:', debugErr);
      }
    } else {
      console.log('🔍 No date range provided, computing Lifetime (DB min -> today)');
      try {
        const range = await getGlobalDateRange();
        if (range && range.min && range.max) {
          const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          startDate = toYmd(new Date(range.min));
          // Lifetime goes through today, but also cap by DB max to avoid future gaps
          const today = new Date();
          const maxDb = new Date(range.max);
          const endCap = (maxDb && maxDb < today) ? maxDb : today;
          endDate = toYmd(endCap);
          console.log('🔍 Lifetime resolved to:', { startDate, endDate });
        }
      } catch (e) {
        console.log('⚠️ Could not compute global date range:', e?.message);
      }
    }

    // Fetch only detailed rows for this exact window and compute KPIs from them
    let detailedData = [];
    try {
      console.log('🔍 ===== FETCHING DETAILED DATA (SINGLE SOURCE OF TRUTH) =====');
      console.log('🔍 Parameters being passed to fetchBusinessRows:', { startDate, endDate });
      detailedData = await fetchBusinessRows(startDate, endDate, includeAll === 'true');
    } catch (e) {
      console.error('❌ Error fetching detailed rows:', e.message);
      detailedData = [];
    }

    const sums = detailedData.reduce((acc, r) => {
      acc.sessions += Number(r.sessions || 0);
      acc.pageViews += Number(r.page_views || 0);
      acc.units += Number(r.units_ordered || 0);
      acc.sales += Number(r.ordered_product_sales || 0);
      if (r.date) acc.dates.add(String(r.date).slice(0,10));
      return acc;
    }, { sessions: 0, pageViews: 0, units: 0, sales: 0, dates: new Set() });
    const dayCount = sums.dates.size;
    const kpis = {
      totalSessions: sums.sessions,
      totalPageViews: sums.pageViews,
      totalUnitsOrdered: sums.units,
      totalSales: sums.sales,
      avgSessionsPerDay: dayCount > 0 ? (sums.sessions / dayCount) : 0,
      conversionRate: sums.sessions > 0 ? (sums.units / sums.sessions) * 100 : 0
    };
    console.log('🔍 ===== FINAL RESPONSE (DETAILED-BASED KPIs) =====');
    console.log('🔍 Response summary:', {
      detailedDataLength: detailedData.length,
      kpis,
      dayCount
    });
    res.json({ data: detailedData, kpis });
  } catch (err) {
    console.error('❌ Error in /api/business-data endpoint:', err);
    res.status(500).json({ error: 'Failed to fetch business data' });
  }
});

// ✅ Analytics endpoint for dashboard with date filtering
app.get('/api/analytics', async (req, res) => {
  // ⏱️ START PERFORMANCE TRACKING
  const requestStartTime = Date.now();
  console.log('\n⏱️ ========== NEW API REQUEST ==========');
  console.log(`⏱️ Request received at: ${new Date().toISOString()}`);
  
  try {
    if (!dbConnected) {
      // Graceful degrade: return empty payload instead of 503 to avoid UI errors
      return res.json({
        rows: [],
        kpis: {
          adSpend: 0,
          adSales: 0,
          totalSales: 0,
          acos: 0,
          tacos: 0,
          roas: 0,
          adClicks: 0,
          avgCpc: 0
        },
        dataRange: null,
        totalRows: 0
      });
    }
    const { start, end } = req.query;
    const kpisOnly = String(req.query.kpisOnly).toLowerCase() === 'true';
    console.log(`⏱️ Date range requested: ${start || 'ALL'} to ${end || 'ALL'}`);
    if (kpisOnly) {
      console.log('⏱️ Mode: KPIs-only (fast path)');
    }
    
    let startDate = null, endDate = null;
    
    if (start && end) {
      // Use date strings directly to avoid any timezone conversion
      startDate = start; // e.g., "2025-07-01"
      endDate = end;     // e.g., "2025-07-02"
    }
    
    // Use the exact start/end provided by the UI without modification
    const effectiveEndDate = endDate;

    // Create cache key for this request
    const cacheKey = `analytics_${startDate || 'all'}_${effectiveEndDate || endDate || 'all'}`;
    
    // TEMPORARILY DISABLE CACHE to test the fix
    // Check cache first
    const cachedResult = getCachedData(cacheKey);
    if (false && cachedResult) { // Disabled cache for testing
      console.log('📊 Returning cached analytics data');
      return res.json(cachedResult);
    }
    
    // ⏱️ DATABASE QUERY START
    const dbQueryStartTime = Date.now();
    console.log(`⏱️ Starting database queries...`);

    if (kpisOnly) {
      // Fast KPI path: aggregate directly in SQL and skip heavy row transformation
      const endBound = effectiveEndDate || endDate;

      // Aggregate ad metrics from amazon_ads_reports
      const adAggSql = `
        SELECT 
          COALESCE(SUM(CAST(cost AS DECIMAL)), 0)               AS ad_spend,
          COALESCE(SUM(CAST(sales_1d AS DECIMAL)), 0)           AS ad_sales,
          COALESCE(SUM(CAST(clicks AS INTEGER)), 0)             AS clicks,
          COALESCE(SUM(CAST(impressions AS INTEGER)), 0)        AS impressions,
          COUNT(*)                                              AS total_rows
        FROM amazon_ads_reports
        WHERE report_date >= $1::date AND report_date <= $2::date
      `;

      const bizAggSql = `
        SELECT COALESCE(SUM(CAST(ordered_product_sales AS DECIMAL)), 0) AS total
        FROM amazon_sales_traffic
        WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
          AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
      `;

      const [adRes, bizRes] = await Promise.all([
        client.query(adAggSql, [startDate, endBound]),
        client.query(bizAggSql, [startDate, endBound])
      ]);

      const ad = adRes.rows?.[0] || {};
      const totalSales = parseFloat(bizRes.rows?.[0]?.total || 0);
      const adSpend = parseFloat(ad.ad_spend || 0);
      const adSales = parseFloat(ad.ad_sales || 0);
      const clicks = parseInt(ad.clicks || 0);

      const avgCpc = clicks > 0 ? adSpend / clicks : 0;
      const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
      const roas = adSpend > 0 ? adSales / adSpend : 0;
      const tacos = totalSales > 0 ? (adSpend / totalSales) * 100 : 0;

      const dbQueryDuration = Date.now() - dbQueryStartTime;
      console.log(`⏱️ KPI-only DB aggregates completed in: ${dbQueryDuration}ms`);

      const responseData = {
        rows: [],
        kpis: {
          adSpend,
          adSales,
          totalSales,
          acos,
          tacos,
          roas,
          adClicks: clicks,
          avgCpc
        },
        dataRange: await getGlobalDateRange(),
        totalRows: parseInt(ad.total_rows || 0)
      };

      const totalDuration = Date.now() - requestStartTime;
      console.log(`\n⏱️ KPI-ONLY REQUEST COMPLETE in ${totalDuration}ms (DB: ${dbQueryDuration}ms)`);
      return res.json(responseData);
    }

    // Full data path: fetch rows and business data
    const [keywordData, businessDataForChart, businessDataForKPIs] = await Promise.all([
      fetchKeywordData(startDate, effectiveEndDate || endDate),
      fetchBusinessData(startDate, effectiveEndDate || endDate),
      fetchBusinessData(startDate, effectiveEndDate || endDate)
    ]);

    // ⏱️ DATABASE QUERY END
    const dbQueryDuration = Date.now() - dbQueryStartTime;
    console.log(`⏱️ Database queries completed in: ${dbQueryDuration}ms`);
    
    // Already date-filtered from DB; use directly
    let finalBusinessDataForKPIs = businessDataForKPIs || [];
    let finalBusinessDataForFrontend = businessDataForKPIs || [];
    
    console.log('🔍 Business data strategy:', {
      businessDataForKPIsLength: businessDataForKPIs.length,
      businessDataForChartLength: businessDataForChart.length,
      finalBusinessDataForKPIsLength: finalBusinessDataForKPIs.length,
      finalBusinessDataForFrontendLength: finalBusinessDataForFrontend.length
    });
    
    console.log('🔍 Data Fetch Results:', {
      keywordDataLength: keywordData.length,
      businessDataForChartLength: businessDataForChart.length,
      businessDataForKPIsLength: businessDataForKPIs.length,
      finalBusinessDataLength: finalBusinessDataForKPIs.length,
      dateRange: { startDate, endDate, effectiveEndDate }
    });
    
    // Debug: Show sample business data
    if (finalBusinessDataForKPIs.length > 0) {
      console.log('🔍 Sample business data for KPIs:', finalBusinessDataForKPIs.slice(0, 3).map(row => ({
        date: row.date,
        ordered_product_sales: row.ordered_product_sales
      })));
    } else {
      console.log('❌ No business data available for KPI calculation');
    }
    
    console.log(`📊 Fetched ${keywordData.length} keyword rows from database`);
    console.log(`📊 Fetched ${businessDataForChart.length} business rows for chart`);
    console.log(`📊 Fetched ${businessDataForKPIs.length} business rows for KPIs`);
    console.log(`📊 Using ${finalBusinessDataForKPIs.length} business rows for final KPI calculation`);
    console.log(`📊 Using ${finalBusinessDataForFrontend.length} business rows for frontend transformation`);
    
    let kpis = calculateDashboardKPIs(keywordData, finalBusinessDataForKPIs);

    // Harden TOTAL SALES: compute directly via SQL SUM for the exact date window
    try {
      if (startDate && (effectiveEndDate || endDate)) {
        const endBound = effectiveEndDate || endDate;
        const totalSalesSql = `
          SELECT COALESCE(SUM(CAST(ordered_product_sales AS DECIMAL)), 0) AS total
          FROM amazon_sales_traffic
          WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date 
            AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date
        `;
        const totalSalesRes = await client.query(totalSalesSql, [startDate, endBound]);
        const strictTotal = parseFloat(totalSalesRes.rows?.[0]?.total || 0);
        // Override KPI totalSales and recompute dependent metrics
        kpis.totalSales = strictTotal;
        kpis.tacos = strictTotal > 0 ? (kpis.adSpend / strictTotal) * 100 : 0;
      }
    } catch (strictErr) {
      console.log('⚠️ SQL strict total sales fallback failed:', strictErr.message);
    }
    // ⏱️ DATA PROCESSING START
    const processingStartTime = Date.now();
    console.log(`⏱️ Starting data transformation...`);
    
    const rows = transformKeywordDataForFrontend(keywordData, finalBusinessDataForFrontend);
    
    // ⏱️ DATA PROCESSING END
    const processingDuration = Date.now() - processingStartTime;
    console.log(`⏱️ Data transformation completed in: ${processingDuration}ms`);

    // Summary log (clean and informative)
    const uniqueDates = new Set(rows.map(r => r.date || r.report_date)).size;
    console.log(`\n📊 Data Processing Summary:`);
    console.log(`   ✅ Processed ${rows.length} keyword rows`);
    console.log(`   📅 ${uniqueDates} unique dates`);
    console.log(`   💰 Business data available for ${finalBusinessDataForFrontend.length} dates\n`); 
    
    // Get data range for date picker via lightweight query
    const dataRange = await getGlobalDateRange();
    
    // Prepare response data
    const responseData = {
      rows: rows || [],
      kpis: rows && rows.length > 0 ? kpis : {
        adSpend: 0,
        adSales: 0,
        totalSales: 0,
        acos: 0,
        tacos: 0,
        roas: 0,
        adClicks: 0,
        avgCpc: 0
      },
      dataRange,
      totalRows: rows ? rows.length : 0
    };
    
    // Cache the result
    setCachedData(cacheKey, responseData);
    
    // ⏱️ TOTAL REQUEST TIME
    const totalDuration = Date.now() - requestStartTime;
    console.log(`\n⏱️ ========== REQUEST COMPLETE ==========`);
    console.log(`⏱️ Database queries:     ${dbQueryDuration}ms (${((dbQueryDuration/totalDuration)*100).toFixed(1)}%)`);
    console.log(`⏱️ Data processing:      ${processingDuration}ms (${((processingDuration/totalDuration)*100).toFixed(1)}%)`);
    console.log(`⏱️ TOTAL TIME:           ${totalDuration}ms`);
    console.log(`⏱️ Rows returned:        ${rows.length}`);
    console.log(`⏱️ =======================================\n`);
    
    // Return response
    res.json(responseData);
    
  } catch (err) {
    console.error('Analytics endpoint error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// ✅ New endpoint to get available date ranges for business data
app.get('/api/date-range', async (req, res) => {
  try {
    if (!dbConnected) {
      console.log('⚠️ Database not connected, returning empty date range');
      return res.json({
        minDate: null,
        maxDate: null,
        hasData: false
      });
    }
    
    console.log('📅 Fetching available date range from database...');
    
    // Get date range from business data (since that's what we're displaying)
    const query = `
      SELECT 
        MIN(date) as min_date,
        MAX(date) as max_date,
        COUNT(*) as total_records
      FROM amazon_sales_traffic
    `;
    
    const result = await client.query(query);
    const { min_date, max_date, total_records } = result.rows[0];
    
    console.log('📅 Available date range:', { min_date, max_date, total_records });
    
    if (min_date && max_date) {
      res.json({
        minDate: min_date,
        maxDate: max_date,
        hasData: true,
        totalRecords: parseInt(total_records)
      });
    } else {
      res.json({
        minDate: null,
        maxDate: null,
        hasData: false,
        totalRecords: 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching date range:', error);
    res.status(500).json({ error: 'Failed to fetch date range' });
  }
});

// ✅ New endpoint specifically for business data date range
app.get('/api/business-date-range', async (req, res) => {
  try {
    if (!dbConnected) {
      console.log('⚠️ Database not connected, returning empty business date range');
      return res.json({
        minDate: null,
        maxDate: null,
        hasData: false
      });
    }
    
    console.log('📅 Fetching available business data date range...');
    
    // Get date range specifically from business data table (amazon_sales_traffic)
    // Only return dates that actually have business data
    const query = `
      SELECT 
        MIN((date AT TIME ZONE 'Asia/Kolkata')::date) as min_date,
        MAX((date AT TIME ZONE 'Asia/Kolkata')::date) as max_date,
        COUNT(*) as total_records,
        COUNT(DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date) as unique_dates
      FROM amazon_sales_traffic
      WHERE date IS NOT NULL
    `;
    
    const result = await client.query(query);
    const { min_date, max_date, total_records, unique_dates } = result.rows[0];
    
    console.log('📅 Business data date range:', { 
      min_date, 
      max_date, 
      total_records, 
      unique_dates 
    });
    
    if (min_date && max_date) {
      res.json({
        minDate: min_date,
        maxDate: max_date,
        hasData: true,
        totalRecords: parseInt(total_records),
        uniqueDates: parseInt(unique_dates)
      });
    } else {
      res.json({
        minDate: null,
        maxDate: null,
        hasData: false,
        totalRecords: 0,
        uniqueDates: 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching business date range:', error);
    res.status(500).json({ error: 'Failed to fetch business date range' });
  }
});

// ✅ New endpoint to get all available dates from business table
app.get('/api/business-available-dates', async (req, res) => {
  try {
    if (!dbConnected) {
      console.log('⚠️ Database not connected, returning empty available dates');
      return res.json({
        dates: [],
        hasData: false
      });
    }
    
    console.log('📅 Fetching all available dates from business table...');
    
    // Get all unique dates that have business data
    const query = `
      SELECT DISTINCT (date AT TIME ZONE 'Asia/Kolkata')::date as date
      FROM amazon_sales_traffic
      WHERE date IS NOT NULL
      ORDER BY (date AT TIME ZONE 'Asia/Kolkata')::date ASC
    `;
    
    const result = await client.query(query);
    const dates = result.rows.map(row => row.date);
    
    console.log('📅 Available business dates:', { 
      totalDates: dates.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1]
    });
    
    if (dates.length > 0) {
      res.json({
        dates: dates,
        hasData: true,
        totalDates: dates.length
      });
    } else {
      res.json({
        dates: [],
        hasData: false,
        totalDates: 0
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching business available dates:', error);
    res.status(500).json({ error: 'Failed to fetch business available dates' });
  }
});

// ✅ Debug endpoint to test database queries directly
app.get('/api/debug-dates', async (req, res) => {
  try {
    if (!dbConnected) {
      // Fail-soft: expose state but do not 500
      return res.json({ error: 'Database not connected', data: null });
    }
    
    const { start, end } = req.query;
    console.log('🔍 Debug endpoint called with:', { start, end });
    
    // Test 1: Get all dates in business table
    const businessDatesQuery = `SELECT DISTINCT date FROM amazon_sales_traffic ORDER BY date DESC LIMIT 20`;
    const businessDatesResult = await client.query(businessDatesQuery);
    const businessDates = businessDatesResult.rows.map(row => row.date);
    
    // Test 2: Get all dates in ads table
    const adsDatesQuery = `SELECT DISTINCT report_date FROM amazon_ads_reports ORDER BY report_date DESC LIMIT 20`;
    const adsDatesResult = await client.query(adsDatesQuery);
    const adsDates = adsDatesResult.rows.map(row => row.report_date);
    
    // Test 3: Get date ranges for both tables
    const businessRangeQuery = `SELECT MIN(date) as min_date, MAX(date) as max_date, COUNT(*) as count FROM amazon_sales_traffic`;
    const businessRangeResult = await client.query(businessRangeQuery);
    
    const adsRangeQuery = `SELECT MIN(report_date) as min_date, MAX(report_date) as max_date, COUNT(*) as count FROM amazon_ads_reports`;
    const adsRangeResult = await client.query(adsRangeQuery);
    
    // Test 4: If date range provided, test the query
    let rangeQueryResult = null;
    if (start && end) {
      const rangeQuery = `SELECT DISTINCT date FROM amazon_sales_traffic WHERE date >= $1::date AND date <= $2::date ORDER BY date`;
      rangeQueryResult = await client.query(rangeQuery, [start, end]);
    }
    
    // Test 5: Get sample data from both tables
    const businessSampleQuery = `SELECT date, parent_asin, sessions FROM amazon_sales_traffic ORDER BY date DESC LIMIT 5`;
    const businessSampleResult = await client.query(businessSampleQuery);
    
    const adsSampleQuery = `SELECT report_date, search_term, cost, sales_1d FROM amazon_ads_reports ORDER BY report_date DESC LIMIT 5`;
    const adsSampleResult = await client.query(adsSampleQuery);
    
    res.json({
      businessDates: businessDates,
      adsDates: adsDates,
      businessRange: businessRangeResult.rows[0],
      adsRange: adsRangeResult.rows[0],
      rangeQuery: start && end ? {
        start,
        end,
        result: rangeQueryResult ? rangeQueryResult.rows.map(row => row.date) : []
      } : null,
      businessSample: businessSampleResult.rows,
      adsSample: adsSampleResult.rows,
      totalBusinessRecords: businessDatesResult.rowCount,
      totalAdsRecords: adsDatesResult.rowCount
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error (soft return):', error?.message || error);
    // Fail-soft to avoid breaking frontend probes
    res.json({ error: 'Debug endpoint failed', data: null });
  }
});

// ✅ Deterministic self-test endpoint: runs the same aggregation 3x and reports drift
app.get('/api/self-test', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    const { start, end } = req.query;
    const startDate = start || (await getGlobalDateRange())?.min?.toISOString()?.slice(0,10);
    const endDate = end || (await getGlobalDateRange())?.max?.toISOString()?.slice(0,10);

    const runOnce = async () => {
      const rows = await fetchBusinessRows(startDate, endDate);
      const sums = rows.reduce((acc, r) => {
        acc.sessions += Number(r.sessions || 0);
        acc.pageViews += Number(r.page_views || 0);
        acc.units += Number(r.units_ordered || 0);
        acc.sales += Number(r.ordered_product_sales || 0);
        if (r.date) acc.dates.add(String(r.date).slice(0,10));
        return acc;
      }, { sessions: 0, pageViews: 0, units: 0, sales: 0, dates: new Set() });
      const dayCount = sums.dates.size;
      const kpis = {
        totalSessions: sums.sessions,
        totalPageViews: sums.pageViews,
        totalUnitsOrdered: sums.units,
        totalSales: sums.sales,
        avgSessionsPerDay: dayCount > 0 ? sums.sessions / dayCount : 0,
        conversionRate: sums.sessions > 0 ? (sums.units / sums.sessions) * 100 : 0
      };
      return { rows: rows.length, kpis };
    };

    const r1 = await runOnce();
    const r2 = await runOnce();
    const r3 = await runOnce();

    const norm = (v) => Math.round(Number(v || 0) * 1000) / 1000;
    const normalize = (snap) => ({
      rows: snap.rows,
      kpis: {
        totalSessions: norm(snap.kpis.totalSessions),
        totalPageViews: norm(snap.kpis.totalPageViews),
        totalUnitsOrdered: norm(snap.kpis.totalUnitsOrdered),
        totalSales: norm(snap.kpis.totalSales),
        avgSessionsPerDay: norm(snap.kpis.avgSessionsPerDay),
        conversionRate: norm(snap.kpis.conversionRate)
      }
    });

    const n1 = normalize(r1);
    const n2 = normalize(r2);
    const n3 = normalize(r3);

    const consistent = JSON.stringify(n1) === JSON.stringify(n2) && JSON.stringify(n2) === JSON.stringify(n3);

    res.json({
      range: { start: startDate, end: endDate },
      runs: { r1: n1, r2: n2, r3: n3 },
      consistent
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Self-test failed' });
  }
});

// ✅ Trend Reports endpoint - Get data for trend analysis
app.get('/api/trend-reports', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { start, end, category, timePeriod } = req.query;
    console.log('📊 Trend Reports endpoint called with:', { start, end, category, timePeriod });
    
    let data = [];
    
    if (category === 'products') {
      // Get product data from amazon_sales_traffic with ads spend data
      const query = `
        SELECT 
          DATE(st.date) as date,
          COALESCE(NULLIF(st.parent_asin, ''), 'Unknown Product') as name,
          st.sku,
          CAST(st.sessions AS INTEGER) as sessions,
          CAST(st.page_views AS INTEGER) as page_views,
          CAST(st.units_ordered AS INTEGER) as units_ordered,
          CAST(st.ordered_product_sales AS DECIMAL) as ordered_product_sales,
          COALESCE(SUM(CAST(ar.cost AS DECIMAL)), 0) as total_spend,
          COALESCE(SUM(CAST(ar.clicks AS INTEGER)), 0) as total_clicks,
          COALESCE(SUM(CAST(ar.impressions AS INTEGER)), 0) as total_impressions
        FROM amazon_sales_traffic st
        LEFT JOIN amazon_ads_reports ar ON DATE(ar.report_date) = DATE(st.date)
        WHERE st.date IS NOT NULL AND st.parent_asin IS NOT NULL
        ${start && end ? 'AND DATE(st.date) >= $1::date AND DATE(st.date) <= $2::date' : ''}
        GROUP BY DATE(st.date), st.parent_asin, st.sku, st.sessions, st.page_views, st.units_ordered, st.ordered_product_sales
        ORDER BY DATE(st.date) DESC, st.ordered_product_sales DESC
      `;
      
      // Ensure we treat dates as local date-only strings to match frontend
      const params = start && end ? [start, end] : [];
      const result = await client.query(query, params);
      
      data = result.rows.map(row => {
        const spend = parseFloat(row.total_spend || 0);
        const clicks = parseInt(row.total_clicks || 0);
        const impressions = parseInt(row.total_impressions || 0);
        const sales = parseFloat(row.ordered_product_sales || 0);
        
        return {
          date: row.date,
          category: 'products',
          name: row.name || 'Unknown Product',
          sku: row.sku || null,
          spend: spend,
          cpc: clicks > 0 ? spend / clicks : 0,
          sales: sales,
          units_ordered: parseInt(row.units_ordered || 0),
          acos: sales > 0 ? (spend / sales) * 100 : 0,
          tcos: sales > 0 ? (spend / sales) * 100 : 0,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          sessions: parseInt(row.sessions || 0),
          pageviews: parseInt(row.page_views || 0),
          conversionRate: row.sessions > 0 ? (row.units_ordered / row.sessions) * 100 : 0
        };
      });
      
    } else if (category === 'campaigns') {
      // Check if aggregation is requested (for date-wise totals)
      const aggregateByDate = req.query.aggregate === 'date';
      
      if (aggregateByDate) {
        // Get both individual campaigns AND daily totals
        const individualQuery = `
          SELECT 
            DATE(report_date) as date,
            campaign_name as name,
            CAST(cost AS DECIMAL) as spend,
            CAST(clicks AS INTEGER) as clicks,
            CAST(impressions AS INTEGER) as impressions,
            CAST(sales_1d AS DECIMAL) as sales,
            'individual' as row_type
          FROM amazon_ads_reports
          ${start && end ? 'WHERE DATE(report_date) >= $1::date AND DATE(report_date) <= $2::date' : ''}
        `;
        
        const totalsQuery = `
          SELECT 
            DATE(report_date) as date,
            '📊 DAILY TOTAL' as name,
            SUM(CAST(cost AS DECIMAL)) as spend,
            SUM(CAST(clicks AS INTEGER)) as clicks,
            SUM(CAST(impressions AS INTEGER)) as impressions,
            SUM(CAST(sales_1d AS DECIMAL)) as sales,
            'total' as row_type
          FROM amazon_ads_reports
          ${start && end ? 'WHERE DATE(report_date) >= $3::date AND DATE(report_date) <= $4::date' : ''}
          GROUP BY DATE(report_date)
        `;
        
        // Combine both queries with UNION ALL
        const query = `
          (${individualQuery})
          UNION ALL
          (${totalsQuery})
          ORDER BY date DESC, row_type DESC, name ASC
        `;
        
        const params = start && end ? [start, end, start, end] : [];
        const result = await client.query(query, params);
        
        data = result.rows.map(row => ({
          date: row.date,
          category: 'campaigns',
          name: row.name || 'Unknown Campaign',
          spend: parseFloat(row.spend || 0),
          clicks: parseInt(row.clicks || 0),
          cpc: (parseInt(row.clicks || 0) > 0) ? parseFloat(row.spend || 0) / parseInt(row.clicks || 0) : 0,
          sales: parseFloat(row.sales || 0),
          acos: parseFloat(row.sales || 0) > 0 ? (parseFloat(row.spend || 0) / parseFloat(row.sales || 0)) * 100 : 0,
          tcos: 0,
          roas: parseFloat(row.spend || 0) > 0 ? parseFloat(row.sales || 0) / parseFloat(row.spend || 0) : 0,
          ctr: parseInt(row.impressions || 0) > 0 ? (parseInt(row.clicks || 0) / parseInt(row.impressions || 0)) * 100 : 0,
          sessions: 0,
          pageviews: 0,
          conversionRate: 0,
          rowType: row.row_type // Track if it's individual or total row
        }));
      } else {
        // Get individual campaign data only
        const query = `
          SELECT 
            DATE(report_date) as date,
            campaign_name as name,
            CAST(cost AS DECIMAL) as spend,
            CAST(clicks AS INTEGER) as clicks,
            CAST(impressions AS INTEGER) as impressions,
            CAST(sales_1d AS DECIMAL) as sales
          FROM amazon_ads_reports
          ${start && end ? 'WHERE DATE(report_date) >= $1::date AND DATE(report_date) <= $2::date' : ''}
          ORDER BY DATE(report_date) DESC, campaign_name ASC
        `;
      
        const params = start && end ? [start, end] : [];
        const result = await client.query(query, params);
        
        data = result.rows.map(row => ({
          date: row.date,
          category: 'campaigns',
          name: row.name || 'Unknown Campaign',
          spend: parseFloat(row.spend || 0),
          clicks: parseInt(row.clicks || 0),
          cpc: (parseInt(row.clicks || 0) > 0) ? parseFloat(row.spend || 0) / parseInt(row.clicks || 0) : 0,
          sales: parseFloat(row.sales || 0),
          acos: parseFloat(row.sales || 0) > 0 ? (parseFloat(row.spend || 0) / parseFloat(row.sales || 0)) * 100 : 0,
          tcos: 0,
          roas: parseFloat(row.spend || 0) > 0 ? parseFloat(row.sales || 0) / parseFloat(row.spend || 0) : 0,
          ctr: parseInt(row.impressions || 0) > 0 ? (parseInt(row.clicks || 0) / parseInt(row.impressions || 0)) * 100 : 0,
          sessions: 0,
          pageviews: 0,
          conversionRate: 0,
          rowType: row.row_type || 'individual'
        }));
      }
      
    } else if (category === 'search-terms') {
      // Get search term data from amazon_ads_reports
      // Use search_term field (same as AD Reports page)
      const query = `
        SELECT 
          DATE(report_date) as date,
          COALESCE(NULLIF(search_term, ''), 'Unknown Search Term') as name,
          campaign_name,
          CAST(cost AS DECIMAL) as spend,
          CAST(clicks AS INTEGER) as clicks,
          CAST(impressions AS INTEGER) as impressions,
          CAST(sales_1d AS DECIMAL) as sales
        FROM amazon_ads_reports
        WHERE report_date IS NOT NULL 
        AND search_term IS NOT NULL 
        AND search_term != ''
        ${start && end ? 'AND DATE(report_date) >= $1::date AND DATE(report_date) <= $2::date' : ''}
        ORDER BY DATE(report_date) DESC, search_term ASC
      `;
      
      const params = start && end ? [start, end] : [];
      const result = await client.query(query, params);
      
      data = result.rows.map(row => {
        const spend = parseFloat(row.spend || 0);
        const sales = parseFloat(row.sales || 0);
        const clicks = parseInt(row.clicks || 0);
        const impressions = parseInt(row.impressions || 0);
        
        // Do not estimate sessions/pageviews; show only actual ad metrics
        return {
          date: row.date,
          category: 'search-terms',
          name: row.name || 'Unknown Search Term',
          campaign_name: row.campaign_name || null,
          spend: spend,
          cpc: clicks > 0 ? spend / clicks : 0,
          sales: sales,
          clicks: clicks,
          impressions: impressions,
          acos: sales > 0 ? (spend / sales) * 100 : 0,
          tcos: sales > 0 ? (spend / sales) * 100 : 0,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          sessions: 0,
          pageviews: 0,
          conversionRate: 0,
          roas: spend > 0 ? sales / spend : 0
        };
      });
    }
    
    console.log(`📊 Returning ${data.length} records for ${category}`);
    res.json({ data, category, timePeriod });
    
  } catch (error) {
    console.error('❌ Trend Reports endpoint error (soft return):', error?.message || error);
    const { category, timePeriod } = req.query || {};
    return res.json({ data: [], category: category || null, timePeriod: timePeriod || null });
  }
});

// Mock generators removed to avoid any possibility of non-real data

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 http://localhost:5000`);
  console.log(`📍 Server origin: ${SERVER_ORIGIN}`);
});

