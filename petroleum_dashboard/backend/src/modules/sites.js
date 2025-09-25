import { query, testConnection } from '../core/db.js';
import { mapping } from '../config/mapping.js';
import { mockSites } from './mock.js';

export async function getSites() {
  const hasDb = await testConnection();
  if (!hasDb) return mockSites();
  const s = mapping.sites;
  const rows = await query(`SELECT ${s.id} as id, ${s.name} as name, ${s.city} as city FROM ${s.table} ORDER BY ${s.name} ASC`);
  return rows.map((r) => ({ id: r.id, name: r.name, city: r.city }));
}

