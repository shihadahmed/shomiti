import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorize.js';
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

// All routes require authentication and specific permissions
router.use(authenticate);

router.get('/', requirePermission('roles.view'), listRolesQueryRules, validate, roleController.listRoles);
router.post('/', requirePermission('roles.create'), createRoleRules, validate, roleController.createRole);
router.get('/:id', requirePermission('roles.view'), roleIdParam, validate, roleController.getRole);
router.put('/:id', requirePermission('roles.update'), updateRoleRules, validate, roleController.updateRole);
router.delete('/:id', requirePermission('roles.delete'), roleIdParam, validate, roleController.deleteRole);

export default router;