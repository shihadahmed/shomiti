import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { STAFF_ROLES } from '../config/constants.js';
import * as ledgerController from '../controllers/ledger.controller.js';

const router = Router();

router.use(authenticate, requireRoles(...STAFF_ROLES));

router.get('/accounts', ledgerController.accounts);
router.get('/trial-balance', ledgerController.trialBalance);
router.get('/chart-of-accounts', ledgerController.chartOfAccounts);
router.get('/entries', ledgerController.entries);

export default router;
