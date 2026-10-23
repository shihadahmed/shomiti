import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles, requireStaff } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createExpenseRules,
  submitExpenseRules,
  approveExpenseRules,
  rejectExpenseRules,
  listExpenseRules,
  expenseIdParam,
} from '../validators/expense.validator.js';
import * as expenseController from '../controllers/expense.controller.js';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', listExpenseRules, validate, expenseController.list);
router.get('/pending', expenseController.pendingForMe);
router.get('/categories', expenseController.categories);
router.post(
  '/',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  createExpenseRules,
  validate,
  expenseController.create,
);
router.get('/:id', expenseIdParam, validate, expenseController.detail);
router.post(
  '/:id/submit',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY),
  submitExpenseRules,
  validate,
  expenseController.submit,
);
router.post(
  '/:id/approve',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT),
  approveExpenseRules,
  validate,
  expenseController.approve,
);
router.post(
  '/:id/reject',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT),
  rejectExpenseRules,
  validate,
  expenseController.reject,
);

export default router;