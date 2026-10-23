import { body, param, query } from 'express-validator';
import { SAVINGS_TYPE_VALUES } from '../config/constants.js';

export const generateDuesRules = [
  body('savingsType').isIn(SAVINGS_TYPE_VALUES).withMessage('validation.enum'),
  body('period').trim().notEmpty().withMessage('validation.required'),
];

export const schemeRules = [
  body('savingsType').isIn(SAVINGS_TYPE_VALUES).withMessage('validation.enum'),
  body('name').trim().notEmpty().withMessage('validation.required').isLength({ max: 160 }),
  body('nameBn').optional({ values: 'falsy' }).trim().isLength({ max: 160 }),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('principalPaisa').custom((value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('validation.amount');
    return true;
  }),
  body('lateFeePercent').optional().isFloat({ min: 0, max: 100 }).withMessage('validation.percentageRange').toFloat(),
];

export const schemeIdParam = [param('id').isMongoId().withMessage('validation.identifier')];