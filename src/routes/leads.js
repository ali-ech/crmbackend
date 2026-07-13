import { Router } from 'express';
import { param } from 'express-validator';
import * as leadController from '../controllers/leadController.js';
import { authenticate } from '../middleware/auth.js';
import { importFileUpload } from '../middleware/importUpload.js';
import activityRoutes from './activities.js';

const router = Router();

router.use(authenticate);

router.post('/bulk-assign', leadController.bulkAssignValidators, leadController.bulkAssign);
router.post('/bulk-delete', leadController.bulkDeleteValidators, leadController.bulkDelete);
router.post('/smart-forward', leadController.smartForwardValidators, leadController.smartForward);
router.get('/meta', leadController.meta);
router.get('/', leadController.listValidators, leadController.list);
router.post('/', leadController.createValidators, leadController.create);
router.post('/import/parse', leadController.importParseValidators, leadController.importParse);
router.post('/import/parse-file', importFileUpload.single('file'), leadController.importParseFile);
router.post('/import/confirm', leadController.importConfirmValidators, leadController.importConfirm);
router.use('/:leadId/activities', activityRoutes);
router.get('/:id', leadController.getOne);
router.patch('/:id', leadController.updateValidators, leadController.update);
router.delete('/:id', param('id').isMongoId(), leadController.remove);
router.post('/:id/merge', leadController.merge);
export default router;
