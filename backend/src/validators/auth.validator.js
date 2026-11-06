import { body, param, query } from 'express-validator';
import { USER_STATUS_VALUES } from '../config/constants.js';

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

export const requestPasswordResetRules = [
  body('identifier').trim().notEmpty().withMessage('validation.required'),
];

/** Filters for the KYC review queue. */
export const listKycQueryRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(USER_STATUS_VALUES).withMessage('validation.enum'),
  query('search').optional().trim().isLength({ max: 100 }),
];

export const idParam = [param('id').isMongoId().withMessage('validation.identifier')];
