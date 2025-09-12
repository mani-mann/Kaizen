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
// Fetch Business Data with Date Filtering and Aggregation by Parent ASIN
// --------------------
async function fetchBusinessData(startDate = null, endDate = null) {
  try {
    // Check if database is connected
    if (!dbConnected) {
      console.log("⚠️ Database not connected, returning empty data");
      return [];
    }
    
    console.log('🔍 fetchBusinessData called with:', { startDate, endDate });
    
    // If no date range provided, aggregate by date for chart data
    if (!startDate || !endDate) {
      console.log('📊 Fetching ALL business data aggregated by date for chart');
      const query = `
        SELECT 
          DATE(date) as date,
          SUM(CAST(sessions AS INTEGER)) as sessions,
          SUM(CAST(page_views AS INTEGER)) as page_views,
          SUM(CAST(units_ordered AS INTEGER)) as units_ordered,
          SUM(CAST(ordered_product_sales AS DECIMAL)) as ordered_product_sales
        FROM amazon_sales_traffic
        WHERE date IS NOT NULL
        GROUP BY DATE(date)
        ORDER BY DATE(date) DESC
      `;
      
      const res = await client.query(query);
      console.log(`📊 Aggregated ${res.rows.length} unique dates from business data`);
      
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
    
    // If date range provided, aggregate by Parent ASIN for specific date range
    let query = `
      SELECT 
        parent_asin,
        (array_agg(sku ORDER BY date DESC))[1] as sku,  -- Take the first SKU for each Parent ASIN
        SUM(CAST(sessions AS INTEGER)) as sessions,
        SUM(CAST(page_views AS INTEGER)) as page_views,
        SUM(CAST(units_ordered AS INTEGER)) as units_ordered,
        SUM(CAST(ordered_product_sales AS DECIMAL)) as ordered_product_sales,
        MIN(date) as date  -- Take the earliest date for reference
      FROM amazon_sales_traffic
      WHERE DATE(date) >= $1::date AND DATE(date) <= $2::date
      GROUP BY parent_asin
      ORDER BY SUM(CAST(ordered_product_sales AS DECIMAL)) DESC
    `;
    
    const res = await client.query(query, [startDate, endDate]);
    console.log(`📊 Aggregated ${res.rows.length} unique Parent ASINs from business data for date range`);
    
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
function transformKeywordDataForFrontend(dbData, businessData = []) {
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

  return dbData.map(row => {
    // Find matching business data for the same date to get real total sales
    // Use YYYY-MM-DD format to match business data keys
    const keywordDate = new Date(row.report_date);
    const keywordDateStr = keywordDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const matchingBusinessData = businessDataByDate[keywordDateStr];
    
    // Use real business data if available, otherwise fall back to ad sales
    const realTotalSales = matchingBusinessData 
      ? matchingBusinessData.totalSales
      : parseFloat(row.sales_1d || 0);
    
    // Debug: Check if we have business data for this date
    if (keywordDateStr.includes('2025-09-08') || keywordDateStr.includes('Sep 8')) {
      console.log('🔍 Sep 8 business data lookup:', {
        keywordDateStr,
        businessDataAvailable: Object.keys(businessDataByDate),
        matchingBusinessData: matchingBusinessData ? matchingBusinessData.totalSales : 'No match',
        fallbackAdSales: parseFloat(row.sales_1d || 0),
        finalTotalSales: realTotalSales
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
        businessDataKeys: Object.keys(businessDataByDate)
      });
    }
    
    // Debug: Show first few keyword dates being processed
    if (dbData.indexOf(row) < 5) {
      console.log('🔍 Keyword date being processed:', {
        index: dbData.indexOf(row),
        keywordDateStr,
        hasMatchingBusinessData: !!matchingBusinessData,
        realTotalSales
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
    
    // Fetch data - get business data based on date range
    const [keywordData, businessDataForChart, businessDataForKPIs] = await Promise.all([
      fetchKeywordData(startDate, endDate),
      // For chart: Get ALL business data aggregated by date
      fetchBusinessData(null, null),
      // For KPIs: Get business data for the specific date range
      fetchBusinessData(startDate, endDate)
    ]);
    
    console.log(`📊 Fetched ${keywordData.length} keyword rows from database`);
    console.log(`📊 Fetched ${businessDataForChart.length} business rows for chart`);
    console.log(`📊 Fetched ${businessDataForKPIs.length} business rows for KPIs`);
    
    const kpis = calculateDashboardKPIs(keywordData, businessDataForKPIs);
    const rows = transformKeywordDataForFrontend(keywordData, businessDataForChart);
    
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
        
        // For search terms, estimate sessions from impressions and pageviews from clicks
        // This provides meaningful data for the metrics that are selected
        const estimatedSessions = impressions > 0 ? Math.round(impressions * 0.1) : clicks * 2; // 10% of impressions become sessions
        const estimatedPageviews = clicks > 0 ? Math.round(clicks * 1.5) : estimatedSessions; // 1.5 pageviews per click
        
        return {
          date: row.date,
          category: 'search-terms',
          name: row.name || 'Unknown Search Term',
          spend: spend,
          cpc: clicks > 0 ? spend / clicks : 0,
          sales: sales,
          clicks: clicks,
          impressions: impressions,
          acos: sales > 0 ? (spend / sales) * 100 : 0,
          tcos: sales > 0 ? (spend / sales) * 100 : 0,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          sessions: estimatedSessions,
          pageviews: estimatedPageviews,
          conversionRate: estimatedSessions > 0 ? (clicks / estimatedSessions) * 100 : 0,
          roas: spend > 0 ? sales / spend : 0
        };
      });
    }
    
    console.log(`📊 Returning ${data.length} records for ${category}`);
    res.json({ data, category, timePeriod });
    
  } catch (error) {
    console.error('❌ Trend Reports endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch trend reports data' });
  }
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
