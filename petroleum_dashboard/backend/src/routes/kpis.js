import { Router } from 'express';
import { parseFilters } from '../schemas/filters.js';
import { getOverview, getPerformance, getExpensesBreakdown } from '../modules/kpis.js';

const router = Router();

router.get('/overview', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getOverview(filters);
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/performance', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getPerformance(filters);
    res.json(data);
  } catch (e) { next(e); }
});

router.get('/expenses-breakdown', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const data = await getExpensesBreakdown(filters);
    res.json(data);
  } catch (e) { next(e); }
});

export default router;

