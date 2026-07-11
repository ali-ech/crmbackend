import { Router } from 'express';
import * as activityController from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', activityController.list);
router.post('/', activityController.createValidators, activityController.create);

export default router;
