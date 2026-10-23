import { body, param, query } from 'express-validator';
import { ALL_PERMISSIONS, ROLES, ROLE_VALUES } from '../config/constants.js';

const permissionArray = body('permissions')
  .optional()
  .isArray()
  .withMessage('Permissions must be an array')
  .custom((arr) => {
    if (!Array.isArray(arr)) return true;
    const invalid = arr.filter(p => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
    }
    return true;
  });

export const createRoleRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Role name is required')
    .isLength({ max: 60 })
    .withMessage('Role name too long (max 60 chars)')
    .custom((name) => {
      // Prevent creating system role names
      if (ROLE_VALUES.includes(name)) {
        throw new Error('Cannot create a role with a reserved system name');
      }
      return true;
    }),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 300 })
    .withMessage('Description too long (max 300 chars)'),
  permissionArray,
];

export const updateRoleRules = [
  param('id').isMongoId().withMessage('Invalid role ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Role name is required')
    .isLength({ max: 60 })
    .withMessage('Role name too long'),
  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 300 })
    .withMessage('Description too long'),
  permissionArray,
];

export const roleIdParam = [
  param('id').isMongoId().withMessage('Invalid role ID'),
];

export const listRolesQueryRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().isLength({ max: 100 }),
];