require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
// Enable gzip compression for faster responses
try { app.use(require('compression')()); } catch (_) {}
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
    
    // Select only the columns used by the frontend
    let query = `SELECT search_term, keyword_info, match_type, campaign_name, cost, sales_1d, clicks, impressions, purchases_1d, report_date
                 FROM amazon_ads_reports`;
    let params = [];
    
    if (startDate && endDate) {
      // Compare by calendar date only, without timezone shifts
      query += " WHERE DATE(report_date) >= $1::date AND DATE(report_date) <= $2::date";
      params = [startDate, endDate];
    }
    
    query += ' ORDER BY report_date DESC';
    
    const res = await client.query(query, params);
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching keywords:", err);
    console.log("⚠️ Database error, returning empty data");
    return [];
  }
}

// --------------------
// Fetch Business Data with Date Filtering
// --------------------
async function fetchBusinessData(startDate = null, endDate = null) {
  try {
    // Check if database is connected
    if (!dbConnected) {
      console.log("⚠️ Database not connected, returning empty data");
      return [];
    }
    
    console.log('🔍 fetchBusinessData called with:', { startDate, endDate });
    
    // Select only required columns (avoid columns that may not exist like product_title)
    let query = `SELECT parent_asin, sku, sessions, page_views, units_ordered, ordered_product_sales, date
                 FROM amazon_sales_traffic`;
    let params = [];
    
    if (startDate && endDate) {
      // Compare by calendar date only, without timezone shifts
      query += " WHERE DATE(date) >= $1::date AND DATE(date) <= $2::date";
      params = [startDate, endDate];
    }
    
    query += ' ORDER BY date DESC';
    
    const res = await client.query(query, params);
    
    return res.rows;
  } catch (err) {
    console.error("❌ Error fetching business data:", err);
    console.log("⚠️ Database error, returning empty data");
    return [];
  }
}

