import config from '../config/env.js';
import { cookieOptions } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
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
  res.clearCookie(config.jwt.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true, data: { message: 'Signed out.' } });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

export const setupPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.setupPassword(token, password, req);
  res.json({ success: true, data: result });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { user, token } = await authService.changePassword(req.user, req.body, req);
  setSessionCookie(res, token);
  res.json({ success: true, data: { user, token } });
});

export const createStaff = asyncHandler(async (req, res) => {
  const result = await authService.createStaff(req.body, req.user, req);
  res.status(201).json({ success: true, data: result });
});

export const listStaff = asyncHandler(async (_req, res) => {
  const users = await authService.listStaff();
  res.json({ success: true, data: { items: users } });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 15 });
  const { items, total } = await authService.listUsers({ page, limit, ...req.query });
  res.json({ success: true, data: { items, meta: paginationMeta(total, page, limit) } });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  const user = await authService.updateUserRole(id, role, req.user, req);
  res.json({ success: true, data: { user } });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  const user = await authService.updateUserStatus(id, isActive, req.user, req);
  res.json({ success: true, data: { user } });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const result = await authService.resetUserPassword(id, password, req.user, req);
  res.json({ success: true, data: result });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const result = await authService.deleteUser(req.params.id, req.user, req);
  res.json({ success: true, data: result });
});

export const getUserMetrics = asyncHandler(async (_req, res) => {
  const metrics = await authService.getUserMetrics();
  res.json({ success: true, data: metrics });
});

export default { login, logout, me, setupPassword, changePassword, createStaff, listStaff, listUsers, updateUserRole, updateUserStatus, resetUserPassword, deleteUser, getUserMetrics };
