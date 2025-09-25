import React, { useMemo } from 'react';
import { useDashboardStore } from '../../lib/state/store.js';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function SalesPatternBarChart() {
  const performance = useDashboardStore((s) => s.performance);

  const data = useMemo(() => {
    if (!performance?.length) return [];
    // Use last 8 points for a compact weekly-like view
    return performance.slice(-8).map((p) => ({ label: p.date.slice(5), sales: p.sales, profit: p.profit }));
  }, [performance]);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="sales" fill="#28a745" name="Sales" />
          <Bar dataKey="profit" fill="#14b8a6" name="Profit" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


