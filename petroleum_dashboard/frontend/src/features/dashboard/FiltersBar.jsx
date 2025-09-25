import React from 'react';
import { useDashboardStore } from '../../lib/state/store.js';
import { MultiSelect } from '../../components/inputs/MultiSelect.jsx';
import { DateRangePicker } from '../../components/inputs/DateRangePicker.jsx';

export function FiltersBar() {
  const { filters, setFilters, sites, fetchAll } = useDashboardStore();

  const onApply = async () => {
    await fetchAll();
  };

  return (
    <div className="section mb-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 md:col-span-2">
          <label className="text-sm text-gray-600">Date Range</label>
          <div className="mt-1">
            <DateRangePicker start={filters.start} end={filters.end} onChange={({start,end})=>setFilters({ start, end })} />
          </div>
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-600">Sites</label>
          <div className="mt-1">
            <MultiSelect options={sites} value={filters.siteIds} onChange={(ids)=>setFilters({ siteIds: ids })} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.includeShop} onChange={(e)=>setFilters({ includeShop: e.target.checked })} /> Include Shop</label>
          <select className="border rounded px-2 py-1" value={filters.granularity} onChange={(e)=>setFilters({ granularity: e.target.value })}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <button className="bg-primary hover:opacity-95 text-white rounded px-4 py-2" onClick={onApply}>Apply</button>
        </div>
      </div>
    </div>
  );
}


