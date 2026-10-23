import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { ROLES } from '../config/constants.js';
import * as auditController from '../controllers/audit.controller.js';

const router = Router();

router.use(authenticate, requireRoles(ROLES.SUPER_ADMIN, ROLES.PRESIDENT));

router.get('/', auditController.list);

export default router;
