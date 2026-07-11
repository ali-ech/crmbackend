import { Router } from 'express';
import * as whatsappController from '../controllers/whatsappController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/status', requireRole('agent'), whatsappController.status);
router.post('/connect', requireRole('agent'), whatsappController.connectValidators, whatsappController.connect);
router.get('/qr', requireRole('agent'), whatsappController.qr);
router.post('/disconnect', requireRole('agent'), whatsappController.disconnect);

router.get('/leads/:leadId/listings', whatsappController.sendableListings);
router.post('/leads/:leadId/send', whatsappController.sendValidators, whatsappController.sendProperty);

export default router;
