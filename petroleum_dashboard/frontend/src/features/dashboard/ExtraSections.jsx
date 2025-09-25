import React from 'react';
import { SalesPatternBarChart } from '../../components/charts/SalesPatternBarChart.jsx';
import { FuelTypeDistribution } from '../../components/charts/FuelTypeDistribution.jsx';

function MetricTile({ label, value, sub }) {
  return (
    <div className="card p-4 text-center">
      <div className="kpi-title">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function InfoList({ title, items }) {
  return (
    <div className="section">
      <div className="font-medium mb-2">{title}</div>
      <div className="grid grid-cols-1 gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-600">{it.label}</span>
            <span className="font-medium">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExtraSections() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="section">
          <div className="font-medium mb-2">Hourly/Weekly Sales Pattern</div>
          <SalesPatternBarChart />
        </div>
        <div className="section">
          <div className="font-medium mb-2">Fuel Type Distribution</div>
          <FuelTypeDistribution />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <MetricTile label="Avg. Ticket" value="₹ 2.8" sub="per transaction" />
        <MetricTile label="Vehicles/Day" value="1,217" />
        <MetricTile label="Avg. Queue Time" value="4.6" sub="minutes" />
        <MetricTile label="Uptime" value="97.2%" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <InfoList
          title="Inventory Status"
          items={[
            { label: 'Regular 10kL', value: 'OK' },
            { label: 'Premium 5kL', value: 'Ordering' },
            { label: 'Diesel 15kL', value: 'OK' },
          ]}
        />
        <InfoList
          title="Maintenance Schedule"
          items={[
            { label: 'Pump 2 - Belt', value: 'Due 3 days' },
            { label: 'Tank A - Service', value: 'Next week' },
            { label: 'VAC Service', value: 'In 10 days' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <MetricTile label="Gross Revenue" value="₹ 3,12,550" />
        <MetricTile label="Gross Profit" value="₹ 1,08,200" />
        <MetricTile label="Operating Expense" value="₹ 56,900" />
        <MetricTile label="Net Profit" value="₹ 51,300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <MetricTile label="30D Revenue" value="₹ 3,71,250" sub="forecast" />
        <MetricTile label="30D Profit" value="₹ 1,49,200" sub="forecast" />
        <MetricTile label="30D Volume" value="17,500 L" sub="forecast" />
        <MetricTile label="30D Uptime" value="97%" sub="forecast" />
      </div>
    </>
  );
}


