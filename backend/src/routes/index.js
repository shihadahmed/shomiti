import { Router } from 'express';
import { health, system, refreshDbHealth, systemStream } from '../controllers/health.controller.js';
import authRoutes from './auth.routes.js';
import memberRoutes from './member.routes.js';
import savingsRoutes from './savings.routes.js';
import approvalRoutes from './approval.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import schemeRoutes from './scheme.routes.js';
import expenseRoutes from './expense.routes.js';
import documentRoutes from './document.routes.js';
import ledgerRoutes from './ledger.routes.js';
import auditRoutes from './audit.routes.js';
import roleRoutes from './role.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

router.get('/health', health);
router.get('/system', system);
router.get('/system/stream', systemStream);
router.post('/system/refresh-db', refreshDbHealth);

router.use('/auth', authRoutes);
router.use('/members', memberRoutes);
router.use('/savings', savingsRoutes);
router.use('/approvals', approvalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/schemes', schemeRoutes);
router.use('/expenses', expenseRoutes);
router.use('/documents', documentRoutes);
router.use('/ledger', ledgerRoutes);
router.use('/audit', auditRoutes);
router.use('/roles', roleRoutes);
router.use('/notifications', notificationRoutes);

export default router;
