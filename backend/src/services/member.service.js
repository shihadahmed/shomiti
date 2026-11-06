import mongoose from 'mongoose';
import Member from '../models/Member.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import SavingsAccount from '../models/SavingsAccount.js';
import SavingsTransaction from '../models/SavingsTransaction.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { nextDocNo } from '../utils/sequence.js';
import { writeAudit } from '../utils/audit.js';
import { hashPassword, createSetupToken } from '../utils/password.js';
import * as emailService from './email.service.js';
import { resetUserPassword, resendPasswordResetEmail } from './auth.service.js';
import { uploadToCloudinary } from '../middleware/upload.js';
import crypto from 'node:crypto';
import {
  MEMBER_STATUS,
  SAVINGS_ACCOUNT_TYPES,
  ROLES,
  ROLE_VALUES,
  USER_STATUS,
} from '../config/constants.js';

const EDITABLE_FIELDS = [
  'fullName',
  'fullNameBn',
  'fatherHusbandName',
  'motherName',
  'spouseName',
  'nid',
  'dateOfBirth',
  'phone',
  'email',
  'occupation',
  'joinDate',
  'status',
  'shareCount',
  'notes',
];

/** Roles that may be granted from the Members module. */
const ASSIGNABLE_SYSTEM_ROLES = ROLE_VALUES.filter((role) => role !== ROLES.SUPER_ADMIN);

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest('Invalid member id.', 'INVALID_IDENTIFIER');
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The subset of a User record exposed through the member APIs. */
function userSummary(user) {
  if (!user) return null;
  return {
    _id: user._id,
    role: user.role,
    isActive: user.isActive,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    mustChangePassword: user.mustChangePassword,
  };
}

function mapAddress(payload, field) {
  // Handle both structured address and fullAddress text
  if (!payload[field]) return {};
  const addr = payload[field];
  if (typeof addr === 'string') {
    return { fullAddress: addr };
  }
  return {
    village: addr.village,
    postOffice: addr.postOffice,
    upazila: addr.upazila,
    district: addr.district,
    fullAddress: addr.fullAddress,
  };
}

function mapDocument(payload, field) {
  if (!payload[field]) return '';
  const doc = payload[field];
  if (typeof doc === 'string') {
    return doc; // Return the Cloudinary URL directly
  }
  // Legacy object format - extract URL
  return doc.url || doc.dataUrl || '';
}

function applyEditableFields(member, payload) {
  for (const field of EDITABLE_FIELDS) {
    if (payload[field] !== undefined) member[field] = payload[field];
  }
  // Handle presentAddress
  if (payload.presentAddress !== undefined) {
    member.presentAddress = mapAddress(payload, 'presentAddress');
  }
  // Handle permanentAddress
  if (payload.permanentAddress !== undefined) {
    member.permanentAddress = mapAddress(payload, 'permanentAddress');
  }
  // Handle photo (Cloudinary URL string)
  if (payload.photo !== undefined) {
    member.photo = mapDocument(payload, 'photo');
  }
  // Handle nidDocument (Cloudinary URL string)
  if (payload.nidDocument !== undefined) {
    member.nidDocument = mapDocument(payload, 'nidDocument');
  }
  if (payload.nominees && Array.isArray(payload.nominees)) {
    member.nominees = payload.nominees.map((n) => ({
      name: n.name,
      relation: n.relation,
      fatherHusbandName: n.fatherHusbandName,
      nid: n.nid,
      dateOfBirth: n.dob || n.dateOfBirth,
      phone: n.phone,
      address: mapAddress(n, 'address'),
      percentage: Number(n.percentage),
      photo: mapDocument(n, 'photo'),
      nidDocument: mapDocument(n, 'nidDocument'),
    }));
  }
}

/**
 * Finds or creates the portal login linked to a Member.
 *
 * A member always owns exactly one login account. Linking also repairs legacy
 * rows where only one side of the Member.userId / User.memberId pair exists.
 */
