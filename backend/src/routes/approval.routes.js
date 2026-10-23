import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireStaff, requireApprover } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  decideApprovalRules,
  decideSlipRules,
  listApprovalRules,
  approvalIdParam,
} from '../validators/approval.validator.js';
import * as approvalController from '../controllers/approval.controller.js';

const router = Router();

router.use(authenticate, requireStaff);

// Manual payment slip queue (cash / bank transfer)
router.get('/slips', approvalController.listSlips);
router.get('/slips/:id', approvalIdParam, validate, approvalController.slipDetail);
router.post(
  '/slips/:id/decision',
  requireApprover,
  decideSlipRules,
  validate,
  approvalController.decideSlip,
);

// Generic dual-control requests
router.get('/', listApprovalRules, validate, approvalController.list);
router.get('/:id', approvalIdParam, validate, approvalController.detail);
router.post(
  '/:id/decision',
  requireApprover,
  decideApprovalRules,
  validate,
  approvalController.decide,
);
router.post('/:id/cancel', approvalIdParam, validate, approvalController.cancel);

export default router;
