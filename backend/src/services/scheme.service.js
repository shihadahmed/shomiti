import mongoose from 'mongoose';
import SavingsScheme from '../models/SavingsScheme.js';
import SchemeEnrollment from '../models/SchemeEnrollment.js';
import Member from '../models/Member.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { nextDocNo } from '../utils/sequence.js';
import { writeAudit } from '../utils/audit.js';
import { BUSINESS_RULES, MEMBER_STATUS, SAVINGS_TYPES } from '../config/constants.js';

function assertObjectId(id, label) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label} id.`, 'INVALID_IDENTIFIER');
  }
}

/** Advances a date by the cadence of a fixed savings scheme. */
export function advanceDate(date, savingsType, periods = 1) {
  const next = new Date(date);
  if (savingsType === SAVINGS_TYPES.HALF_YEARLY) {
    next.setMonth(next.getMonth() + 6 * periods);
  } else {
    next.setMonth(next.getMonth() + periods);
  }
  return next;
}

export async function createScheme(payload, actor, req) {
  const requestedPrincipal = payload.principalPaisa
    ?? (payload.principal !== undefined ? Number(payload.principal) * 100 : 0);
  const principal = Math.round(Number.isFinite(Number(requestedPrincipal)) ? Number(requestedPrincipal) : 0);
  let principalPaisa = principal;
  if (payload.savingsType === SAVINGS_TYPES.MONTHLY) {
    principalPaisa = BUSINESS_RULES.MONTHLY_PRINCIPAL_PAISA;
  }
  if (payload.savingsType === SAVINGS_TYPES.HALF_YEARLY) {
    principalPaisa = BUSINESS_RULES.HALF_YEARLY_PRINCIPAL_PAISA;
  }

  const existing = await SavingsScheme.findOne({ savingsType: payload.savingsType });
  if (existing) {
    throw ApiError.conflict('A scheme for this savings type already exists.', 'SCHEME_EXISTS');
  }

  const scheme = await SavingsScheme.create({
    savingsType: payload.savingsType,
    name: payload.name,
    nameBn: payload.nameBn,
    description: payload.description,
    principalPaisa,
    lateFeePercent: payload.lateFeePercent ?? BUSINESS_RULES.LATE_FEE_PERCENT,
    isActive: payload.isActive !== false,
    createdBy: actor._id,
  });

  await writeAudit({
    actor: actor._id,
    action: 'scheme.created',
    entityType: 'SavingsScheme',
    entityId: scheme._id,
    after: scheme,
    req,
  });

  return scheme;
}

export async function listSchemes(query = {}) {
  const filter = {};
  if (query.active === 'true') filter.isActive = true;
  return SavingsScheme.find(filter).sort({ savingsType: 1 });
}

export async function updateScheme(id, payload, actor, req) {
  assertObjectId(id, 'scheme');
  const scheme = await SavingsScheme.findById(id);
  if (!scheme) throw ApiError.notFound('Scheme not found.', 'SCHEME_NOT_FOUND');

  const before = scheme.toObject();
  for (const field of ['name', 'nameBn', 'description', 'lateFeePercent', 'isActive']) {
    if (payload[field] !== undefined) scheme[field] = payload[field];
  }
  await scheme.save();

  await writeAudit({
    actor: actor._id,
    action: 'scheme.updated',
    entityType: 'SavingsScheme',
    entityId: scheme._id,
    before,
    after: scheme,
    req,
  });

  return scheme;
}

export async function enrollMember({ memberId, schemeId, startDate }, actor, req) {
  assertObjectId(memberId, 'member');
  assertObjectId(schemeId, 'scheme');

  const [member, scheme] = await Promise.all([
    Member.findById(memberId),
    SavingsScheme.findById(schemeId),
  ]);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');
  if (member.status !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.conflict('Only active members can enrol.', 'MEMBER_NOT_ACTIVE');
  }
  if (!scheme?.isActive) throw ApiError.conflict('This scheme is not active.', 'SCHEME_INACTIVE');

  const existing = await SchemeEnrollment.findOne({
    member: member._id,
    scheme: scheme._id,
    status: 'active',
  });
  if (existing) {
    throw ApiError.conflict('This member is already enrolled in the scheme.', 'ALREADY_ENROLLED');
  }

  const start = startDate ? new Date(startDate) : new Date();
  const enrollmentNo = await nextDocNo('ENR', 'scheme-enrollment');

  const enrollment = await SchemeEnrollment.create({
    enrollmentNo,
    member: member._id,
    scheme: scheme._id,
    startDate: start,
    nextDueDate: advanceDate(start, scheme.savingsType),
    maturityDate: advanceDate(start, scheme.savingsType, 12),
    createdBy: actor._id,
  });

  await writeAudit({
    actor: actor._id,
    action: 'scheme.enrolled',
    entityType: 'SchemeEnrollment',
    entityId: enrollment._id,
    after: enrollment,
    req,
  });

  return enrollment;
}

export async function listEnrollments(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.memberId) {
    assertObjectId(query.memberId, 'member');
    filter.member = query.memberId;
  }
  if (query.status) filter.status = query.status;
  if (query.due === 'overdue') {
    filter.status = 'active';
    filter.nextDueDate = { $lte: new Date() };
  }

  const [items, total] = await Promise.all([
    SchemeEnrollment.find(filter)
      .sort({ nextDueDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate('member', 'code fullName fullNameBn phone')
      .populate('scheme', 'savingsType name nameBn principalPaisa lateFeePercent'),
    SchemeEnrollment.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => ({
      ...item.toJSON(),
      isOverdue: item.status === 'active' && new Date(item.nextDueDate) < new Date(),
    })),
    meta: paginationMeta(total, page, limit),
  };
}

export async function getEnrollment(id) {
  assertObjectId(id, 'enrollment');
  const enrollment = await SchemeEnrollment.findById(id)
    .populate('member', 'code fullName phone')
    .populate('scheme');
  if (!enrollment) throw ApiError.notFound('Enrollment not found.', 'ENROLLMENT_NOT_FOUND');
  return enrollment;
}

export default {
  createScheme,
  listSchemes,
  updateScheme,
  enrollMember,
  listEnrollments,
  getEnrollment,
  advanceDate,
};