async function ensureLinkedUser(member, { session, create = true } = {}) {
  const queryOptions = session ? { session } : {};
  const email = member.email ? String(member.email).toLowerCase() : undefined;

  if (member.userId) {
    let byIdQuery = User.findById(member.userId).select('+tokenVersion');
    if (session) byIdQuery = byIdQuery.session(session);
    const linked = await byIdQuery;
    if (linked) return { user: linked, created: false, inviteToken: undefined };
  }

  const or = [{ phone: member.phone }];
  if (email) or.push({ email });
  let existingQuery = User.findOne({ $or: or }).select('+tokenVersion');
  if (session) existingQuery = existingQuery.session(session);
  const existing = await existingQuery;

  if (existing) {
    if (existing.memberId && !existing.memberId.equals(member._id)) {
      throw ApiError.conflict(
        'This phone or email already belongs to another member account.',
        'USER_ALREADY_LINKED',
      );
    }
    if (!existing.memberId) {
      existing.memberId = member._id;
      await existing.save(queryOptions);
    }
    if (!member.userId || !member.userId.equals(existing._id)) {
      member.userId = existing._id;
      await member.save(queryOptions);
    }
    return { user: existing, created: false, inviteToken: undefined };
  }

  if (!create) return { user: null, created: false, inviteToken: undefined };

  const placeholderPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
  const setupToken = email ? createSetupToken() : null;

  const [createdUser] = await User.create(
    [
      {
        name: member.fullName,
        email,
        phone: member.phone,
        nid: member.nid,
        role: ROLES.MEMBER,
        memberId: member._id,
        passwordHash: placeholderPassword,
        resetPasswordToken: setupToken?.hash,
        resetPasswordExpires: setupToken?.expires,
        mustChangePassword: true,
        status: USER_STATUS.INVITED,
      },
    ],
    queryOptions,
  );

  member.userId = createdUser._id;
  await member.save(queryOptions);

  return {
    user: createdUser,
    created: true,
    inviteToken: setupToken?.raw,
  };
}

export async function createMember(payload, actor, req) {
  // New members are always ordinary members. Elevated roles are assigned from
  // the member profile after the account exists.
  if (payload.role && payload.role !== ROLES.MEMBER) {
    throw ApiError.badRequest(
      'New members are always created with the member role.',
      'ROLE_NOT_ALLOWED',
    );
  }

  const session = await mongoose.startSession();
  let outcome;

  try {
    outcome = await session.withTransaction(async () => {
      const joinDate = payload.joinDate ? new Date(payload.joinDate) : new Date();
      const code = await nextDocNo('SOM', 'member', { date: joinDate });
      const accountNo = await nextDocNo('SAV', 'savings-account', { date: joinDate });

      const nominees = Array.isArray(payload.nominees) ? payload.nominees.map((n) => ({
        name: n.name,
        relation: n.relation,
        fatherHusbandName: n.fatherHusbandName,
        nid: n.nid,
        dateOfBirth: n.dob || n.dateOfBirth,
        phone: n.phone,
        address: mapAddress(n, 'address'),
        percentage: Number(n.percentage),
        photo: mapDocument(n, 'photo'),
        nidDocument: mapDocument(n, 'nidDocument'),
      })) : [];

      const [member] = await Member.create(
        [
          {
            fullName: payload.fullName,
            fullNameBn: payload.fullNameBn,
            fatherHusbandName: payload.fatherHusbandName,
            motherName: payload.motherName,
            spouseName: payload.spouseName,
            nid: payload.nid,
            dateOfBirth: payload.dob || payload.dateOfBirth,
            phone: payload.phone,
            email: payload.email || undefined,
            presentAddress: mapAddress(payload, 'presentAddress'),
            permanentAddress: mapAddress(payload, 'permanentAddress'),
            occupation: payload.occupation,
            photo: mapDocument(payload, 'photo'),
            nidDocument: mapDocument(payload, 'nidDocument'),
            joinDate,
            status: payload.status || MEMBER_STATUS.ACTIVE,
            shareCount: payload.shareCount ?? 1,
            nominees,
            notes: payload.notes,
            code,
            createdBy: actor._id,
          },
        ],
        { session },
      );

      const [account] = await SavingsAccount.create(
        [
          {
            accountNo,
            member: member._id,
            type: SAVINGS_ACCOUNT_TYPES.GENERAL,
            createdBy: actor._id,
          },
        ],
        { session },
      );

      // Every member owns a login account, even when no email address was
      // supplied. Such accounts sign in by phone after a Super Admin issues a
      // temporary password from the member access panel.
      const linked = await ensureLinkedUser(member, { session });

      await writeAudit({
        actor: actor._id,
        action: 'member.created',
        entityType: 'Member',
        entityId: member._id,
        after: member,
        req,
        session,
      });

      return { member, account, ...linked };
    });
  } finally {
    await session.endSession();
  }

  // Emails are sent after the transaction commits: a slow SMTP server must never
  // hold the transaction (and its locks) open, and a mail failure must not roll
  // back a member that was created successfully.
  let emailSent = false;

  if (outcome.user && outcome.inviteToken && outcome.user.email) {
    try {
      await emailService.sendInviteEmail({
        to: outcome.user.email,
        name: outcome.user.name,
        token: outcome.inviteToken,
      });
      emailSent = true;
    } catch (emailError) {
      console.error('[Member Service] Failed to send welcome email:', emailError);
    }

    try {
      await emailService.sendProfileSubmittedEmail({
        to: outcome.user.email,
        name: outcome.user.name,
      });
    } catch (emailError) {
      console.error('[Member Service] Failed to send profile completion email:', emailError);
    }
  }

  return {
    member: outcome.member,
    account: outcome.account,
    user: outcome.user ? outcome.user.toJSON() : null,
    emailSent,
  };
}

