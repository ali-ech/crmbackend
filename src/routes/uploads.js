import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { imageUpload } from '../middleware/imageUpload.js';
import * as uploadController from '../controllers/uploadController.js';

const router = Router();

router.use(authenticate);

router.post('/image', imageUpload.single('file'), uploadController.uploadImage);
router.post('/images', imageUpload.array('files', 12), uploadController.uploadImages);

export default router;
