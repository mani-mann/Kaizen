import React from 'react';
import { useDashboardStore } from '../../lib/state/store.js';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function PerformanceChart() {
  const data = useDashboardStore((s) => s.performance);
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="sales" stroke="#28a745" name="Sales" dot={false} />
          <Line type="monotone" dataKey="cost" stroke="#f87171" name="Cost" dot={false} />
          <Line type="monotone" dataKey="profit" stroke="#6fda8f" name="Profit" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