export async function listMembers(query) {
  const { page, limit, skip } = getPagination(query);
  const match = {};

  if (query.status) match.status = query.status;
  if (query.search?.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    match.$or = [
      { fullName: regex },
      { fullNameBn: regex },
      { code: regex },
      { phone: regex },
      { nid: regex },
    ];
  }
  if (query.hasUser === 'true') {
    match.userId = { $ne: null };
  } else if (query.hasUser === 'false') {
    match.userId = null;
  }

  const [facet] = await Member.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'savingsaccounts',
              localField: '_id',
              foreignField: 'member',
              as: 'savingsAccounts',
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'linkedUser',
            },
          },
          {
            $unwind: {
              path: '$linkedUser',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              savingsBalancePaisa: { $sum: '$savingsAccounts.balancePaisa' },
              accountCount: { $size: '$savingsAccounts' },
              user: {
                $cond: [
                  { $ifNull: ['$linkedUser._id', false] },
                  {
                    _id: '$linkedUser._id',
                    role: '$linkedUser.role',
                    isActive: '$linkedUser.isActive',
                    status: '$linkedUser.status',
                    lastLoginAt: '$linkedUser.lastLoginAt',
                    mustChangePassword: '$linkedUser.mustChangePassword',
                  },
                  null,
                ],
              },
            },
          },
          { $project: { savingsAccounts: 0, linkedUser: 0 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const rows = facet?.rows || [];
  const total = facet?.total?.[0]?.count || 0;

  return {
    items: rows.map((row) => ({
      ...row,
      savingsBalance: Math.round(row.savingsBalancePaisa || 0) / 100,
      hasPhoto: Boolean(row.photo),
    })),
    meta: paginationMeta(total, page, limit),
  };
}

export async function getMemberById(id) {
  assertObjectId(id);
  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const [user, accounts, transactions] = await Promise.all([
    member.userId
      ? User.findById(member.userId).select('role isActive status lastLoginAt mustChangePassword')
      : null,
    SavingsAccount.find({ member: member._id }).sort({ createdAt: 1 }),
    SavingsTransaction.find({ member: member._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('account', 'accountNo type')
      .populate('postedBy', 'name'),
  ]);

  return {
    member: {
      ...member.toJSON(),
      savingsBalancePaisa: accounts.reduce((sum, account) => sum + (account.balancePaisa || 0), 0),
      savingsBalance: accounts.reduce((sum, account) => sum + (account.balancePaisa || 0), 0) / 100,
    },
    user: userSummary(user),
    accounts,
    transactions,
  };
}

export async function updateMember(id, payload, actor, req) {
  assertObjectId(id);
  if (payload.role !== undefined) {
    throw ApiError.badRequest(
      'Role changes must use the member role endpoint.',
      'ROLE_CHANGE_ENDPOINT_REQUIRED',
    );
  }

  const session = await mongoose.startSession();
  let updated;

  try {
    updated = await session.withTransaction(async () => {
      const member = await Member.findById(id).session(session);
      if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

      const before = member.toObject();
      applyEditableFields(member, payload);
      await member.save({ session });

      // Keep the login identity in sync with the member profile. Otherwise a
      // phone/email change would leave the member unable to sign in or receive
      // password-reset mail at the new address.
      if (member.userId) {
        const user = await User.findById(member.userId).session(session);
        if (user) {
          user.name = member.fullName;
          user.email = member.email ? String(member.email).toLowerCase() : undefined;
          user.phone = member.phone;
          user.nid = member.nid;
          await user.save({ session });
        }
      }

      await writeAudit({
        actor: actor._id,
        action: 'member.updated',
        entityType: 'Member',
        entityId: member._id,
        before,
        after: member,
        req,
        session,
      });

      return member;
    });
  } finally {
    await session.endSession();
  }

  return updated;
}

export async function setMemberPhoto(id, file, actor, req) {
  assertObjectId(id);
  if (!file) throw ApiError.badRequest('Please choose an image to upload.', 'FILE_REQUIRED');

  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  // multer is configured with memoryStorage, so there is no `file.filename` on
  // disk — the buffer has to be pushed to Cloudinary and its URL persisted.
  const uploaded = await uploadToCloudinary(file.buffer, {
    originalName: file.originalname,
    mimeType: file.mimetype,
    folder: 'shopnonir/members',
  });

  const before = member.toObject();
  member.photo = uploaded.secure_url;
  await member.save();

  await writeAudit({
    actor: actor._id,
    action: 'member.photo.updated',
    entityType: 'Member',
    entityId: member._id,
    before,
    after: member,
    req,
  });

  return member;
}

export async function getMemberPhoto(id) {
  assertObjectId(id);
  const member = await Member.findById(id).select('photo fullName');
  if (!member?.photo) {
    throw ApiError.notFound('No photo on file for this member.', 'PHOTO_NOT_FOUND');
  }
  return {
    // photo is now a string (Cloudinary URL)
    url: member.photo,
    mimeType: 'image/jpeg',
    originalName: `${member.fullName}-photo`,
  };
}

export async function deactivateMember(id, actor, req) {
  assertObjectId(id);
  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const { user } = await ensureLinkedUser(member, { create: false });

  if (user) {
    if (user.role === ROLES.SUPER_ADMIN) {
      throw ApiError.badRequest(
        'A Super Admin account cannot be deactivated from member management.',
        'SUPER_ADMIN_DELETE_FORBIDDEN',
      );
    }
    if (actor._id.toString() === user._id.toString()) {
      throw ApiError.badRequest('You cannot deactivate your own account.', 'SELF_DELETION_FORBIDDEN');
    }
  }

  const before = member.toObject();
  member.status = MEMBER_STATUS.RESIGNED;
  await member.save();

  if (user) {
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
  }

  await writeAudit({
    actor: actor._id,
    action: 'member.deactivated',
    entityType: 'Member',
    entityId: member._id,
    before,
    after: member,
    req,
  });

  return member;
}

export async function getMemberTransactions(id, query = {}) {
  assertObjectId(id);
  const { page, limit, skip } = getPagination(query);
  const filter = { member: id };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;

  const [items, total] = await Promise.all([
    SavingsTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('account', 'accountNo type')
      .populate('savingsDue', 'dueNo period')
      .populate('postedBy', 'name'),
    SavingsTransaction.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getMemberOptions(query = {}) {
  const match = { status: MEMBER_STATUS.ACTIVE };
  if (query.search?.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    match.$or = [{ fullName: regex }, { code: regex }, { phone: regex }];
  }
  return Member.find(match)
    .select('code fullName fullNameBn phone')
    .sort({ fullName: 1 })
    .limit(50);
}

export async function updateMemberRole(id, newRole, actor, req) {
  assertObjectId(id);

  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin can change member roles.', 'ROLE_ASSIGNMENT_FORBIDDEN');
  }
  if (newRole === ROLES.SUPER_ADMIN) {
    throw ApiError.badRequest(
      'Super Admin cannot be assigned through member management.',
      'SUPER_ADMIN_ASSIGNMENT_FORBIDDEN',
    );
  }

  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const { user } = await ensureLinkedUser(member);

  if (actor._id.toString() === user._id.toString()) {
    throw ApiError.badRequest('You cannot change your own role.', 'SELF_DEMOTION_FORBIDDEN');
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    throw ApiError.badRequest(
      'Super Admin roles are managed outside member management.',
      'SUPER_ADMIN_ROLE_IMMUTABLE',
    );
  }

  // Custom roles must exist; the built-in system roles are always valid.
  if (!ASSIGNABLE_SYSTEM_ROLES.includes(newRole)) {
    const roleExists = await Role.findOne({ name: newRole });
    if (!roleExists) {
      throw ApiError.badRequest('Role does not exist.', 'ROLE_NOT_FOUND');
    }
  }

  const oldRole = user.role;
  user.role = newRole;
  await user.save();

  await writeAudit({
    actor: actor._id,
    action: 'member.role_changed',
    entityType: 'Member',
    entityId: member._id,
    before: { role: oldRole },
    after: { role: newRole },
    req,
  });

  return { member: member.toJSON(), user: userSummary(user) };
}

export async function updateMemberAccountStatus(id, isActive, actor, req) {
  assertObjectId(id);

  if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden(
      'Only Super Admin can change portal access.',
      'ACCOUNT_STATUS_FORBIDDEN',
    );
  }

  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const { user } = await ensureLinkedUser(member);

  if (!isActive && actor._id.toString() === user._id.toString()) {
    throw ApiError.badRequest('You cannot disable your own account.', 'SELF_SUSPENSION_FORBIDDEN');
  }

  if (!isActive && user.role === ROLES.SUPER_ADMIN) {
    const activeSuperAdmins = await User.countDocuments({
      role: ROLES.SUPER_ADMIN,
      isActive: true,
    });
    if (activeSuperAdmins <= 1) {
      throw ApiError.badRequest(
        'Cannot disable the last active Super Admin. At least one active Super Admin must exist.',
        'LAST_SUPER_ADMIN_PROTECTION',
      );
    }
  }

  const before = user.isActive;
  user.isActive = Boolean(isActive);
  if (!user.isActive) {
    user.tokenVersion = (user.tokenVersion || 0) + 1;
  }
  await user.save();

  await writeAudit({
    actor: actor._id,
    action: 'member.account_status_changed',
    entityType: 'Member',
    entityId: member._id,
    before: { isActive: before },
    after: { isActive: user.isActive },
    req,
  });

  return { member: member.toJSON(), user: userSummary(user) };
}

export async function sendMemberPasswordResetEmail(id, actor, req) {
  assertObjectId(id);

  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const { user } = await ensureLinkedUser(member);
  return resendPasswordResetEmail(user._id.toString(), actor, req);
}

export async function resetMemberPassword(id, actor, req) {
  assertObjectId(id);

  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const { user } = await ensureLinkedUser(member);
  return resetUserPassword(user._id.toString(), undefined, actor, req);
}

export default {
  createMember,
  listMembers,
  getMemberById,
  updateMember,
  setMemberPhoto,
  getMemberPhoto,
  deactivateMember,
  getMemberTransactions,
  getMemberOptions,
  updateMemberRole,
  updateMemberAccountStatus,
  sendMemberPasswordResetEmail,
  resetMemberPassword,
};
