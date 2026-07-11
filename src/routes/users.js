import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, requireMinRole, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', requireMinRole('manager'), userController.list);
router.get('/agents/active', requireMinRole('manager'), userController.activeAgents);
router.get('/managers/active', requireRole('superadmin'), userController.activeManagers);
router.post('/', requireMinRole('manager'), userController.createUserValidators, userController.create);
router.get('/:id', userController.getOne);
router.patch('/:id', userController.update);
router.get('/:id/deactivation-preview', requireMinRole('manager'), userController.deactivationPreview);
router.post('/:id/deactivate', requireMinRole('manager'), userController.deactivateValidators, userController.deactivate);
router.post('/:id/reactivate', requireMinRole('manager'), userController.reactivate);

export default router;
