import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword, verifyPassword, generateTemporaryPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { writeAudit } from '../utils/audit.js';
import { ROLES, ROLE_VALUES, STAFF_ROLES, EXECUTIVE_ROLES } from '../config/constants.js';

const STAFF_CREATABLE_ROLES = [ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT, ROLES.MEMBER];

export async function login(identifier, password, req) {
  const value = String(identifier || '').trim();
  const user = await User.findOne({
    $or: [{ email: value.toLowerCase() }, { phone: value }],
  }).select('+passwordHash +tokenVersion');

  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('The credentials you entered are incorrect.', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated.', 'ACCOUNT_INACTIVE');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await writeAudit({
    actor: user._id,
    action: 'auth.login',
    entityType: 'User',
    entityId: user._id,
    req,
  });

  const token = signAccessToken(user);
  return { user: user.toJSON(), token };
}

export async function changePassword(user, { currentPassword, newPassword }, req) {
  const record = await User.findById(user._id).select('+passwordHash +tokenVersion');
  if (!record) throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');

  if (!(await record.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect.', 'CURRENT_PASSWORD_INVALID');
  }
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('The new password must be different.', 'PASSWORD_UNCHANGED');
  }

  record.passwordHash = await hashPassword(newPassword);
  record.passwordChangedAt = new Date();
  record.tokenVersion = (record.tokenVersion || 0) + 1;
  record.mustChangePassword = false;
  await record.save();

  await writeAudit({
    actor: record._id,
    action: 'auth.password_changed',
    entityType: 'User',
    entityId: record._id,
    req,
  });

  const token = signAccessToken(record);
  return { user: record.toJSON(), token };
}

export async function createStaff(payload, actor, req) {
  if (!STAFF_CREATABLE_ROLES.includes(payload.role)) {
    throw ApiError.badRequest('This role cannot be created here.', 'ROLE_NOT_ALLOWED');
  }
  if (payload.role === ROLES.MEMBER && !payload.memberId) {
    throw ApiError.badRequest('A member portal account needs a linked member.', 'MEMBER_REQUIRED');
  }

  const password = payload.password || generateTemporaryPassword();
  const user = await User.create({
    name: payload.name,
    email: payload.email || undefined,
    phone: payload.phone,
    role: payload.role,
    member: payload.memberId || undefined,
    passwordHash: await hashPassword(password),
    mustChangePassword: !payload.password,
  });

  await writeAudit({
    actor: actor._id,
    action: 'user.created',
    entityType: 'User',
    entityId: user._id,
    after: user,
    req,
  });

  return {
    user: user.toJSON(),
    temporaryPassword: payload.password ? undefined : password,
  };
}

