/**
 * Amazon Data API Client
 * Fetches data from external REST API (e.g. http://164.52.192.205:8004)
 * Replaces direct PostgreSQL for ads, sales, and keywords data.
 */

const fetch = require('node-fetch');

const DATA_API_BASE = process.env.DATA_API_URL || 'http://164.52.192.205:8004';

function getApiUrl(path, params = {}) {
  const url = new URL(path, DATA_API_BASE);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, v);
  });
  return url.toString();
}

async function fetchFromApi(endpoint, params = {}) {
  const url = getApiUrl(endpoint, params);
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`API ${endpoint}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  // Handle various response shapes: { data: [] }, { rows: [] }, or raw array
  if (Array.isArray(json)) return json;
  if (json.data && Array.isArray(json.data)) return json.data;
  if (json.rows && Array.isArray(json.rows)) return json.rows;
  if (json.ads && Array.isArray(json.ads)) return json.ads;
  if (json.sales && Array.isArray(json.sales)) return json.sales;
  if (json.keywords && Array.isArray(json.keywords)) return json.keywords;
  return [];
}

// Normalize date string (YYYY-MM-DD) for comparison
function toYmd(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function inDateRange(rowDateStr, startDate, endDate) {
  if (!startDate || !endDate) return true;
  const d = toYmd(rowDateStr);
  if (!d) return false;
  return d >= startDate && d <= endDate;
}

// -------------------- Ads (amazon_ads_reports) --------------------
// Expected columns: search_term, keyword_info, match_type, campaign_name, cost, sales_1d, clicks, impressions, purchases_1d, report_date
const ADS_COL_MAP = {
  search_term: ['search_term', 'searchterm', 'searchTerm'],
  keyword_info: ['keyword_info', 'keywordinfo', 'keywordInfo', 'keyword'],
  match_type: ['match_type', 'matchtype', 'matchType'],
  campaign_name: ['campaign_name', 'campaignname', 'campaignName'],
  cost: ['cost', 'spend'],
  sales_1d: ['sales_1d', 'sales1d', 'sales', 'ad_sales'],
  clicks: ['clicks'],
  impressions: ['impressions'],
  purchases_1d: ['purchases_1d', 'purchases1d', 'purchases'],
  report_date: ['report_date', 'reportdate', 'reportDate', 'date']
};

function pickCol(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return null;
}

function normalizeAdsRow(row) {
  return {
    search_term: pickCol(row, ADS_COL_MAP.search_term) ?? row.search_term ?? 'Unknown',
    keyword_info: pickCol(row, ADS_COL_MAP.keyword_info) ?? row.keyword_info ?? '',
    match_type: pickCol(row, ADS_COL_MAP.match_type) ?? row.match_type ?? '',
    campaign_name: pickCol(row, ADS_COL_MAP.campaign_name) ?? row.campaign_name ?? 'Unknown Campaign',
    cost: parseFloat(pickCol(row, ADS_COL_MAP.cost) ?? row.cost ?? 0) || 0,
    sales_1d: parseFloat(pickCol(row, ADS_COL_MAP.sales_1d) ?? row.sales_1d ?? 0) || 0,
    clicks: parseInt(pickCol(row, ADS_COL_MAP.clicks) ?? row.clicks ?? 0, 10) || 0,
    impressions: parseInt(pickCol(row, ADS_COL_MAP.impressions) ?? row.impressions ?? 0, 10) || 0,
    purchases_1d: parseInt(pickCol(row, ADS_COL_MAP.purchases_1d) ?? row.purchases_1d ?? 0, 10) || 0,
    report_date: pickCol(row, ADS_COL_MAP.report_date) ?? row.report_date ?? row.date
  };
}

async function fetchAdsData(startDate = null, endDate = null) {
  const raw = await fetchFromApi('/ads');
  const normalized = raw.map(normalizeAdsRow);
  if (startDate && endDate) {
    return normalized.filter(r => inDateRange(r.report_date, startDate, endDate))
      .sort((a, b) => new Date(b.report_date) - new Date(a.report_date) || (b.cost - a.cost));
  }
  return normalized.sort((a, b) => new Date(b.report_date) - new Date(a.report_date) || (b.cost - a.cost));
}

// -------------------- Sales (amazon_sales_traffic) --------------------
const SALES_COL_MAP = {
  date: ['date'],
  sessions: ['sessions'],
  page_views: ['page_views', 'pageviews', 'pageViews'],
  units_ordered: ['units_ordered', 'unitsordered', 'unitsOrdered'],
  ordered_product_sales: ['ordered_product_sales', 'orderedproductsales', 'orderedProductSales', 'sales'],
  parent_asin: ['parent_asin', 'parentasin', 'parentAsin'],
  sku: ['sku']
};

function normalizeSalesRow(row) {
  return {
    date: pickCol(row, SALES_COL_MAP.date) ?? row.date,
    sessions: parseInt(pickCol(row, SALES_COL_MAP.sessions) ?? row.sessions ?? 0, 10) || 0,
    page_views: parseInt(pickCol(row, SALES_COL_MAP.page_views) ?? row.page_views ?? 0, 10) || 0,
    units_ordered: parseInt(pickCol(row, SALES_COL_MAP.units_ordered) ?? row.units_ordered ?? 0, 10) || 0,
    ordered_product_sales: parseFloat(pickCol(row, SALES_COL_MAP.ordered_product_sales) ?? row.ordered_product_sales ?? 0) || 0,
    parent_asin: pickCol(row, SALES_COL_MAP.parent_asin) ?? row.parent_asin ?? '',
    sku: pickCol(row, SALES_COL_MAP.sku) ?? row.sku ?? ''
  };
}

async function fetchSalesData(startDate = null, endDate = null) {
  const raw = await fetchFromApi('/sales');
  let rows = raw.map(normalizeSalesRow);
  if (startDate && endDate) {
    rows = rows.filter(r => inDateRange(r.date, startDate, endDate));
  }
  return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Aggregate sales by date (for chart / fetchBusinessData)
function aggregateSalesByDate(rows) {
  const byDate = new Map();
  for (const r of rows) {
    const d = toYmd(r.date);
    if (!d) continue;
    const prev = byDate.get(d) || { date: r.date, sessions: 0, page_views: 0, units_ordered: 0, ordered_product_sales: 0 };
    prev.sessions += r.sessions;
    prev.page_views += r.page_views;
    prev.units_ordered += r.units_ordered;
    prev.ordered_product_sales += r.ordered_product_sales;
    byDate.set(d, prev);
  }
  return Array.from(byDate.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// -------------------- Health check --------------------
async function probeApi() {
  try {
    const url = getApiUrl('/');
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

module.exports = {
  DATA_API_BASE,
  fetchFromApi,
  fetchAdsData,
  fetchSalesData,
  aggregateSalesByDate,
  normalizeAdsRow,
  normalizeSalesRow,
  toYmd,
  inDateRange,
  probeApi
};
