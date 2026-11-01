import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

const MIN_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only JPG, PNG, WebP, and PDF files are allowed.'), false);
  }
};

// Configure multer for memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('file');

/**
 * POST /api/upload
 * Upload a single file (image or PDF) to Cloudinary
 * Body: multipart/form-data with field 'file'
 * Returns: { success: true, url: 'secure_url', publicId: 'public_id', resourceType: 'image|raw' }
 */
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded.', 'FILE_REQUIRED');
  }

  // Check minimum file size
  if (req.file.size < MIN_FILE_SIZE) {
    throw ApiError.badRequest('File size must be at least 3MB.', 'FILE_TOO_SMALL');
  }

  const { originalname, mimetype, buffer } = req.file;
  const isPdf = mimetype === 'application/pdf';

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'shopnonir/members',
          resource_type: isPdf ? 'raw' : 'image',
          public_id: `${Date.now()}-${originalname.split('.')[0]}`,
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

    res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      },
    });
  } catch (error) {
    throw ApiError.internal('Failed to upload file to Cloudinary.', 'UPLOAD_FAILED');
  }
});

export default { upload, uploadFile };