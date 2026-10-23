import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * Converts express-validator failures into a single 422 response.
 * Validator messages are i18n keys (e.g. "validation.required") so the
 * bilingual client can translate them.
 */
export function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array({ onlyFirstError: true }).map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  return next(
    ApiError.unprocessable('Please correct the highlighted fields.', 'VALIDATION_ERROR', details),
  );
}

export default validate;
