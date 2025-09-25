import { create } from 'zustand';
import { startOfMonth, endOfMonth, formatISO } from 'date-fns';
import { api } from '../api/client.js';

const defaultStart = startOfMonth(new Date());
const defaultEnd = endOfMonth(new Date());

export const useDashboardStore = create((set, get) => ({
  filters: {
    start: formatISO(defaultStart),
    end: formatISO(defaultEnd),
    siteIds: [],
    includeShop: true,
    granularity: 'day',
  },
  sites: [],
  overview: null,
  performance: [],
  expensesPct: { wages: 0, electricity: 0, repairs: 0, other: 0 },
  loading: false,

  setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),

  fetchSites: async () => {
    const sites = await api.getSites();
    set({ sites });
  },
  fetchOverview: async () => {
    const data = await api.getOverview(get().filters);
    set({ overview: data });
  },
  fetchPerformance: async () => {
    const data = await api.getPerformance(get().filters);
    set({ performance: data });
  },
  fetchExpenses: async () => {
    const data = await api.getExpenses(get().filters);
    set({ expensesPct: data });
  },
  fetchAll: async () => {
    set({ loading: true });
    await get().fetchSites();
    await Promise.all([get().fetchOverview(), get().fetchPerformance(), get().fetchExpenses()]);
    set({ loading: false });
  },
}));


