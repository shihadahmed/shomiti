import { body } from 'express-validator';

const NID_PATTERN = /^\d{10}$|^\d{13}$|^\d{17}$/;

const optionalText = (path, max = 160) => body(path)
  .optional({ values: 'falsy' })
  .trim()
  .isLength({ max })
  .withMessage('validation.maxLength');

const bdPhone = (path, required = false) => {
  const chain = required
    ? body(path).notEmpty().withMessage('validation.phoneRequired')
    : body(path).optional({ values: 'falsy' });

  return chain
    .customSanitizer((value) => String(value || '').replace(/^\+?880/, '0').replace(/[\s-]/g, ''))
    .matches(/^01[3-9]\d{8}$/)
    .withMessage('validation.phone');
};

/** Cloudinary/CDN URLs only. Rejects javascript: and other unsafe schemes. */
const urlField = (path) => body(path)
  .optional({ values: 'falsy' })
  .trim()
  .isURL({ protocols: ['http', 'https'], require_protocol: true })
  .withMessage('validation.url')
  .isLength({ max: 500 })
  .withMessage('validation.maxLength');

const nomineeRules = [
  body('nominees.*._id').optional({ values: 'falsy' }).isMongoId().withMessage('validation.identifier'),
  body('nominees.*.name')
    .notEmpty()
    .withMessage('validation.nomineeNameRequired')
    .trim()
    .isLength({ max: 120 })
    .withMessage('validation.maxLength'),
  body('nominees.*.relation')
    .notEmpty()
    .withMessage('validation.nomineeRelationRequired')
    .trim()
    .isLength({ max: 60 })
    .withMessage('validation.maxLength'),
  body('nominees.*.nid')
    .notEmpty()
    .withMessage('validation.nomineeNidRequired')
    .trim()
    .matches(NID_PATTERN)
    .withMessage('validation.nomineeNidInvalid'),
  bdPhone('nominees.*.phone'),
  body('nominees.*.percentage')
    .notEmpty()
    .withMessage('validation.required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('validation.percentageRange')
    .toFloat(),
  urlField('nominees.*.photo'),
  urlField('nominees.*.nidDocument'),
];

export const kycSubmitRules = [
  body('fullName')
    .notEmpty()
    .withMessage('validation.fullNameRequired')
    .trim()
    .isLength({ min: 2, max: 160 })
    .withMessage('validation.maxLength'),
  optionalText('fullNameBn'),
  optionalText('fatherHusbandName'),
  optionalText('motherName'),
  body('nid')
    .notEmpty()
    .withMessage('validation.nidRequired')
    .trim()
    .matches(NID_PATTERN)
    .withMessage('validation.nidInvalid'),
  body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().withMessage('validation.date').toDate(),
  optionalText('occupation', 120),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('validation.email'),
  bdPhone('phone', true),
  body('presentAddress')
    .trim()
    .notEmpty()
    .withMessage('validation.presentAddressRequired')
    .isLength({ max: 500 })
    .withMessage('validation.maxLength'),
  optionalText('permanentAddress', 500),
  body('sameAsPresent').optional().isBoolean().withMessage('validation.boolean').toBoolean(),
  urlField('photo'),
  urlField('nidDocument'),
  body('nominees')
    .isArray({ min: 1 })
    .withMessage('validation.nomineesRequired'),
  ...nomineeRules,
  body('nominees').custom((nominees) => {
    if (!nominees || nominees.length === 0) return true;

    const total = nominees.reduce((sum, nominee) => sum + (Number(nominee.percentage) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error('validation.nomineesPercentageSum');
    }

    const nids = nominees.map((nominee) => String(nominee.nid || '').trim());
    if (new Set(nids).size !== nids.length) {
      throw new Error('validation.nomineesDuplicateNid');
    }
    return true;
  }),
  optionalText('notes', 1000),
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
