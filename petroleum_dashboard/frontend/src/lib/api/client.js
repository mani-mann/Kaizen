import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const http = axios.create({ baseURL });

function serializeFilters(f) {
  const params = { ...f };
  if (Array.isArray(f.siteIds) && f.siteIds.length) params.siteIds = f.siteIds.join(',');
  return params;
}

export const api = {
  async getSites() {
    const { data } = await http.get('/sites');
    return data;
  },
  async getOverview(filters) {
    const { data } = await http.get('/kpis/overview', { params: serializeFilters(filters) });
    return data;
  },
  async getPerformance(filters) {
    const { data } = await http.get('/kpis/performance', { params: serializeFilters(filters) });
    return data;
  },
  async getExpenses(filters) {
    const { data } = await http.get('/kpis/expenses-breakdown', { params: serializeFilters(filters) });
    return data;
  },
};


