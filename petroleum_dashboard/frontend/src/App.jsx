import React, { useEffect } from 'react';
import { useDashboardStore } from './lib/state/store.js';
import { FiltersBar } from './features/dashboard/FiltersBar.jsx';
import { KPIRow } from './components/kpis/KPIRow.jsx';
import { PerformanceChart } from './components/charts/PerformanceChart.jsx';
import { ExpenseBreakdown } from './components/charts/ExpenseBreakdown.jsx';
import { TopSitesTable } from './components/tables/TopSitesTable.jsx';
import { ExtraSections } from './features/dashboard/ExtraSections.jsx';
import { FuelPumpIcon } from './components/icons/FuelPump.jsx';

export default function App() {
  const fetchAll = useDashboardStore((s) => s.fetchAll);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <FuelPumpIcon className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold">Petrol Dashboard</h1>
      </div>
      <FiltersBar />
      <KPIRow />
      <div className="mt-6 section">
        <h2 className="font-medium mb-2">Performance</h2>
        <PerformanceChart />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="section">
          <h2 className="font-medium mb-2">Expense % of Sales</h2>
          <ExpenseBreakdown />
        </div>
        <div className="section">
          <h2 className="font-medium mb-2">Top 5 Highest-Earning Sites</h2>
          <TopSitesTable />
        </div>
      </div>

      <ExtraSections />
    </div>
  );
}


