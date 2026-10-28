import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import ApiError from './ApiError.js';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      name: user.name,
      tv: user.tokenVersion || 0,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, issuer: 'shomiti' },
  );
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret, { issuer: 'shomiti' });
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.', 'TOKEN_INVALID');
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax',
  path: '/',
});
