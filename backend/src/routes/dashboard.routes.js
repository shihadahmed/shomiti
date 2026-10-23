import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireStaff } from '../middleware/authorize.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate, requireStaff);

router.get('/', dashboardController.getDashboard);
router.get('/transactions', dashboardController.getRecentTransactions);
router.get('/approvals', dashboardController.getPendingApprovals);
router.get('/overdue', dashboardController.getOverdueMembers);
router.get('/trend', dashboardController.getMonthlyTrend);

export default router;