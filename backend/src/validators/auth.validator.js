import { body, param, query } from 'express-validator';
import { ROLES, ROLE_VALUES } from '../config/constants.js';

const bdPhone = (chain) => chain
  .customSanitizer((value) => String(value || '').replace(/^\+?880/, '0').replace(/[\s-]/g, ''))
  .matches(/^01[3-9]\d{8}$/)
  .withMessage('validation.phone');

export const loginRules = [
  body('identifier').trim().notEmpty().withMessage('validation.required'),
  body('password').isString().notEmpty().withMessage('validation.required'),
];

export const changePasswordRules = [
  body('currentPassword').isString().notEmpty().withMessage('validation.required'),
  body('newPassword')
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('validation.passwordLength')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('validation.passwordStrength'),
];

export const createStaffRules = [
  body('name').trim().notEmpty().withMessage('validation.required').isLength({ max: 120 }),
  body('email').trim().notEmpty().withMessage('validation.required').isEmail().withMessage('validation.email'),
  bdPhone(body('phone').notEmpty().withMessage('validation.required')),
  body('nid')
    .trim()
    .notEmpty()
    .withMessage('validation.required')
    .matches(/^\d{10}$|^\d{13}$|^\d{17}$/)
    .withMessage('validation.nid'),
  body('role')
    .isIn(ROLE_VALUES.filter((role) => role !== ROLES.SUPER_ADMIN))
    .withMessage('validation.enum'),
  body('password').optional({ values: 'falsy' }),
  body('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
];

export const updateUserRoleRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('role')
    .isIn(ROLE_VALUES)
    .withMessage('validation.enum'),
];

export const updateUserStatusRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('isActive')
    .isBoolean()
    .withMessage('validation.boolean'),
];

export const resetUserPasswordRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('password')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 8, max: 72 })
    .withMessage('validation.passwordLength'),
];

export const setupPasswordRules = [
  body('token').trim().notEmpty().withMessage('validation.required'),
  body('password')
    .isString()
    .notEmpty()
    .withMessage('validation.required')
    .isLength({ min: 8, max: 72 })
    .withMessage('validation.passwordLength')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('validation.passwordStrength'),
];

export const listUsersQueryRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('role').optional().isIn(ROLE_VALUES),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'resigned', 'archived']),
  query('search').optional().trim().isLength({ max: 100 }),
];

export const idParam = [param('id').isMongoId().withMessage('validation.identifier')];
