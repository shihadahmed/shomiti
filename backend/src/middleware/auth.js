import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import config from '../config/env.js';

function extractToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return { token: header.slice(7).trim(), source: 'bearer' };
  }
  const cookieToken = req.cookies?.[config.jwt.cookieName];
  if (cookieToken) return { token: cookieToken, source: 'cookie' };
  return null;
}

/** Requires a valid session and attaches the active user to req.user. */
export async function authenticate(req, _res, next) {
  try {
    const extracted = extractToken(req);
    if (!extracted) throw ApiError.unauthorized('Please sign in to continue.', 'AUTH_REQUIRED');

    const payload = verifyAccessToken(extracted.token);
    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('This account is inactive or no longer exists.', 'ACCOUNT_INACTIVE');
    }
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
      throw ApiError.unauthorized('Session has been revoked. Please sign in again.', 'TOKEN_REVOKED');
    }

    req.user = user;
    req.authSource = extracted.source;
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches req.user when a valid token exists, but never rejects. */
export async function optionalAuthenticate(req, _res, next) {
  try {
    const extracted = extractToken(req);
    if (!extracted) return next();
    const payload = verifyAccessToken(extracted.token);
    const user = await User.findById(payload.sub);
    if (user?.isActive) {
      req.user = user;
      req.authSource = extracted.source;
    }
    return next();
  } catch {
    return next();
  }
}

export default authenticate;
