import { Router } from 'express';
import * as listingController from '../controllers/listingController.js';
import { authenticate, requireMinRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/statuses', listingController.statuses);
router.get('/', listingController.listValidators, listingController.list);
router.post('/bulk-assign', requireMinRole('manager'), listingController.bulkAssignValidators, listingController.bulkAssign);
router.get('/:id', listingController.getOne);
router.post('/', requireMinRole('manager'), listingController.createValidators, listingController.create);
router.patch('/:id', requireMinRole('manager'), listingController.updateValidators, listingController.update);
router.delete('/:id', requireMinRole('manager'), listingController.remove);

export default router;
