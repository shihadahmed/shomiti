import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles, requirePermission } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, setupPasswordLimiter } from '../middleware/rateLimit.js';
import { ROLES } from '../config/constants.js';
import {
  loginRules,
  changePasswordRules,
  createStaffRules,
  updateUserRoleRules,
  updateUserStatusRules,
  resetUserPasswordRules,
  setupPasswordRules,
  listUsersQueryRules,
  idParam,
} from '../validators/auth.validator.js';
import { kycSubmitRules, kycDecisionRules } from '../validators/kyc.validator.js';
import * as kycController from '../controllers/kyc.controller.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/setup-password', setupPasswordLimiter, setupPasswordRules, validate, authController.setupPassword);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  changePasswordRules,
  validate,
  authController.changePassword,
);

// User Management (permission-based)
router.get(
  '/users',
  authenticate,
  requirePermission('roles.view'),
  listUsersQueryRules,
  validate,
  authController.listUsers,
);

// KYC profile submission (the authenticated member)
router.get(
  '/users/me/kyc',
  authenticate,
  kycController.getMyKyc,
);
router.post(
  '/users/me/kyc',
  authenticate,
  kycSubmitRules,
  validate,
  kycController.submitKyc,
);

// KYC review queue (approvers only)
router.get(
  '/users/kyc-pending',
  authenticate,
  requirePermission('users.manage_kyc'),
  listUsersQueryRules,
  validate,
  kycController.listPendingKyc,
);
router.post(
  '/users/:id/kyc-decision',
  authenticate,
  requirePermission('users.manage_kyc'),
  idParam,
  kycDecisionRules,
  validate,
  kycController.decideKyc,
);

router.post(
  '/users',
  authenticate,
  requirePermission('roles.create'),
  createStaffRules,
  validate,
  authController.createStaff,
);
router.patch(
  '/users/:id/role',
  authenticate,
  requirePermission('roles.assign'),
  updateUserRoleRules,
  validate,
  authController.updateUserRole,
);
router.patch(
  '/users/:id/status',
  authenticate,
  requirePermission('roles.assign'),
  updateUserStatusRules,
  validate,
  authController.updateUserStatus,
);
router.post(
  '/users/:id/reset-password',
  authenticate,
  requirePermission('roles.assign'),
  idParam,
  resetUserPasswordRules,
  validate,
  authController.resetUserPassword,
);
router.delete(
  '/users/:id',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN),
  idParam,
  validate,
  authController.deleteUser,
);

// Metrics endpoint for executive roles
router.get(
  '/users/metrics',
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT),
  authController.getUserMetrics,
);

export default router;
