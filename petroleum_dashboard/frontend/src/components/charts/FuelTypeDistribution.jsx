import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Professional, distinguishable palette: Regular (brand green), Premium (teal), Diesel (slate)
const COLORS = ['#28a745', '#14b8a6', '#94a3b8'];

// Placeholder distribution; can be wired to API later
const data = [
  { name: 'Regular', value: 62 },
  { name: 'Premium', value: 28 },
  { name: 'Diesel', value: 10 },
];

export function FuelTypeDistribution() {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
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


