import { body, param, query } from 'express-validator';
import { MEMBER_STATUS_VALUES } from '../config/constants.js';

const bdPhone = (chain) => chain
  .customSanitizer((value) => String(value || '').replace(/^\+?880/, '0').replace(/[\s-]/g, ''))
  .matches(/^01[3-9]\d{8}$/)
  .withMessage('validation.phone');

const optionalText = (chain, max = 160) => chain
  .optional({ values: 'null' })
  .trim()
  .isLength({ max })
  .withMessage('validation.maxLength');

const nomineeFields = (prefix = 'nominees') => [
  body(`${prefix}.*.name`).notEmpty().withMessage('validation.required').trim().isLength({ max: 120 }),
  body(`${prefix}.*.relation`).notEmpty().withMessage('validation.required').trim().isLength({ max: 60 }),
  body(`${prefix}.*.nid`).notEmpty().withMessage('validation.required').trim().matches(/^\d{10}$|^\d{13}$|^\d{17}$/).withMessage('validation.nid'),
  body(`${prefix}.*.phone`).optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body(`${prefix}.*.percentage`).notEmpty().withMessage('validation.required').isFloat({ min: 0, max: 100 }).withMessage('validation.percentageRange').toFloat(),
];

const memberFields = (optional = false) => {
  const required = (chain) => (optional ? chain.optional() : chain.notEmpty().withMessage('validation.required'));

  return [
    required(body('fullName').trim()).isLength({ max: 160 }).withMessage('validation.maxLength'),
    optionalText(body('fullNameBn')),
    optionalText(body('fatherName')),
    optionalText(body('motherName')),
    optionalText(body('spouseName')),
    body('nid')
      .optional({ values: 'falsy' })
      .trim()
      .matches(/^\d{10}$|^\d{13}$|^\d{17}$/)
      .withMessage('validation.nid'),
    bdPhone(required(body('phone'))),
    body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('validation.email'),
    body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().withMessage('validation.date').toDate(),
    body('joinDate').optional({ values: 'falsy' }).isISO8601().withMessage('validation.date').toDate(),
    body('status').optional().isIn(MEMBER_STATUS_VALUES).withMessage('validation.enum'),
    body('shareCount').optional().isInt({ min: 0 }).withMessage('validation.integer').toInt(),
    optionalText(body('occupation'), 120),
    optionalText(body('notes'), 1000),
    optionalText(body('address.village'), 120),
    optionalText(body('address.postOffice'), 120),
    optionalText(body('address.upazila'), 120),
    optionalText(body('address.district'), 120),
    // Nominees validation - array of objects
    body('nominees').optional().isArray().withMessage('validation.nomineesArray'),
    ...nomineeFields('nominees'),
    // Custom validation: nominees percentage sum = 100
    body('nominees').custom((nominees) => {
      if (!nominees || nominees.length === 0) return true;
      const total = nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        throw new Error('validation.nomineesPercentageSum');
      }
      // Check duplicate NIDs
      const nids = nominees.map((n) => n.nid);
      if (new Set(nids).size !== nids.length) {
        throw new Error('validation.nomineesDuplicateNid');
      }
      return true;
    }),
  ];
};

export const createMemberRules = [
  ...memberFields(false),
  body('fullName').trim().notEmpty().withMessage('validation.required'),
];

export const updateMemberRules = [
  ...memberFields(true),
  param('id').isMongoId().withMessage('validation.identifier'),
];

export const listMemberRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(MEMBER_STATUS_VALUES).withMessage('validation.enum'),
  query('search').optional().trim(),
];

export const memberIdParam = [param('id').isMongoId().withMessage('validation.identifier')];
