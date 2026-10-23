import { asyncHandler } from '../utils/asyncHandler.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import * as roleService from '../services/role.service.js';

export const listRoles = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const { items, total } = await roleService.listRoles({ page, limit, ...req.query });
  res.json({ success: true, data: { items, meta: paginationMeta(total, page, limit) } });
});

export const createRole = asyncHandler(async (req, res) => {
  const role = await roleService.createRole(req.body, req.user, req);
  res.status(201).json({ success: true, data: role });
});

export const getRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await roleService.getRoleById(id);
  res.json({ success: true, data: role });
});

export const updateRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = await roleService.updateRole(id, req.body, req.user, req);
  res.json({ success: true, data: role });
});

export const deleteRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await roleService.deleteRole(id, req.user, req);
  res.json({ success: true, data: { message: 'Role deleted successfully.' } });
});

export default { listRoles, createRole, getRole, updateRole, deleteRole };