import multer from 'multer';
import { IMPORT_FILE_TYPES } from '../services/geminiService.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const importFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (IMPORT_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Use PDF, JPG, PNG, or WebP.'));
    }
  },
});
