import { Router } from 'express';
import { getSites } from '../modules/sites.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await getSites());
  } catch (e) { next(e); }
});

export default router;

