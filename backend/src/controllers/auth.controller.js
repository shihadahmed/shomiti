import config from '../config/env.js';
import { cookieOptions } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

function setSessionCookie(res, token) {
  res.cookie(config.jwt.cookieName, token, cookieOptions());
}

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const { user, token } = await authService.login(identifier, password, req);
  setSessionCookie(res, token);
  res.json({ success: true, data: { user, token } });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(config.jwt.cookieName, cookieOptions());
  res.json({ success: true, data: { message: 'Signed out.' } });
});

export const me = asyncHandler(async (req, res) => {
  // req.user already has photo attached by authenticate middleware
  const user = req.user.toJSON ? req.user.toJSON() : req.user;
  // Ensure photo is included (middleware attaches it as a property on the document)
  if (req.user.photo) user.photo = req.user.photo;
  res.json({ success: true, data: { user } });
});

export const setupPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.setupPassword(token, password, req);
  res.json({ success: true, data: result });
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  const result = await authService.requestPasswordReset(identifier, req);
  res.json({ success: true, data: result });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { user, token } = await authService.changePassword(req.user, req.body, req);
  setSessionCookie(res, token);
  res.json({ success: true, data: { user, token } });
});

export default {
  login,
  logout,
  me,
  setupPassword,
  requestPasswordReset,
  changePassword,
};
