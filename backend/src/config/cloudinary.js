import config from './env.js';
import { v2 as cloudinary } from 'cloudinary';

const cloudName = config.cloudinary.cloudName;
const apiKey = config.cloudinary.apiKey;
const apiSecret = config.cloudinary.apiSecret;

if (cloudName && apiKey && apiSecret) {
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