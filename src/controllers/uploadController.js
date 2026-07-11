import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadImageBuffer } from '../services/cloudinaryService.js';

const ALLOWED_FOLDERS = new Set(['headshots', 'listings']);

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  const folder = ALLOWED_FOLDERS.has(req.query.folder) ? req.query.folder : 'listings';

  const result = await uploadImageBuffer(req.file.buffer, {
    folder,
    mimetype: req.file.mimetype,
  });

  res.json(result);
});

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No image files provided' });
  }

  const folder = ALLOWED_FOLDERS.has(req.query.folder) ? req.query.folder : 'listings';

  const uploads = await Promise.all(
    files.map((file) =>
      uploadImageBuffer(file.buffer, { folder, mimetype: file.mimetype })
    )
  );

  res.json({ uploads });
});
