import React from 'react';
import { useDashboardStore } from '../../lib/state/store.js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0ea5e9', '#f59e0b', '#ef4444', '#6366f1'];

export function ExpenseBreakdown() {
  const e = useDashboardStore((s) => s.expensesPct);
  const data = [
    { name: 'Wages', value: e.wages },
    { name: 'Electricity', value: e.electricity },
    { name: 'Repairs', value: e.repairs },
    { name: 'Other', value: e.other || 0 },
  ];
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v)=>`${v}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


