import multer from 'multer';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/** Single source of truth for the upload size ceiling (client must stay under this). */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      ApiError.badRequest(
        'Unsupported file type. Upload an image, PDF, Word or Excel file.',
        'UPLOAD_TYPE_NOT_ALLOWED',
      ),
    );
  }
  return cb(null, true);
};

// Use memory storage for Cloudinary upload
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

export const uploadSingle = (field = 'file') => upload.single(field);
export const allowedMimeTypes = [...ALLOWED_MIME_TYPES];

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - { originalName, mimeType, folder }
 * @returns {Promise<Object>} Cloudinary upload result
 */
export async function uploadToCloudinary(buffer, { originalName, mimeType, folder = 'shopnonir/documents' }) {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary not configured. Set a valid CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
  }

  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');
  const isDocument = ['application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(mimeType);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isImage ? 'image' : 'raw',
        public_id: `${Date.now()}-${originalName.split('.')[0]}`,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    uploadStream.end(buffer);
  });
}

export default upload;