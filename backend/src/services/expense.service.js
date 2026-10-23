import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Payment from '../models/Payment.js';
import SavingsAccount from '../models/SavingsAccount.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { nextDocNo } from '../utils/sequence.js';
import { writeAudit } from '../utils/audit.js';
import { toPaisa } from '../utils/money.js';
import {
  ACCOUNT_CODES,
  PAYMENT_METHOD_ACCOUNTS,
  PAYMENT_STATUS,
  TRANSACTION_STATUS,
  TRANSACTION_TYPES,
  EXPENSE_STATUS,
  EXPENSE_STATUS_ORDER,
  EXPENSE_APPROVAL_ROLES,
  ROLES,
} from '../config/constants.js';
import { postJournal } from './ledger.service.js';

const DHAKA_TZ = 'Asia/Dhaka';

function nowInDhaka() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: DHAKA_TZ }));
}

function assertObjectId(id, label) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label} id.`, 'INVALID_IDENTIFIER');
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function getNextStatus(currentStatus) {
  const idx = EXPENSE_STATUS_ORDER.indexOf(currentStatus);
  if (idx >= 0 && idx < EXPENSE_STATUS_ORDER.length - 1) {
    return EXPENSE_STATUS_ORDER[idx + 1];
  }
  return null;
}

function getRequiredApproverRole(status) {
  const roleMap = {
    [EXPENSE_STATUS.PENDING_TREASURER]: ROLES.TREASURER,
    [EXPENSE_STATUS.PENDING_GS]: ROLES.GENERAL_SECRETARY,
    [EXPENSE_STATUS.PENDING_PRESIDENT]: ROLES.PRESIDENT,
  };
  return roleMap[status] || null;
}

function canUserApprove(user, status) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  const requiredRole = getRequiredApproverRole(status);
  return user.role === requiredRole;
}

export async function createExpense(payload, actor, req) {
  const amountPaisa = toPaisa(payload.amount);
  if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0) {
    throw ApiError.badRequest('Amount must be a positive value.', 'AMOUNT_INVALID');
  }

  const expenseNo = await nextDocNo('EXP', 'expense');
  const expense = await Expense.create({
    expenseNo,
    title: payload.title,
    category: payload.category,
    amountPaisa,
    payee: payload.payee,
    paymentMethod: payload.paymentMethod || 'cash',
    description: payload.description,
    attachment: payload.attachment,
    status: EXPENSE_STATUS.DRAFT,
    createdBy: actor._id,
  });

  await writeAudit({
    actor: actor._id,
    action: 'expense.created',
    entityType: 'Expense',
    entityId: expense._id,
    after: expense,
    req,
  });

  return expense;
}

export async function submitExpense(expenseId, actor, req) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');
  if (expense.status !== EXPENSE_STATUS.DRAFT) {
    throw ApiError.conflict('Only draft expenses can be submitted.', 'EXPENSE_NOT_DRAFT');
  }

  expense.status = EXPENSE_STATUS.PENDING_TREASURER;
  expense.currentApproverRole = ROLES.TREASURER;
  await expense.save();

  await writeAudit({
    actor: actor._id,
    action: 'expense.submitted',
    entityType: 'Expense',
    entityId: expense._id,
    after: expense,
    req,
  });

  return expense;
}

export async function approveExpense(expenseId, { comment }, actor, req) {
  const session = await mongoose.startSession();

  try {
    const expense = await session.withTransaction(async () => {
      const exp = await Expense.findById(expenseId).session(session);
      if (!exp) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');
      if (exp.status === EXPENSE_STATUS.APPROVED) {
        throw ApiError.conflict('Expense already approved.', 'EXPENSE_ALREADY_APPROVED');
      }
      if (exp.status === EXPENSE_STATUS.REJECTED) {
        throw ApiError.conflict('Expense has been rejected.', 'EXPENSE_REJECTED');
      }
      if (![EXPENSE_STATUS.PENDING_TREASURER, EXPENSE_STATUS.PENDING_GS, EXPENSE_STATUS.PENDING_PRESIDENT].includes(exp.status)) {
        throw ApiError.conflict('Submit this draft before approving it.', 'EXPENSE_NOT_PENDING');
      }
      if (!canUserApprove(actor, exp.status)) {
        throw ApiError.forbidden('You are not authorized to approve at this stage.', 'NOT_AUTHORIZED_APPROVER');
      }
      if (String(exp.createdBy) === String(actor._id)) {
        throw ApiError.forbidden('You cannot approve your own expense.', 'SELF_APPROVAL_NOT_ALLOWED');
      }

      exp.approvals.push({
        role: actor.role,
        user: actor._id,
        decision: 'approved',
        comment: comment?.slice(0, 500),
        at: nowInDhaka(),
      });

      const nextStatus = getNextStatus(exp.status);
      if (nextStatus === EXPENSE_STATUS.APPROVED) {
        exp.status = EXPENSE_STATUS.APPROVED;
        exp.currentApproverRole = null;
        // Post to ledger
        await postExpenseToLedger(exp, actor, session);
      } else {
        exp.status = nextStatus;
        exp.currentApproverRole = getRequiredApproverRole(nextStatus);
      }

      await exp.save({ session });

      await writeAudit({
        actor: actor._id,
        action: 'expense.approved',
        entityType: 'Expense',
        entityId: exp._id,
        after: exp,
        req,
        session,
      });

      return exp;
    });

    return Expense.findById(expense._id).populate('approvals.user', 'name role').populate('createdBy', 'name');
  } finally {
    await session.endSession();
  }
}

export async function rejectExpense(expenseId, { reason }, actor, req) {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('Rejection reason is mandatory.', 'REJECTION_REASON_REQUIRED');
  }

  const expense = await Expense.findById(expenseId);
  if (!expense) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');
  if (expense.status === EXPENSE_STATUS.APPROVED) {
    throw ApiError.conflict('Cannot reject an already approved expense.', 'EXPENSE_ALREADY_APPROVED');
  }
  if (expense.status === EXPENSE_STATUS.REJECTED) {
    throw ApiError.conflict('Expense already rejected.', 'EXPENSE_ALREADY_REJECTED');
  }
  if (!canUserApprove(actor, expense.status)) {
    throw ApiError.forbidden('You are not authorized to reject at this stage.', 'NOT_AUTHORIZED_APPROVER');
  }

  expense.status = EXPENSE_STATUS.REJECTED;
  expense.rejectedBy = actor._id;
  expense.rejectedAt = nowInDhaka();
  expense.rejectionReason = reason.trim().slice(0, 500);
  expense.currentApproverRole = null;
  await expense.save();

  await writeAudit({
    actor: actor._id,
    action: 'expense.rejected',
    entityType: 'Expense',
    entityId: expense._id,
    after: expense,
    req,
  });

  return expense;
}

async function postExpenseToLedger(expense, actor, session) {
  // Debit the expense account and credit the account the money was paid from.
  const assetCode = PAYMENT_METHOD_ACCOUNTS[expense.paymentMethod] || PAYMENT_METHOD_ACCOUNTS.cash;
  const expenseCode = ACCOUNT_CODES.ADMIN_EXPENSE;

  const entry = await postJournal({
    description: `Expense: ${expense.title} (${expense.expenseNo})`,
    lines: [
      { code: expenseCode, debitPaisa: expense.amountPaisa },
      { code: assetCode, creditPaisa: expense.amountPaisa },
    ],
    sourceType: 'expense',
    sourceId: expense._id,
    postedBy: actor._id,
    session,
  });

  expense.journalEntry = entry._id;
  return entry;
}

export async function listExpenses(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.search?.trim()) {
    filter.$or = [
      { title: new RegExp(escapeRegex(query.search.trim()), 'i') },
      { expenseNo: new RegExp(escapeRegex(query.search.trim()), 'i') },
      { payee: new RegExp(escapeRegex(query.search.trim()), 'i') },
    ];
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // If user is not super_admin, filter by their approval stage
  if (query.myApprovals === 'true' && query.userId) {
    const userRole = query.userRole;
    const statusForRole = EXPENSE_STATUS_ORDER.find(
      (s) => getRequiredApproverRole(s) === userRole || (userRole === ROLES.SUPER_ADMIN && s !== EXPENSE_STATUS.DRAFT)
    );
    if (statusForRole) filter.status = statusForRole;
  }

  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name role')
      .populate('approvals.user', 'name role')
      .populate('rejectedBy', 'name'),
    Expense.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getExpenseById(id) {
  assertObjectId(id, 'expense');
  const expense = await Expense.findById(id)
    .populate('createdBy', 'name role')
    .populate('approvals.user', 'name role')
    .populate('rejectedBy', 'name')
    .populate('journalEntry');
  if (!expense) throw ApiError.notFound('Expense not found.', 'EXPENSE_NOT_FOUND');
  return expense;
}

export async function listExpenseCategories() {
  const rows = await Expense.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalPaisa: { $sum: '$amountPaisa' },
        approvedPaisa: {
          $sum: {
            $cond: [{ $eq: ['$status', EXPENSE_STATUS.APPROVED] }, '$amountPaisa', 0],
          },
        },
        pendingPaisa: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [
                    EXPENSE_STATUS.PENDING_TREASURER,
                    EXPENSE_STATUS.PENDING_GS,
                    EXPENSE_STATUS.PENDING_PRESIDENT,
                  ],
                ],
              },
              '$amountPaisa',
              0,
            ],
          },
        },
      },
    },
    { $sort: { totalPaisa: -1 } },
  ]);

  return rows.map((row) => ({
    category: row._id,
    count: row.count,
    totalPaisa: row.totalPaisa,
    approvedPaisa: row.approvedPaisa,
    pendingPaisa: row.pendingPaisa,
  }));
}

export async function listPendingForUser(user) {
  if (user.role === ROLES.SUPER_ADMIN) {
    return Expense.find({
      status: { $in: [EXPENSE_STATUS.PENDING_TREASURER, EXPENSE_STATUS.PENDING_GS, EXPENSE_STATUS.PENDING_PRESIDENT] },
    })
      .sort({ createdAt: 1 })
      .populate('createdBy', 'name role');
  }

  const requiredStatus = EXPENSE_STATUS_ORDER.find((s) => getRequiredApproverRole(s) === user.role);
  if (!requiredStatus) return [];

  return Expense.find({ status: requiredStatus })
    .sort({ createdAt: 1 })
    .populate('createdBy', 'name role');
}

export default {
  createExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  listExpenses,
  getExpenseById,
  listExpenseCategories,
  listPendingForUser,
};