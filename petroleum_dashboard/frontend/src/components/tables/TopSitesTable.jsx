import React from 'react';
import { useDashboardStore } from '../../lib/state/store.js';

export function TopSitesTable() {
  const overview = useDashboardStore((s) => s.overview);
  if (!overview) return null;
  const rows = overview.topSitesByEarningsAsc || [];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2">Site</th>
            <th className="py-2">Revenue</th>
            <th className="py-2">Profit</th>
            <th className="py-2">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.siteId} className="border-t">
              <td className="py-2">{r.siteName}</td>
              <td className="py-2">₹ {r.revenue.toLocaleString()}</td>
              <td className="py-2">₹ {r.profit.toLocaleString()}</td>
              <td className="py-2">{r.marginPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


