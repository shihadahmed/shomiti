import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles, requireStaff } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { schemeRules, schemeIdParam } from '../validators/scheme.validator.js';
import * as schemeController from '../controllers/scheme.controller.js';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', schemeController.list);
router.get('/enrollments', schemeController.enrollments);
router.get('/enrollments/:id', schemeIdParam, validate, schemeController.enrollmentDetail);
router.post(
  '/',
  requireRoles(ROLES.SUPER_ADMIN),
  schemeRules,
  validate,
  schemeController.create,
);
router.patch(
  '/:id',
  requireRoles(ROLES.SUPER_ADMIN),
  schemeIdParam,
  validate,
  schemeController.update,
);
router.post(
  '/enroll',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  schemeController.enroll,
);

export default router;
