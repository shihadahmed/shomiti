import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles, requireStaff } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploadSingle } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';
import {
  uploadDocumentRules,
  documentIdParam,
} from '../validators/document.validator.js';
import * as documentController from '../controllers/document.controller.js';

const router = Router();

router.use(authenticate);

// Member portal: only documents explicitly shared with that member.
router.get('/my', documentController.myDocuments);

router.use(requireStaff);

router.get('/', documentController.list);
router.post(
  '/',
  requireRoles(
    ROLES.SUPER_ADMIN,
    ROLES.TREASURER,
    ROLES.GENERAL_SECRETARY,
    ROLES.PRESIDENT,
  ),
  uploadSingle('file'),
  uploadDocumentRules,
  validate,
  documentController.upload,
);
router.get('/:id/file', documentIdParam, validate, documentController.download);
router.delete(
  '/:id',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.GENERAL_SECRETARY),
  documentIdParam,
  validate,
  documentController.remove,
);

export default router;
