import mongoose from 'mongoose';
import Member from '../models/Member.js';
import SavingsAccount from '../models/SavingsAccount.js';
import SavingsTransaction from '../models/SavingsTransaction.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { nextDocNo } from '../utils/sequence.js';
import { writeAudit } from '../utils/audit.js';
import { MEMBER_STATUS, SAVINGS_ACCOUNT_TYPES } from '../config/constants.js';

const EDITABLE_FIELDS = [
  'fullName',
  'fullNameBn',
  'fatherName',
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

function assertObjectId(id, label = 'member') {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label} id.`, 'INVALID_IDENTIFIER');
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyEditableFields(member, payload) {
  for (const field of EDITABLE_FIELDS) {
    if (payload[field] !== undefined) member[field] = payload[field];
  }
  if (payload.address && typeof payload.address === 'object') {
    const current = member.address?.toObject?.() ?? member.address ?? {};
    member.address = { ...current, ...payload.address };
  }
  if (payload.nominees && Array.isArray(payload.nominees)) {
    member.nominees = payload.nominees.map((n) => ({
      name: n.name,
      relation: n.relation,
      nid: n.nid,
      phone: n.phone,
      percentage: Number(n.percentage),
      photo: n.photo,
    }));
  }
}

export async function createMember(payload, actor, req) {
  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      const joinDate = payload.joinDate ? new Date(payload.joinDate) : new Date();
      const code = await nextDocNo('SOM', 'member', { date: joinDate });
      const accountNo = await nextDocNo('SAV', 'savings-account', { date: joinDate });

      const nominees = Array.isArray(payload.nominees) ? payload.nominees.map((n) => ({
        name: n.name,
        relation: n.relation,
        nid: n.nid,
        phone: n.phone,
        percentage: Number(n.percentage),
      })) : [];

      const [member] = await Member.create(
        [
          {
            fullName: payload.fullName,
            fullNameBn: payload.fullNameBn,
            fatherName: payload.fatherName,
            motherName: payload.motherName,
            spouseName: payload.spouseName,
            nid: payload.nid,
            dateOfBirth: payload.dateOfBirth,
            phone: payload.phone,
            email: payload.email || undefined,
            address: payload.address || {},
            occupation: payload.occupation,
            joinDate,
            status: payload.status || MEMBER_STATUS.ACTIVE,
            shareCount: payload.shareCount ?? 0,
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

      await writeAudit({
        actor: actor._id,
        action: 'member.created',
        entityType: 'Member',
        entityId: member._id,
        after: member,
        req,
        session,
      });

      return { member, account };
    });

    return result;
  } finally {
    await session.endSession();
  }
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
      hasPhoto: Boolean(row.photo?.storedName),
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

  const before = member.toObject();
  member.photo = {
    storedName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
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
  if (!member?.photo?.storedName) {
    throw ApiError.notFound('No photo on file for this member.', 'PHOTO_NOT_FOUND');
  }
  return {
    storedName: member.photo.storedName,
    mimeType: member.photo.mimeType || 'application/octet-stream',
    originalName: member.photo.originalName || 'member-photo',
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
