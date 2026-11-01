import { Router } from 'express';
import { upload, uploadFile } from '../controllers/upload.controller.js';

const router = Router();

/**
 * POST /api/upload
 * Upload a single file (image or PDF) to Cloudinary
 * Multipart form data with 'file' field
 */
router.post('/', upload, uploadFile);

export default router;