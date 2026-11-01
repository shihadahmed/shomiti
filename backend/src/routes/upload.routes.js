import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadSingle } from '../middleware/upload.js';
import { uploadFile } from '../controllers/upload.controller.js';

const router = Router();

/**
 * POST /api/upload
 * Upload a single file to Cloudinary.
 * Multipart form data with 'file' field. Requires an authenticated session —
 * anonymous uploads would let anyone burn the Cloudinary quota.
 */
router.post('/', authenticate, uploadSingle('file'), uploadFile);

export default router;
