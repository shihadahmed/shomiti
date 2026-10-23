import ApiError from '../utils/ApiError.js';

/** Rejects state-changing API calls that lack the X-Requested-With header. */
export function requireCustomHeader(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  if (req.get('x-requested-with') === 'XMLHttpRequest') return next();
  if (req.get('authorization')?.startsWith('Bearer ')) return next();

  return next(
    ApiError.forbidden('Missing X-Requested-With header.', 'CSRF_HEADER_REQUIRED'),
  );
}

export default requireCustomHeader;
