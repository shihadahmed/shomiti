import { body, param, query } from 'express-validator';
import { APPROVAL_ENTITY_VALUES, APPROVAL_STATUS_VALUES } from '../config/constants.js';

export const decideApprovalRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('decision').isIn(['approved', 'rejected']).withMessage('validation.enum'),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }).withMessage('validation.maxLength'),
];

export const decideSlipRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('decision').isIn(['approved', 'rejected']).withMessage('validation.enum'),
  body('reason')
    .if(body('decision').equals('rejected'))
    .trim()
    .notEmpty()
    .withMessage('validation.required')
    .isLength({ max: 500 })
    .withMessage('validation.maxLength'),
];

export const listApprovalRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(APPROVAL_STATUS_VALUES).withMessage('validation.enum'),
  query('entityType').optional().isIn(APPROVAL_ENTITY_VALUES).withMessage('validation.enum'),
];

export const approvalIdParam = [param('id').isMongoId().withMessage('validation.identifier')];
