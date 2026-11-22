import { body, param } from 'express-validator';
import { DOCUMENT_CATEGORY_VALUES } from '../config/constants.js';

export const uploadDocumentRules = [
  body('title').trim().notEmpty().withMessage('validation.required').isLength({ max: 200 }).withMessage('validation.maxLength'),
  body('category').notEmpty().withMessage('validation.required').isIn(DOCUMENT_CATEGORY_VALUES).withMessage('validation.enum'),
  body('memberId').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
  body('visibility').notEmpty().withMessage('validation.required').isIn(['all', 'specific', 'staff', 'member']).withMessage('validation.enum'),
];

export const documentIdParam = [param('id').isMongoId().withMessage('validation.identifier')];
