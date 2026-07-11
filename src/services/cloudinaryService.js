import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export function isCloudinaryConfigured() {
  return !!(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

export async function uploadImageBuffer(buffer, { folder, mimetype }) {
  if (!isCloudinaryConfigured()) {
    const err = new Error('Image uploads are not configured');
    err.status = 503;
    throw err;
  }

  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `crm/${folder}`,
    resource_type: 'image',
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
  };
}
