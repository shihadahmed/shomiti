import config from './env.js';
import { v2 as cloudinary } from 'cloudinary';

const cloudName = (config.cloudinary.cloudName || '').trim();
const apiKey = (config.cloudinary.apiKey || '').trim();
const apiSecret = (config.cloudinary.apiSecret || '').trim();

// Cloudinary cloud names may only contain letters, numbers and hyphens
// (https://cloudinary.com/documentation/ts_permitted_naming_conventions).
const CLOUD_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]{1,127}$/;
const validCloudName = CLOUD_NAME_PATTERN.test(cloudName);

export const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret && validCloudName);

if (cloudName && apiKey && apiSecret && !validCloudName) {
  console.error(
    `[cloudinary] Invalid CLOUDINARY_CLOUD_NAME "${cloudName}". Cloud names may only ` +
      'contain letters, numbers and hyphens (no underscores or spaces). Copy the exact ' +
      'Cloud name from the Cloudinary Console dashboard and verify the API key/secret ' +
      'belong to the same product environment.',
  );
} else if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  console.info('[cloudinary] Configured successfully');
} else {
  console.warn('[cloudinary] Credentials missing - uploads will fail. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

export default cloudinary;
