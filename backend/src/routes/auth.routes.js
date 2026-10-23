import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { ROLES } from '../config/constants.js';
import {
  loginRules,
  changePasswordRules,
  createStaffRules,
  updateUserRoleRules,
  updateUserStatusRules,
  resetUserPasswordRules,
  listUsersQueryRules,
  idParam,
} from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  changePasswordRules,
  validate,
  authController.changePassword,
);

// User Management (Super Admin only)
router.get(
  '/users',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN),
  listUsersQueryRules,
  validate,
  authController.listUsers,
);
router.post(
  '/users',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN),
  createStaffRules,
  validate,
  authController.createStaff,
);
router.patch(
  '/users/:id/role',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN),
  updateUserRoleRules,
  validate,
  authController.updateUserRole,
);
router.patch(
  '/users/:id/status',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  updateUserStatusRules,
  validate,
  authController.updateUserStatus,
);
router.post(
  '/users/:id/reset-password',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN),
  idParam,
  resetUserPasswordRules,
  validate,
  authController.resetUserPassword,
);

// Metrics endpoint for executive roles
router.get(
  '/users/metrics',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT),
  authController.getUserMetrics,
);

export default router;
