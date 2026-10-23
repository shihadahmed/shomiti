import mongoose from 'mongoose';
import ApprovalRequest from '../models/ApprovalRequest.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { writeAudit } from '../utils/audit.js';
import { APPROVAL_STATUS } from '../config/constants.js';

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest('Invalid approval id.', 'INVALID_IDENTIFIER');
  }
}

export async function listApprovals(query = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 20 });
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.mine === 'true' && query.userId) filter.requestedBy = query.userId;

  const [items, total] = await Promise.all([
    ApprovalRequest.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('requestedBy', 'name role')
      .populate('approvals.user', 'name role'),
    ApprovalRequest.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getApprovalById(id) {
  assertObjectId(id);
  const approval = await ApprovalRequest.findById(id)
    .populate('requestedBy', 'name role')
    .populate('approvals.user', 'name role');
  if (!approval) throw ApiError.notFound('Approval request not found.', 'APPROVAL_NOT_FOUND');
  return approval;
}

/**
 * Records a dual-control decision. A request is only fully approved once it
 * reaches `requiredApprovals`; any rejection closes it immediately.
 */
export async function decideApproval(id, { decision, note }, actor, req) {
  assertObjectId(id);
  const session = await mongoose.startSession();

  try {
    const request = await session.withTransaction(async () => {
      const doc = await ApprovalRequest.findById(id).session(session);
      if (!doc) throw ApiError.notFound('Approval request not found.', 'APPROVAL_NOT_FOUND');
      if (doc.status !== APPROVAL_STATUS.PENDING) {
        throw ApiError.conflict('This request has already been decided.', 'APPROVAL_ALREADY_DECIDED');
      }
      if (String(doc.requestedBy) === String(actor._id)) {
        throw ApiError.forbidden(
          'You cannot decide on your own request.',
          'SELF_APPROVAL_NOT_ALLOWED',
        );
      }
      if ((doc.approvals || []).some((entry) => String(entry.user) === String(actor._id))) {
        throw ApiError.conflict('You have already decided on this request.', 'ALREADY_DECIDED');
      }

      doc.approvals.push({
        user: actor._id,
        decision,
        note: note?.trim().slice(0, 500),
        at: new Date(),
      });

      if (decision === 'rejected') {
        doc.status = APPROVAL_STATUS.REJECTED;
        doc.decidedAt = new Date();
      } else {
        const approvedCount = doc.approvals.filter((entry) => entry.decision === 'approved').length;
        if (approvedCount >= doc.requiredApprovals) {
          doc.status = APPROVAL_STATUS.APPROVED;
          doc.decidedAt = new Date();
        }
      }

      await doc.save({ session });

      await writeAudit({
        actor: actor._id,
        action: `approval.${decision}`,
        entityType: 'ApprovalRequest',
        entityId: doc._id,
        after: doc,
        req,
        session,
      });

      return doc;
    });

    return ApprovalRequest.findById(request._id)
      .populate('requestedBy', 'name role')
      .populate('approvals.user', 'name role');
  } finally {
    await session.endSession();
  }
}

export async function cancelApproval(id, actor, req) {
  assertObjectId(id);
  const session = await mongoose.startSession();

  try {
    const request = await session.withTransaction(async () => {
      const doc = await ApprovalRequest.findById(id).session(session);
      if (!doc) throw ApiError.notFound('Approval request not found.', 'APPROVAL_NOT_FOUND');
      if (doc.status !== APPROVAL_STATUS.PENDING) {
        throw ApiError.conflict('Only pending requests can be cancelled.', 'APPROVAL_NOT_PENDING');
      }
      if (String(doc.requestedBy) !== String(actor._id) && actor.role !== 'super_admin') {
        throw ApiError.forbidden('Only the requester can cancel this request.', 'CANCEL_NOT_ALLOWED');
      }

      doc.status = APPROVAL_STATUS.CANCELLED;
      doc.decidedAt = new Date();
      await doc.save({ session });

      await writeAudit({
        actor: actor._id,
        action: 'approval.cancelled',
        entityType: 'ApprovalRequest',
        entityId: doc._id,
        after: doc,
        req,
        session,
      });

      return doc;
    });

    return request;
  } finally {
    await session.endSession();
  }
}

export async function countPendingApprovals() {
  return ApprovalRequest.countDocuments({ status: APPROVAL_STATUS.PENDING });
}

export default {
  listApprovals,
  getApprovalById,
  decideApproval,
  cancelApproval,
  countPendingApprovals,
};