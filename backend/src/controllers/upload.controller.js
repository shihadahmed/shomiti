import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { uploadToCloudinary } from '../middleware/upload.js';
import cloudinary from '../config/cloudinary.js';

/**
 * POST /api/upload
 * Upload a single file (image, PDF or office document) to Cloudinary.
 * Body: multipart/form-data with field 'file'
 * Returns: { success: true, data: { url, publicId, resourceType, format, width, height, bytes } }
 *
 * Multer parsing and MIME/size filtering live in `middleware/upload.js` so this
 * endpoint and the document routes share one configuration.
 */
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded.', 'FILE_REQUIRED');
  }

  // Check if Cloudinary is configured
  if (!cloudinary.config().cloud_name) {
    throw ApiError.internal('File upload service not configured. Please contact administrator.', 'UPLOAD_SERVICE_UNAVAILABLE');
  }

  const { originalname, mimetype, buffer } = req.file;

  try {
    const result = await uploadToCloudinary(buffer, {
      originalName: originalname,
      mimeType: mimetype,
      folder: 'shopnonir/members',
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
    console.error('[Upload] Cloudinary upload failed:', error);
    throw ApiError.internal('Failed to upload file to Cloudinary.', 'UPLOAD_FAILED');
  }
});

export default { uploadFile };