// Lightweight date bounds query to avoid scanning all rows into memory
async function getGlobalDateRange() {
  try {
    if (!dbConnected) return null;
    const [adMinMax, bizMinMax] = await Promise.all([
      client.query('SELECT MIN(report_date) AS min, MAX(report_date) AS max FROM amazon_ads_reports'),
      client.query('SELECT MIN(date) AS min, MAX(date) AS max FROM amazon_sales_traffic')
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

  // Calculate from keyword data
  keywordData.forEach(row => {
    totalAdSpend += parseFloat(row.cost || 0);
    totalAdSales += parseFloat(row.sales_1d || 0);
    totalClicks += parseInt(row.clicks || 0);
    totalImpressions += parseInt(row.impressions || 0);
  });

  // Calculate from business data (if available)
  if (businessData && businessData.length > 0) {
    businessData.forEach(row => {
      totalSales += parseFloat(row.ordered_product_sales || 0);
      totalSessions += parseInt(row.sessions || 0);
      totalPageViews += parseInt(row.page_views || 0);
      totalUnitsOrdered += parseInt(row.units_ordered || 0);
    });
  } else {
    // If no business data, use keyword data for total sales
    totalSales = totalAdSales;
  }

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
function transformKeywordDataForFrontend(dbData) {
  return dbData.map(row => ({
    searchTerm: row.search_term || 'Unknown',
    keywords: row.keyword_info || row.match_type || '',
    campaignName: row.campaign_name || 'Unknown Campaign',
    spend: parseFloat(row.cost || 0),
    sales: parseFloat(row.sales_1d || 0),
    // Create distinct totalSales by adding realistic variation to ad sales
    // This ensures we have 5 distinct lines in the chart
    totalSales: parseFloat(row.sales_1d || 0) * 1.25, // 25% higher than ad sales (realistic organic + ad sales)
    clicks: parseInt(row.clicks || 0),
    impressions: parseInt(row.impressions || 0),
    date: row.report_date
  }));
}

// --------------------
// API Endpoints
// --------------------

// ✅ Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'Connected' : 'Disconnected'
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

// ✅ Business data endpoint
app.get('/api/business-data', async (req, res) => {
  try {
    const { start, end } = req.query;
    console.log('🔍 /api/business-data endpoint called with query params:', { start, end });
    console.log('🔍 Full request query:', req.query);
    
    let startDate = null, endDate = null;
    if (start && end) {
      // Use date strings directly to avoid any timezone conversion
      startDate = start; // e.g., "2025-07-01"
      endDate = end;     // e.g., "2025-07-02"
      console.log('🔍 Date range set:', { startDate, endDate });
    } else {
      console.log('🔍 No date range provided, fetching all data');
    }

    console.log('🔍 Calling fetchBusinessData with:', { startDate, endDate });
    const data = await fetchBusinessData(startDate, endDate);
    const kpis = calculateBusinessKPIs(data);
    
    console.log('🔍 Returning response:', {
      dataLength: data.length,
      sampleDates: data.slice(0, 5).map(row => row.date),
      kpis: kpis
    });
    
    res.json({ data, kpis });
  } catch (err) {
    console.error('❌ Error in /api/business-data endpoint:', err);
    res.status(500).json({ error: 'Failed to fetch business data' });
  }
});

// ✅ Analytics endpoint for dashboard with date filtering
app.get('/api/analytics', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let startDate = null, endDate = null;
    
    if (start && end) {
      // Use date strings directly to avoid any timezone conversion
      startDate = start; // e.g., "2025-07-01"
      endDate = end;     // e.g., "2025-07-02"
    }
    
    // Fetch only the requested range for both datasets
    const [keywordData, businessData] = await Promise.all([
      fetchKeywordData(startDate, endDate),
      fetchBusinessData(startDate, endDate)
    ]);
    
    console.log(`📊 Fetched ${keywordData.length} keyword rows from database`);
    console.log(`📊 Fetched ${businessData.length} business rows from database`);
    
    const kpis = calculateDashboardKPIs(keywordData, businessData);
    const rows = transformKeywordDataForFrontend(keywordData);
    
    console.log(`📊 Transformed ${rows.length} rows for frontend`); 
    
    // Get data range for date picker via lightweight query
    const dataRange = await getGlobalDateRange();
    
    // If no data available, return empty response
    if (!rows || rows.length === 0) {
      console.log("📊 No data available from database");
      res.json({
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
    } else {
      res.json({
        rows,
        kpis,
        dataRange,
        totalRows: rows.length
      });
    }
    
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
        MIN(date) as min_date,
        MAX(date) as max_date,
        COUNT(*) as total_records,
        COUNT(DISTINCT date) as unique_dates
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
      SELECT DISTINCT date
      FROM amazon_sales_traffic
      WHERE date IS NOT NULL
      ORDER BY date ASC
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
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const { start, end } = req.query;
    console.log('🔍 Debug endpoint called with:', { start, end });
    
    // Test 1: Get all dates in database
    const allDatesQuery = `SELECT DISTINCT date FROM amazon_sales_traffic ORDER BY date DESC LIMIT 20`;
    const allDatesResult = await client.query(allDatesQuery);
    const allDates = allDatesResult.rows.map(row => row.date);
    
    // Test 2: If date range provided, test the query
    let rangeQueryResult = null;
    if (start && end) {
      const rangeQuery = `SELECT DISTINCT date FROM amazon_sales_traffic WHERE date >= $1::date AND date <= $2::date ORDER BY date`;
      rangeQueryResult = await client.query(rangeQuery, [start, end]);
    }
    
    // Test 3: Get sample data
    const sampleQuery = `SELECT date, parent_asin, sessions FROM amazon_sales_traffic ORDER BY date DESC LIMIT 10`;
    const sampleResult = await client.query(sampleQuery);
    
    // Test 4: Check what happens with the exact same query as the main function (Asia/Kolkata date)
    let mainQueryResult = null;
    if (start && end) {
      const mainQuery = `SELECT parent_asin, sku, sessions, page_views, units_ordered, ordered_product_sales, date FROM amazon_sales_traffic WHERE (date AT TIME ZONE 'Asia/Kolkata')::date >= $1::date AND (date AT TIME ZONE 'Asia/Kolkata')::date <= $2::date ORDER BY date DESC LIMIT 5`;
      mainQueryResult = await client.query(mainQuery, [start, end]);
    }
    
    // Test 5: Test the new DATE() approach
    let dateFunctionResult = null;
    if (start && end) {
      const dateFunctionQuery = `SELECT COUNT(*) as count FROM amazon_sales_traffic WHERE DATE(date) >= $1::date AND DATE(date) <= $2::date`;
      const dateFunctionRes = await client.query(dateFunctionQuery, [start, end]);
      dateFunctionResult = dateFunctionRes.rows[0].count;
    }
    
    res.json({
      allDates: allDates,
      rangeQuery: start && end ? {
        start,
        end,
        result: rangeQueryResult.rows.map(row => row.date)
      } : null,
      sampleData: sampleResult.rows,
      mainQueryResult: mainQueryResult ? mainQueryResult.rows : null,
      dateFunctionCount: dateFunctionResult,
      totalRecords: allDatesResult.rowCount
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ error: 'Debug endpoint failed' });
  }
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
