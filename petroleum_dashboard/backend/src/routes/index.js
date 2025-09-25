import { Router } from 'express';
import kpisRouter from './kpis.js';
import sitesRouter from './sites.js';

const router = Router();

router.use('/kpis', kpisRouter);
router.use('/sites', sitesRouter);

export default router;

