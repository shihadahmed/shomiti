import User from '../models/User.js';
import Member from '../models/Member.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword, generateTemporaryPassword, createSetupToken, hashToken } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';
import { writeAudit } from '../utils/audit.js';
import { ROLES, USER_STATUS } from '../config/constants.js';
import * as emailService from './email.service.js';

/** Attach profile photo to user object from profileData or Member record */
async function attachProfilePhoto(user) {
  const userObj = user.toJSON ? user.toJSON() : user;
  if (user.profileData?.photo) {
    userObj.photo = user.profileData.photo;
  } else if (user.memberId) {
    const member = await Member.findById(user.memberId).select('photo').lean();
    if (member?.photo) {
      userObj.photo = member.photo;
    }
  }
  return userObj;
}

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
  const userWithPhoto = await attachProfilePhoto(user);
  return { user: userWithPhoto, token };
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

/**
 * Internal helper used by the Member access module. There is intentionally no
 * HTTP route of its own: account credentials are always managed through a
 * Member record.
 */
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

export async function requestPasswordReset(identifier, req) {
  const value = String(identifier || '').trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: value }, { phone: value }],
    isActive: true,
  });

  // Always return success to prevent user enumeration
  if (!user || !user.email) {
    return { emailSent: true };
  }

  const { raw: rawToken, hash: tokenHash, expires: tokenExpires } = createSetupToken();

  user.resetPasswordToken = tokenHash;
  user.resetPasswordExpires = tokenExpires;
  await user.save();

  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    await writeAudit({
      actor: user._id,
      action: 'user.password_reset_requested',
      entityType: 'User',
      entityId: user._id,
      req,
    });

    return { emailSent: true };
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

/**
 * Internal helper used by the Member access module. There is intentionally no
 * HTTP route of its own: account credentials are always managed through a
 * Member record.
 */
export async function resendPasswordResetEmail(userId, actor, req) {
  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin can resend password reset emails.', 'PASSWORD_RESET_RESEND_FORBIDDEN');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found.', 'USER_NOT_FOUND');
  }

  if (!user.email) {
    throw ApiError.badRequest('User has no email address on file.', 'NO_EMAIL_ON_FILE');
  }

  const { raw: rawToken, hash: tokenHash, expires: tokenExpires } = createSetupToken();

  user.resetPasswordToken = tokenHash;
  user.resetPasswordExpires = tokenExpires;
  await user.save();

  try {
    await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token: rawToken,
    });

    await writeAudit({
      actor: actor._id,
      action: 'user.password_reset_resent',
      entityType: 'User',
      entityId: user._id,
      req,
    });

    return { emailSent: true };
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    throw new Error(`Failed to resend password reset email: ${error.message}`);
  }
}

export async function setupPassword(token, newPassword, req) {
  const hashedToken = hashToken(token);

  const user = await User.findOneAndUpdate(
    {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
      isActive: true,
    },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        passwordChangedAt: new Date(),
        status: USER_STATUS.PENDING_KYC,
        mustChangePassword: false,
      },
      $inc: { tokenVersion: 1 },
      $unset: {
        resetPasswordToken: '',
        resetPasswordExpires: '',
      },
    },
    { returnDocument: 'after' }
  );

  if (!user) {
    throw ApiError.badRequest('The setup link is invalid or has expired.', 'INVALID_SETUP_TOKEN');
  }

  await writeAudit({
    actor: user._id,
    action: 'user.password_setup',
    entityType: 'User',
    entityId: user._id,
    req,
  });

  return {
    user: user.toJSON(),
  };
}

export default {
  login,
  changePassword,
  resetUserPassword,
  requestPasswordReset,
  resendPasswordResetEmail,
  setupPassword,
};
