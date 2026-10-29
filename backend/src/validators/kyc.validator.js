import { body } from 'express-validator';

export const kycSubmitRules = [
  body('fullName').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 120 }),
  body('fatherName').optional().trim().isLength({ max: 120 }),
  body('motherName').optional().trim().isLength({ max: 120 }),
  body('spouseName').optional().trim().isLength({ max: 120 }),
  body('nid')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^\d{10}$|^\d{13}$|^\d{17}$/)
    .withMessage('validation.nid'),
  body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().toDate(),
  body('occupation').optional().trim().isLength({ max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('validation.email'),
  body('phone')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => String(value || '').replace(/^\+?880/, '0').replace(/[\s-]/g, ''))
    .matches(/^01[3-9]\d{8}$/)
    .withMessage('validation.phone'),
  body('village').optional().trim().isLength({ max: 120 }),
  body('postOffice').optional().trim().isLength({ max: 120 }),
  body('upazila').optional().trim().isLength({ max: 120 }),
  body('district').optional().trim().isLength({ max: 120 }),
  body('nomineeName').optional().trim().isLength({ max: 120 }),
  body('nomineeRelation').optional().trim().isLength({ max: 120 }),
  body('nomineePhone')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => String(value || '').replace(/^\+?880/, '0').replace(/[\s-]/g, ''))
    .matches(/^01[3-9]\d{8}$/)
    .withMessage('validation.phone'),
  body('shareCount').optional({ values: 'falsy' }).isInt({ min: 0, max: 100000 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
];

export const kycDecisionRules = [
  body('decision').isIn(['approved', 'rejected']).withMessage('validation.enum'),
  body('reason')
    .custom((value, { req }) => {
      if (req.body.decision === 'rejected' && (!value || !String(value).trim())) {
        throw new Error('validation.required');
      }
      return true;
    })
    .trim()
    .isLength({ max: 1000 }),
];
