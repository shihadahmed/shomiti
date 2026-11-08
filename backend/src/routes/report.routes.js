import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireStaff } from '../middleware/authorize.js';
import * as reportController from '../controllers/report.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireStaff);

router.get('/', reportController.getReport);
router.get('/export', reportController.exportReport);

export default router;