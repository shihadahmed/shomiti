import mongoose from 'mongoose';
import Member from '../models/Member.js';
import User from '../models/User.js';
import SavingsAccount from '../models/SavingsAccount.js';
import SavingsTransaction from '../models/SavingsTransaction.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { nextDocNo } from '../utils/sequence.js';
import { writeAudit } from '../utils/audit.js';
import { hashPassword, createSetupToken } from '../utils/password.js';
import * as emailService from './email.service.js';
import { uploadToCloudinary } from '../middleware/upload.js';
import crypto from 'node:crypto';
import { MEMBER_STATUS, SAVINGS_ACCOUNT_TYPES, ROLES, USER_STATUS } from '../config/constants.js';

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

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest('Invalid member id.', 'INVALID_IDENTIFIER');
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

export async function createMember(payload, actor, req) {
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

      // Create User account for member portal access if email is provided
      let user = null;
      let inviteToken = null;

      if (payload.email) {
        // Check if user already exists with this email or phone
        const existingUser = await User.findOne({
          $or: [{ email: payload.email.toLowerCase() }, { phone: payload.phone }],
        }).session(session);

        if (!existingUser) {
          const { raw: rawToken, hash: tokenHash, expires: tokenExpires } = createSetupToken();
          const placeholderPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));

          // `Model.create([doc])` resolves to an array — destructure it, otherwise
          // `user.email` / `user.name` are undefined and the invite never sends.
          const [createdUser] = await User.create(
            [
              {
                name: payload.fullName,
                email: payload.email.toLowerCase(),
                phone: payload.phone,
                nid: payload.nid,
                role: ROLES.MEMBER,
                memberId: member._id,
                passwordHash: placeholderPassword,
                resetPasswordToken: tokenHash,
                resetPasswordExpires: tokenExpires,
                mustChangePassword: true,
                status: USER_STATUS.INVITED,
              },
            ],
            { session },
          );

          user = createdUser;
          inviteToken = rawToken;
          
          // Update member with userId
          member.userId = user._id;
          await member.save({ session });
        }
      }

      await writeAudit({
        actor: actor._id,
        action: 'member.created',
        entityType: 'Member',
        entityId: member._id,
        after: member,
        req,
        session,
      });

      return { member, account, user, inviteToken };
    });
  } finally {
    await session.endSession();
  }

  // Emails are sent after the transaction commits: a slow SMTP server must never
  // hold the transaction (and its locks) open, and a mail failure must not roll
  // back a member that was created successfully.
  let emailSent = false;

  if (outcome.user && outcome.inviteToken) {
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
    user: outcome.user,
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
            $addFields: {
              savingsBalancePaisa: { $sum: '$savingsAccounts.balancePaisa' },
              accountCount: { $size: '$savingsAccounts' },
            },
          },
          { $project: { savingsAccounts: 0 } },
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

  const [accounts, transactions] = await Promise.all([
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
    accounts,
    transactions,
  };
}

export async function updateMember(id, payload, actor, req) {
  assertObjectId(id);
  const member = await Member.findById(id);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const before = member.toObject();
  applyEditableFields(member, payload);
  await member.save();

  await writeAudit({
    actor: actor._id,
    action: 'member.updated',
    entityType: 'Member',
    entityId: member._id,
    before,
    after: member,
    req,
  });

  return member;
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

  const before = member.toObject();
  member.status = MEMBER_STATUS.RESIGNED;
  await member.save();

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
};
