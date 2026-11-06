import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { loginLimiter, setupPasswordLimiter } from '../middleware/rateLimit.js';
import {
  loginRules,
  changePasswordRules,
  setupPasswordRules,
  requestPasswordResetRules,
  listKycQueryRules,
  idParam,
} from '../validators/auth.validator.js';
import { kycSubmitRules, kycDecisionRules } from '../validators/kyc.validator.js';
import * as kycController from '../controllers/kyc.controller.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/setup-password', setupPasswordLimiter, setupPasswordRules, validate, authController.setupPassword);
router.post('/forgot-password', setupPasswordLimiter, requestPasswordResetRules, validate, authController.requestPasswordReset);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post(
  '/change-password',
  authenticate,
  changePasswordRules,
  validate,
  authController.changePassword,
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
  listKycQueryRules,
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

export default router;
