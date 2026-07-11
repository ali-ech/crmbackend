import { Router } from 'express';
import * as taskController from '../controllers/taskController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', taskController.list);
router.post('/', taskController.createValidators, taskController.create);
router.patch('/:id', taskController.updateValidators, taskController.update);
router.post('/:id/complete', taskController.complete);
router.post('/:id/nudge', taskController.nudge);

export default router;
