import Role from '../models/Role.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { writeAudit } from '../utils/audit.js';
import { DEFAULT_SYSTEM_ROLES, ALL_PERMISSIONS, ROLES, STAFF_ROLES } from '../config/constants.js';

/** Check if actor has required permission */
function requirePermission(actor, permission) {
  if (!actor.permissions?.includes(permission)) {
    throw ApiError.forbidden(`Missing required permission: ${permission}`, 'FORBIDDEN');
  }
}

/** Check self-protection for super_admin */
function checkSelfProtection(actor, targetUserId, action) {
  if (actor._id.toString() === targetUserId.toString()) {
    throw ApiError.badRequest(`You cannot ${action} your own account.`, 'SELF_PROTECTION');
  }
}

/** Initialize default system roles on startup */
export async function initializeDefaultRoles() {
  for (const roleData of DEFAULT_SYSTEM_ROLES) {
    const existing = await Role.findOne({ name: roleData.name });
    if (!existing) {
      await Role.create({
        ...roleData,
        isSystemLocked: true,
      });
    } else if (existing.isSystemLocked) {
      // Ensure permissions are up to date for system roles
      existing.permissions = roleData.permissions;
      existing.description = roleData.description;
      await existing.save();
    }
  }
}

/** List all roles with user counts and permission counts */
export async function listRoles(query = {}) {
  const { page = 1, limit = 20, search } = query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const [roles, total] = await Promise.all([
    Role.find(filter)
      .sort({ isSystemLocked: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Role.countDocuments(filter),
  ]);

  // Populate user counts
  const rolesWithCounts = await Promise.all(
    roles.map(async (role) => {
      const userCount = await User.countDocuments({ role: role.name });
      return {
        ...role,
        userCount,
        permissionCount: role.permissions?.length || 0,
        totalPermissions: ALL_PERMISSIONS.length,
        type: role.isSystemLocked ? 'system_locked' : 'custom',
      };
    })
  );

  return {
    items: rolesWithCounts,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

/** Create a new custom role */
export async function createRole(payload, actor, req) {
  requirePermission(actor, 'roles.create');

  const { name, description, permissions = [] } = payload;

  const existing = await Role.findOne({ name });
  if (existing) {
    throw ApiError.conflict('A role with this name already exists.', 'ROLE_EXISTS');
  }

  const role = await Role.create({
    name,
    description,
    permissions,
    isSystemLocked: false,
    createdBy: actor._id,
    updatedBy: actor._id,
  });

  await writeAudit({
    actor: actor._id,
    action: 'role.created',
    entityType: 'Role',
    entityId: role._id,
    after: role,
    req,
  });

  return role.toJSON();
}

/** Update a role (permissions, name, description) */
export async function updateRole(roleId, payload, actor, req) {
  requirePermission(actor, 'roles.update');

  const role = await Role.findById(roleId);
  if (!role) {
    throw ApiError.notFound('Role not found.', 'ROLE_NOT_FOUND');
  }

  // Prevent modifying system-locked roles
  if (role.isSystemLocked) {
    throw ApiError.badRequest('Cannot modify system-locked roles.', 'SYSTEM_ROLE_PROTECTED');
  }

  // Prevent renaming to a system role name
  if (payload.name && payload.name !== role.name) {
    const reservedNames = ['super_admin', 'president', 'general_secretary', 'treasurer', 'member'];
    if (reservedNames.includes(payload.name)) {
      throw ApiError.badRequest('Cannot use reserved system role name.', 'RESERVED_NAME');
    }
    const existing = await Role.findOne({ name: payload.name });
    if (existing) {
      throw ApiError.conflict('A role with this name already exists.', 'ROLE_EXISTS');
    }
  }

  const oldPermissions = [...(role.permissions || [])];
  const oldName = role.name;
  const oldDescription = role.description;

  if (payload.name) role.name = payload.name;
  if (payload.description) role.description = payload.description;
  if (payload.permissions) role.permissions = payload.permissions;
  role.updatedBy = actor._id;

  await role.save();

  await writeAudit({
    actor: actor._id,
    action: 'role.updated',
    entityType: 'Role',
    entityId: role._id,
    before: {
      name: oldName,
      description: oldDescription,
      permissions: oldPermissions,
    },
    after: {
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    },
    req,
  });

  return role.toJSON();
}

/** Delete a custom role */
export async function deleteRole(roleId, actor, req) {
  requirePermission(actor, 'roles.delete');

  const role = await Role.findById(roleId);
  if (!role) {
    throw ApiError.notFound('Role not found.', 'ROLE_NOT_FOUND');
  }

  // Prevent deleting system-locked roles
  if (role.isSystemLocked) {
    throw ApiError.badRequest('Cannot delete system-locked roles.', 'SYSTEM_ROLE_PROTECTED');
  }

  // Check if any users are assigned this role
  const userCount = await User.countDocuments({ role: role.name });
  if (userCount > 0) {
    throw ApiError.badRequest(
      `Cannot delete role: ${userCount} user(s) are currently assigned to this role.`,
      'ROLE_IN_USE'
    );
  }

  await role.deleteOne();

  await writeAudit({
    actor: actor._id,
    action: 'role.deleted',
    entityType: 'Role',
    entityId: role._id,
    before: role,
    req,
  });

  return { success: true };
}

/** Get role by ID with full details */
export async function getRoleById(roleId) {
  const role = await Role.findById(roleId).lean();
  if (!role) {
    throw ApiError.notFound('Role not found.', 'ROLE_NOT_FOUND');
  }
  const userCount = await User.countDocuments({ role: role.name });
  return {
    ...role,
    userCount,
    permissionCount: role.permissions?.length || 0,
    totalPermissions: ALL_PERMISSIONS.length,
    type: role.isSystemLocked ? 'system_locked' : 'custom',
  };
}

export default {
  initializeDefaultRoles,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  getRoleById,
};