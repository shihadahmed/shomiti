import rateLimit from 'express-rate-limit';
import ApiError from '../utils/ApiError.js';

const handler = (_req, _res, next) => {
  next(ApiError.tooManyRequests('Too many attempts. Please try again later.', 'RATE_LIMITED'));
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
  skip: () => process.env.NODE_ENV === 'test',
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler,
  skip: () => process.env.NODE_ENV === 'test',
});

export const setupPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler,
  skip: () => process.env.NODE_ENV === 'test',
});

export default { globalLimiter, loginLimiter, setupPasswordLimiter };
