import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/dashboard', analyticsController.dashboard);
router.get('/chart', analyticsController.chart);
router.get('/team-hierarchy', analyticsController.teamHierarchy);

export default router;
