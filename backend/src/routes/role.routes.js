import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import {
  createRoleRules,
  updateRoleRules,
  roleIdParam,
  listRolesQueryRules,
} from '../validators/role.validator.js';
import * as roleController from '../controllers/role.controller.js';

const router = Router();

// All routes require authentication and super_admin role
router.use(authenticate, requireRoles(ROLES.SUPER_ADMIN));

router.get('/', listRolesQueryRules, validate, roleController.listRoles);
router.post('/', createRoleRules, validate, roleController.createRole);
router.get('/:id', roleIdParam, validate, roleController.getRole);
router.put('/:id', updateRoleRules, validate, roleController.updateRole);
router.delete('/:id', roleIdParam, validate, roleController.deleteRole);

export default router;