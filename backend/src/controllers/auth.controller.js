import config from '../config/env.js';
import User from '../models/User.js';
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
  const user = req.user.toJSON ? req.user.toJSON() : { ...req.user };
  // Permissions are derived from the Role document by the authenticate middleware.
  // They are not schema paths, so they must be copied onto the serialisable object.
  user.permissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
  // Ensure photo is included (middleware attaches it as a property on the document)
  if (req.user.photo) user.photo = req.user.photo;
  res.json({ success: true, data: { user } });
});

export const updateLanguage = asyncHandler(async (req, res) => {
  const { language } = req.body;
  if (!['bn', 'en'].includes(language)) {
    return res.status(400).json({ success: false, message: 'Invalid language' });
  }
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { language },
    { new: true, select: '-passwordHash -tokenVersion -resetPasswordToken -resetPasswordExpires' }
  );
  
  const userData = user.toJSON ? user.toJSON() : { ...user };
  userData.permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (user.photo) userData.photo = user.photo;
  
  res.json({ success: true, data: { user: userData } });
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
