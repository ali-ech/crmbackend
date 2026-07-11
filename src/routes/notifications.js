import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate, authenticateStream } from '../middleware/auth.js';

const router = Router();

router.get('/stream', authenticateStream, notificationController.stream);

router.use(authenticate);

router.get('/', notificationController.list);
router.get('/latest', notificationController.latest);
router.get('/unread-count', notificationController.unreadCount);
router.post('/read-all', notificationController.markAllRead);
router.post('/read-section/:section', notificationController.markSectionRead);
router.patch('/:id/read', notificationController.markReadValidators, notificationController.markRead);

export default router;
