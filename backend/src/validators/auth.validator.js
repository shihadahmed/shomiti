import { body, param, query } from 'express-validator';
import { ROLES } from '../config/constants.js';
import Role from '../models/Role.js';
import Member from '../models/Member.js';

const bdPhone = (chain) => chain
  .customSanitizer((value) => String(value || '').replace(/^\+?880/, '0').replace(/[\s-]/g, ''))
  .matches(/^01[3-9]\d{8}$/)
  .withMessage('validation.phone');

const validateRoleExists = async (value) => {
  // Allow system roles without checking Role collection
  const systemRoles = ['super_admin', 'president', 'general_secretary', 'treasurer', 'member'];
  if (systemRoles.includes(value)) {
    if (value === ROLES.SUPER_ADMIN) {
      throw new Error('validation.enum');
    }
    return true;
  }
  // For custom roles, check if they exist in Role collection
  const role = await Role.findOne({ name: value });
  if (!role) {
    throw new Error('validation.enum');
  }
  return true;
};

const validateMemberExists = async (value, { req }) => {
  const member = await Member.findById(value);
  if (!member) {
    throw new Error('validation.memberNotFound');
  }
  if (member.userId) {
    throw new Error('validation.memberHasUser');
  }
  req.memberData = member;
  return true;
};

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
  body('memberId')
    .notEmpty().withMessage('validation.required')
    .isMongoId().withMessage('validation.identifier')
    .custom(validateMemberExists),
  body('role')
    .custom(validateRoleExists)
    .withMessage('validation.enum'),
  body('password').optional({ values: 'falsy' }),
];

export const updateUserRoleRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('role')
    .custom(validateRoleExists)
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
  query('role').optional().custom(validateRoleExists),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'resigned', 'archived']),
  query('search').optional().trim().isLength({ max: 100 }),
];

export const idParam = [param('id').isMongoId().withMessage('validation.identifier')];
