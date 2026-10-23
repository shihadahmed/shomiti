import { body, param, query } from 'express-validator';
import { SAVINGS_TYPE_VALUES, SAVINGS_DUE_STATUS_VALUES, PAYMENT_METHOD_VALUES, TRANSACTION_STATUS_VALUES, TRANSACTION_TYPE_VALUES } from '../config/constants.js';

export const createTransactionRules = [
  body('memberId').isMongoId().withMessage('validation.identifier'),
  body('accountId').isMongoId().withMessage('validation.identifier'),
  body('type').isIn(TRANSACTION_TYPE_VALUES).withMessage('validation.enum'),
  body('amount').custom((value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('validation.amount');
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('validation.amountFormat');
    return true;
  }),
  body('method').isIn(PAYMENT_METHOD_VALUES).withMessage('validation.enum'),
  body('providerRef').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('senderNumber').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  body('bankName').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
  body('schemeId').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
  body('installmentNo').optional().isInt({ min: 1 }),
];

export const listTransactionRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
  query('accountId').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
  query('type').optional().isIn(TRANSACTION_TYPE_VALUES).withMessage('validation.enum'),
  query('status').optional().isIn(TRANSACTION_STATUS_VALUES).withMessage('validation.enum'),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('search').optional().trim(),
];

export const transactionIdParam = [param('id').isMongoId().withMessage('validation.identifier')];

export const generateDuesRules = [
  body('savingsType').isIn(SAVINGS_TYPE_VALUES).withMessage('validation.enum'),
  body('period').trim().isLength({ min: 1, max: 20 }),
  body('members').optional().isArray(),
  body('members.*').optional().isMongoId().withMessage('validation.identifier'),
];

export const paySavingsDueRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('amount').custom((value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('validation.amount');
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) throw new Error('validation.amountFormat');
    return true;
  }),
  body('method').isIn(PAYMENT_METHOD_VALUES).withMessage('validation.enum'),
  body('providerRef').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('senderNumber').optional({ values: 'falsy' }).trim().isLength({ max: 30 }),
  body('bankName').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];

export const verifyPaymentRules = [
  param('id').isMongoId().withMessage('validation.identifier'),
  body('approved').isBoolean().withMessage('validation.boolean'),
  body('rejectionReason').if(body('approved').equals('false')).notEmpty().withMessage('validation.required').trim().isLength({ max: 500 }),
];

export const listDuesRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
  query('savingsType').optional().isIn(SAVINGS_TYPE_VALUES).withMessage('validation.enum'),
  query('status').optional().isIn(SAVINGS_DUE_STATUS_VALUES).withMessage('validation.enum'),
  query('period').optional().trim(),
  query('search').optional().trim(),
];

export const dueIdParam = [param('id').isMongoId().withMessage('validation.identifier')];