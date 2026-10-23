import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles, requireStaff } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  listTransactionRules,
  transactionIdParam,
  paySavingsDueRules,
  verifyPaymentRules,
  listDuesRules,
  dueIdParam,
  generateDuesRules,
} from '../validators/savings.validator.js';
import * as savingsController from '../controllers/savings.controller.js';

const router = Router();

router.use(authenticate);

// Member self-service (linked member portal accounts)
router.get('/my/dues', savingsController.myDues);
router.get('/my/transactions', savingsController.myTransactions);

// Staff endpoints below
router.use(requireStaff);

// Dues management
router.get('/dues', listDuesRules, validate, savingsController.listDues);
router.get('/dues/:id', dueIdParam, validate, savingsController.getDue);
router.post(
  '/dues/:id/pay',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER),
  paySavingsDueRules,
  validate,
  savingsController.payDue,
);
router.post(
  '/dues/generate',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER),
  generateDuesRules,
  validate,
  savingsController.generateDues,
);

// Manual payment slip review queue
router.get('/payments', savingsController.listPaymentSlips);
router.get('/payments/:id', dueIdParam, validate, savingsController.paymentSlipDetail);
router.post(
  '/payments/:id/verify',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT),
  verifyPaymentRules,
  validate,
  savingsController.verifyPayment,
);

// Transactions
router.get('/transactions', listTransactionRules, validate, savingsController.listTransactions);
router.get(
  '/transactions/:id',
  transactionIdParam,
  validate,
  savingsController.transactionDetail,
);
router.get('/members/:memberId/accounts', savingsController.memberAccounts);

export default router;
