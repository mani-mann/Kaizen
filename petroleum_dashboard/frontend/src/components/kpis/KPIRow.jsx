import React from 'react';
import { useDashboardStore } from '../../lib/state/store.js';

function Card({ title, value, sub }) {
  return (
    <div className="card p-4">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function KPIRow() {
  const overview = useDashboardStore((s) => s.overview);
  if (!overview) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Card title="Sales Volume (L)" value={overview.salesVolumeL.toLocaleString()} />
      <Card title="Fuel Sales (₹)" value={overview.fuelSalesValue.toLocaleString()} />
      <Card title="Shop Sales (₹)" value={overview.shopSalesValue.toLocaleString()} />
      <Card title="Profit (₹)" value={overview.profitValue.toLocaleString()} sub={`Profit %: ${overview.profitPct}%`} />
      <Card title="EBITDA (₹)" value={overview.ebitdaValue.toLocaleString()} />
      <Card title="Wages (₹)" value={overview.wages.value.toLocaleString()} sub={`% of Sales: ${overview.wages.pctOfSales}%`} />
    </div>
  );
}


