import { body, param, query } from 'express-validator';
import { EXPENSE_STATUS_VALUES, ROLES } from '../config/constants.js';

export const createExpenseRules = [
  body('title').trim().notEmpty().withMessage('validation.required').isLength({ max: 200 }),
  body('category').trim().notEmpty().withMessage('validation.required').isLength({ max: 100 }),
  body('amount').custom((value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('validation.amount');
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('validation.amountFormat');
    return true;
  }),
  body('payee').optional({ values: 'falsy' }).trim().isLength({ max: 160 }),
  body('paymentMethod').optional().isIn(['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer']).withMessage('validation.enum'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

export const submitExpenseRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
];

export const approveExpenseRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('comment').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];

export const rejectExpenseRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('reason').trim().notEmpty().withMessage('validation.required').isLength({ max: 500 }),
];

export const listExpenseRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(EXPENSE_STATUS_VALUES).withMessage('validation.enum'),
  query('category').optional().trim(),
  query('search').optional().trim(),
  query('from').optional({ values: 'falsy' }).isISO8601().withMessage('validation.date'),
  query('to').optional({ values: 'falsy' }).isISO8601().withMessage('validation.date'),
];

export const expenseIdParam = [param('id').isMongoId().withMessage('validation.identifier')];