import { formatISO } from 'date-fns';
import { query, testConnection } from '../core/db.js';
import { mapping } from '../config/mapping.js';
import { mockOverview, mockPerformance, mockExpensesPct } from './mock.js';

function buildDateClause(start, end, alias, col) {
  const clauses = [];
  const params = [];
  if (start) {
    params.push(start);
    clauses.push(`${alias}.${col} >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    clauses.push(`${alias}.${col} <= $${params.length}`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function getOverview(filters) {
  const hasDb = await testConnection();
  const start = filters.start ? new Date(filters.start) : new Date(Date.now() - 7 * 86400000);
  const end = filters.end ? new Date(filters.end) : new Date();
  if (!hasDb) return mockOverview(start, end, filters.siteIds, filters.includeShop);

  const sales = mapping.sales;
  const expenses = mapping.expenses;

  const dateClause = buildDateClause(formatISO(start), formatISO(end), 's', sales.date);
  let params = [...dateClause.params];
  let siteFilter = '';
  if (filters.siteIds?.length) {
    params.push(filters.siteIds);
    siteFilter = `${dateClause.where ? ' AND' : ' WHERE'} s.${sales.siteId} = ANY($${params.length})`;
  }

  const rows = await query(
    `SELECT 
      COALESCE(SUM(${`s.${sales.liters}` }),0) AS liters,
      COALESCE(SUM(${`s.${sales.fuelSalesValue}` }),0) AS fuel_sales_value,
      COALESCE(SUM(${`s.${sales.shopSalesValue}` }),0) AS shop_sales_value,
      COALESCE(SUM(${`s.${sales.cogsValue}` }),0) AS cogs_value
    FROM ${sales.table} s
    ${dateClause.where}${siteFilter}`,
    params
  );
  const totals = rows[0] || { liters: 0, fuel_sales_value: 0, shop_sales_value: 0, cogs_value: 0 };

  const expRows = await query(
    `SELECT ${`e.${expenses.category}`} AS category, COALESCE(SUM(${`e.${expenses.amount}` }),0) AS amount
     FROM ${expenses.table} e
     WHERE ${`e.${expenses.date}`} >= $1 AND ${`e.${expenses.date}`} <= $2
     GROUP BY ${`e.${expenses.category}` }`,
    [formatISO(start), formatISO(end)]
  );

  const expMap = Object.fromEntries(expRows.map((r) => [r.category, Number(r.amount)]));
  const wages = expMap[mapping.categories.wages] || 0;
  const electricity = expMap[mapping.categories.electricity] || 0;
  const repairs = expMap[mapping.categories.repairs] || 0;
  const other = expMap[mapping.categories.other] || 0;

  const revenue = Number(totals.fuel_sales_value) + Number(totals.shop_sales_value);
  const profitValue = revenue - Number(totals.cogs_value) - wages - electricity - repairs - other;
  const profitPct = revenue ? (profitValue / revenue) * 100 : 0;
  const ebitdaValue = profitValue + wages;

  // Top sites
  const topRows = await query(
    `SELECT s.${sales.siteId} as site_id, st.${mapping.sites.name} as site_name,
            COALESCE(SUM(s.${sales.fuelSalesValue} + s.${sales.shopSalesValue}),0) AS revenue,
            COALESCE(SUM(s.${sales.fuelSalesValue} + s.${sales.shopSalesValue} - s.${sales.cogsValue}),0) AS gross_profit
     FROM ${sales.table} s
     JOIN ${mapping.sites.table} st ON st.${mapping.sites.id} = s.${sales.siteId}
     ${dateClause.where}${siteFilter}
     GROUP BY site_id, site_name
     ORDER BY gross_profit ASC
     LIMIT 5`,
    [...dateClause.params, ...(filters.siteIds?.length ? [filters.siteIds] : [])]
  );

  const topSitesByEarningsAsc = topRows.map((r) => ({
    siteId: r.site_id,
    siteName: r.site_name,
    revenue: Number(r.revenue),
    profit: Number(r.gross_profit),
    marginPct: r.revenue ? Math.round((Number(r.gross_profit) / Number(r.revenue)) * 100) : 0,
  }));

  return {
    salesVolumeL: Number(totals.liters),
    fuelSalesValue: Number(totals.fuel_sales_value),
    shopSalesValue: Number(totals.shop_sales_value),
    profitValue: Math.round(profitValue),
    profitPct: Math.round(profitPct * 10) / 10,
    ebitdaValue: Math.round(ebitdaValue),
    wages: { value: Math.round(wages), pctOfSales: revenue ? Math.round((wages / revenue) * 1000) / 10 : 0 },
    expensesPct: {
      wages: revenue ? Math.round((wages / revenue) * 1000) / 10 : 0,
      electricity: revenue ? Math.round((electricity / revenue) * 1000) / 10 : 0,
      repairs: revenue ? Math.round((repairs / revenue) * 1000) / 10 : 0,
      other: revenue ? Math.round((other / revenue) * 1000) / 10 : 0,
    },
    topSitesByEarningsAsc,
  };
}

export async function getPerformance(filters) {
  const hasDb = await testConnection();
  const start = filters.start ? new Date(filters.start) : new Date(Date.now() - 30 * 86400000);
  const end = filters.end ? new Date(filters.end) : new Date();
  if (!hasDb) return mockPerformance(start, end);
  // A compact SQL that returns daily totals; frontend can aggregate by granularity if needed
  const s = mapping.sales;
  const rows = await query(
    `SELECT ${s.date}::date as date,
            COALESCE(SUM(${s.fuelSalesValue} + ${s.shopSalesValue}),0) AS sales,
            COALESCE(SUM(${s.cogsValue}),0) AS cost
     FROM ${s.table}
     WHERE ${s.date} >= $1 AND ${s.date} <= $2
     GROUP BY 1
     ORDER BY 1 ASC`,
    [formatISO(start), formatISO(end)]
  );
  return rows.map((r) => ({ date: formatISO(new Date(r.date), { representation: 'date' }), sales: Number(r.sales), cost: Number(r.cost), profit: Number(r.sales) - Number(r.cost) }));
}

export async function getExpensesBreakdown(filters) {
  const hasDb = await testConnection();
  if (!hasDb) return mockExpensesPct();
  const s = mapping.sales;
  const e = mapping.expenses;
  const start = filters.start ? new Date(filters.start) : new Date(Date.now() - 30 * 86400000);
  const end = filters.end ? new Date(filters.end) : new Date();
  const [revRow] = await query(
    `SELECT COALESCE(SUM(${s.fuelSalesValue} + ${s.shopSalesValue}),0) AS revenue FROM ${s.table} WHERE ${s.date} >= $1 AND ${s.date} <= $2`,
    [formatISO(start), formatISO(end)]
  );
  const revenue = Number(revRow?.revenue || 0);
  if (!revenue) return { wages: 0, electricity: 0, repairs: 0, other: 0 };
  const rows = await query(
    `SELECT ${e.category} as category, COALESCE(SUM(${e.amount}),0) as amount FROM ${e.table} WHERE ${e.date} >= $1 AND ${e.date} <= $2 GROUP BY 1`,
    [formatISO(start), formatISO(end)]
  );
  const map = Object.fromEntries(rows.map((r) => [r.category, Number(r.amount)]));
  return {
    wages: Math.round(((map[mapping.categories.wages] || 0) / revenue) * 1000) / 10,
    electricity: Math.round(((map[mapping.categories.electricity] || 0) / revenue) * 1000) / 10,
    repairs: Math.round(((map[mapping.categories.repairs] || 0) / revenue) * 1000) / 10,
    other: Math.round(((map[mapping.categories.other] || 0) / revenue) * 1000) / 10,
  };
}

