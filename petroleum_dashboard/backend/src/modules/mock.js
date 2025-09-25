// Simple deterministic mock data generator for local dev / when DB is down
import { addDays, formatISO } from 'date-fns';

function rangeDays(start, end) {
  const out = [];
  let d = new Date(start);
  while (d <= end) {
    out.push(new Date(d));
    d = addDays(d, 1);
  }
  return out;
}

const siteNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];

export function mockSites() {
  return siteNames.map((n, i) => ({ id: i + 1, name: `${n} Fuel`, city: 'City' }));
}

export function mockOverview(start, end, selectedSiteIds, includeShop) {
  const days = rangeDays(start, end).length || 1;
  const sites = selectedSiteIds?.length || 3;
  const base = 5000 * sites * (includeShop ? 1.2 : 1);
  const fuelSalesValue = base * days;
  const shopSalesValue = includeShop ? base * 0.25 * days : 0;
  const cogs = fuelSalesValue * 0.82;
  const wages = fuelSalesValue * 0.07;
  const electricity = fuelSalesValue * 0.015;
  const repairs = fuelSalesValue * 0.01;
  const other = fuelSalesValue * 0.005;
  const salesVolumeL = fuelSalesValue / 100; // assume 100 Rs/L avg
  const profitValue = fuelSalesValue + shopSalesValue - cogs - wages - electricity - repairs - other;
  const revenue = fuelSalesValue + shopSalesValue;
  const profitPct = revenue ? (profitValue / revenue) * 100 : 0;
  const ebitdaValue = profitValue + wages; // rough mock

  const topSitesByEarningsAsc = mockSites()
    .slice(0, 6)
    .map((s, idx) => {
      const rev = base * (0.6 + idx * 0.1);
      const pr = rev * (0.08 + idx * 0.01);
      return { siteId: s.id, siteName: s.name, revenue: Math.round(rev), profit: Math.round(pr), marginPct: Math.round((pr / rev) * 100) };
    })
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 5);

  return {
    salesVolumeL: Math.round(salesVolumeL),
    fuelSalesValue: Math.round(fuelSalesValue),
    shopSalesValue: Math.round(shopSalesValue),
    profitValue: Math.round(profitValue),
    profitPct: Math.round(profitPct * 10) / 10,
    ebitdaValue: Math.round(ebitdaValue),
    wages: { value: Math.round(wages), pctOfSales: Math.round((wages / revenue) * 1000) / 10 },
    expensesPct: {
      wages: Math.round((wages / revenue) * 1000) / 10,
      electricity: Math.round((electricity / revenue) * 1000) / 10,
      repairs: Math.round((repairs / revenue) * 1000) / 10,
      other: Math.round((other / revenue) * 1000) / 10,
    },
    topSitesByEarningsAsc,
  };
}

export function mockPerformance(start, end) {
  const days = rangeDays(start, end);
  return days.map((d, i) => {
    const t = i + 1;
    const sales = 100000 + t * 2500;
    const cost = sales * 0.86;
    return {
      date: formatISO(d, { representation: 'date' }),
      sales,
      cost,
      profit: sales - cost,
    };
  });
}

export function mockExpensesPct() {
  return {
    wages: 7.2,
    electricity: 1.5,
    repairs: 1.0,
    other: 0.5,
  };
}