export async function listUsers(query = {}) {
  const { page = 1, limit = 15, role, status, search } = query;
  const skip = (page - 1) * limit;

  const filter = {};
  if (role) filter.role = role;
  if (status) filter.isActive = status === 'active';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name email phone role isActive lastLoginAt createdAt member')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('member', 'name code'),
    User.countDocuments(filter),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

/** Assign a new role to a user — requires roles.assign permission */
export async function updateUserRole(userId, newRole, actor, req) {
  // Check for roles.assign permission
  if (!actor.permissions?.includes('roles.assign')) {
    throw ApiError.forbidden('Missing required permission: roles.assign', 'ROLE_ASSIGNMENT_FORBIDDEN');
  }

  // Prevent self-role-change
  if (actor._id.toString() === userId) {
    throw ApiError.badRequest('You cannot change your own role.', 'SELF_DEMOTION_FORBIDDEN');
  }

  // Only super_admin can assign executive roles (stricter than just permission check)
  if (EXECUTIVE_ROLES.includes(newRole) && actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin can assign executive roles.', 'EXECUTIVE_ROLE_RESTRICTED');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
  }

  // Prevent deactivating/removing the last active super_admin
  if (user.role === ROLES.SUPER_ADMIN && newRole !== ROLES.SUPER_ADMIN) {
    const activeSuperAdmins = await User.countDocuments({
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });
    if (activeSuperAdmins <= 1) {
      throw ApiError.badRequest(
        'Cannot demote the last active Super Admin. At least one active Super Admin must exist.',
        'LAST_SUPER_ADMIN_PROTECTION'
      );
    }
  }

  // Prevent deactivating the last active super_admin via status change
  if (user.role === ROLES.SUPER_ADMIN && !user.isActive) {
    const activeSuperAdmins = await User.countDocuments({
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });
    if (activeSuperAdmins <= 1) {
      throw ApiError.badRequest(
        'Cannot deactivate the last active Super Admin. At least one active Super Admin must exist.',
        'LAST_SUPER_ADMIN_PROTECTION'
      );
    }
  }

  const oldRole = user.role;
  user.role = newRole;
  await user.save();

  await writeAudit({
    actor: actor._id,
    action: 'user.role_changed',
    entityType: 'User',
    entityId: user._id,
    before: { role: oldRole, permissions: user.permissions || [] },
    after: { role: newRole, permissions: user.permissions || [] },
    req,
  });

  return user.toJSON();
}

export async function updateUserStatus(userId, isActive, actor, req) {
  // Check for roles.assign permission (reusing for status changes of staff)
  if (!actor.permissions?.includes('roles.assign')) {
    throw ApiError.forbidden('Missing required permission: roles.assign', 'STATUS_CHANGE_FORBIDDEN');
  }

  // Prevent self-suspension
  if (actor._id.toString() === userId && !isActive) {
    throw ApiError.badRequest('You cannot suspend your own account.', 'SELF_SUSPENSION_FORBIDDEN');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
  }

  // Prevent deactivating the last active super_admin
  if (user.role === ROLES.SUPER_ADMIN && isActive === false) {
    const activeSuperAdmins = await User.countDocuments({
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });
    if (activeSuperAdmins <= 1) {
      throw ApiError.badRequest(
        'Cannot deactivate the last active Super Admin. At least one active Super Admin must exist.',
        'LAST_SUPER_ADMIN_PROTECTION'
      );
    }
  }

  const oldStatus = user.isActive;
  user.isActive = isActive;
  await user.save();

  await writeAudit({
    actor: actor._id,
    action: 'user.status_changed',
    entityType: 'User',
    entityId: user._id,
    before: { isActive: oldStatus },
    after: { isActive },
    req,
  });

  return user.toJSON();
}

export async function resetUserPassword(userId, newPassword, actor, req) {
  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin can reset passwords.', 'PASSWORD_RESET_FORBIDDEN');
  }

  const user = await User.findById(userId).select('+passwordHash +tokenVersion');
  if (!user) {
    throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
  }

  const password = newPassword || generateTemporaryPassword();
  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.mustChangePassword = !newPassword;
  await user.save();

  await writeAudit({
    actor: actor._id,
    action: 'user.password_reset',
    entityType: 'User',
    entityId: user._id,
    req,
  });

  return {
    user: user.toJSON(),
    temporaryPassword: newPassword ? undefined : password,
  };
}

export async function listStaff() {
  return User.find({ role: { $in: ROLE_VALUES.filter((role) => role !== ROLES.MEMBER) } })
    .select('name email phone role isActive lastLoginAt createdAt member')
    .sort({ createdAt: 1 });
}

export async function getUserMetrics() {
  const [totalUsers, executiveLeaders, activeMembers, inactiveAccounts] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: { $in: ['super_admin', 'president', 'general_secretary', 'treasurer'] } }),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: false }),
  ]);

  return {
    totalUsers,
    executiveLeaders,
    activeMembers,
    inactiveAccounts,
  };
}

export default {
  login,
  changePassword,
  createStaff,
  listStaff,
  listUsers,
  updateUserRole,
  updateUserStatus,
  resetUserPassword,
  getUserMetrics,
};
