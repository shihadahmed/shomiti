import mongoose from 'mongoose';
import Member from '../models/Member.js';
import SavingsAccount from '../models/SavingsAccount.js';
import SavingsTransaction from '../models/SavingsTransaction.js';
import SavingsDue from '../models/SavingsDue.js';
import Payment from '../models/Payment.js';
import SavingsScheme from '../models/SavingsScheme.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { nextDocNo } from '../utils/sequence.js';
import { writeAudit } from '../utils/audit.js';
import { toPaisa } from '../utils/money.js';
import {
  ACCOUNT_CODES,
  MEMBER_STATUS,
  PAYMENT_METHOD_ACCOUNTS,
  PAYMENT_STATUS,
  TRANSACTION_STATUS,
  TRANSACTION_TYPES,
  SAVINGS_TYPES,
  SAVINGS_DUE_STATUS,
  BUSINESS_RULES,
} from '../config/constants.js';
import { postJournal } from './ledger.service.js';

const DHAKA_TZ = 'Asia/Dhaka';

function assertObjectId(id, label) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label} id.`, 'INVALID_IDENTIFIER');
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Get current time in Asia/Dhaka */
function nowInDhaka() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: DHAKA_TZ }));
}

/** Calculate due date for a savings type and period */
function calculateDueDate(savingsType, period, referenceDate = nowInDhaka()) {
  const date = new Date(referenceDate);
  if (savingsType === SAVINGS_TYPES.MONTHLY) {
    // period format: "YYYY-MM"
    const [year, month] = period.split('-').map(Number);
    date.setFullYear(year, month - 1, BUSINESS_RULES.MONTHLY_DUE_DAY);
    date.setHours(23, 59, 59, 999);
    return date;
  }
  if (savingsType === SAVINGS_TYPES.HALF_YEARLY) {
    // period format: "YYYY-H1" or "YYYY-H2"
    const [year, half] = period.split('-');
    const cycle = BUSINESS_RULES.HALF_YEARLY_CYCLES[half === 'H1' ? 0 : 1];
    date.setFullYear(Number(year), cycle.month - 1, cycle.day);
    date.setHours(23, 59, 59, 999);
    return date;
  }
  // ONE_TIME: due immediately
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Calculate late fee (5% of principal) */
function calculateLateFee(principalPaisa) {
  return Math.round(principalPaisa * BUSINESS_RULES.LATE_FEE_PERCENT / 100);
}

/**
 * Moves every past-due due to `overdue` and recalculates the 5% late fee.
 * Called before due listings, payment attempts and dashboard aggregation so
 * the rule stays correct even when no background job has run.
 */
export async function refreshOverdueDues(referenceDate = nowInDhaka()) {
  const overdue = await SavingsDue.find({
    status: SAVINGS_DUE_STATUS.DUE,
    dueDate: { $lt: referenceDate },
  }).select('_id principalPaisa');

  if (!overdue.length) return 0;

  await SavingsDue.bulkWrite(
    overdue.map((due) => {
      const lateFeePaisa = calculateLateFee(due.principalPaisa);
      return {
        updateOne: {
          filter: { _id: due._id, status: SAVINGS_DUE_STATUS.DUE },
          update: {
            $set: {
              status: SAVINGS_DUE_STATUS.OVERDUE,
              lateFeePaisa,
              totalDuePaisa: due.principalPaisa + lateFeePaisa,
            },
          },
        },
      };
    }),
  );

  return overdue.length;
}

function assertValidPeriod(savingsType, period) {
  if (savingsType === SAVINGS_TYPES.MONTHLY && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw ApiError.badRequest('Monthly period must use YYYY-MM format.', 'INVALID_PERIOD');
  }
  if (savingsType === SAVINGS_TYPES.HALF_YEARLY && !/^\d{4}-H[12]$/.test(period)) {
    throw ApiError.badRequest('Half-yearly period must use YYYY-H1 or YYYY-H2.', 'INVALID_PERIOD');
  }
  if (!period || String(period).length > 20) {
    throw ApiError.badRequest('A valid savings period is required.', 'INVALID_PERIOD');
  }
}

/** Get principal amount for a savings type */
function getPrincipalForType(savingsType) {
  if (savingsType === SAVINGS_TYPES.MONTHLY) return BUSINESS_RULES.MONTHLY_PRINCIPAL_PAISA;
  if (savingsType === SAVINGS_TYPES.HALF_YEARLY) return BUSINESS_RULES.HALF_YEARLY_PRINCIPAL_PAISA;
  return 0; // ONE_TIME is variable
}

/** Generate or get SavingsDue for a member/type/period */
export async function ensureSavingsDue(memberId, savingsType, period, actor, req, { session } = {}) {
  const member = await Member.findById(memberId).session(session || null);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');
  if (member.status !== MEMBER_STATUS.ACTIVE) {
    throw ApiError.conflict('Only active members can have dues.', 'MEMBER_NOT_ACTIVE');
  }

  const principalPaisa = getPrincipalForType(savingsType);
  if (principalPaisa === 0 && savingsType !== SAVINGS_TYPES.ONE_TIME) {
    throw ApiError.badRequest('Invalid savings type for fixed dues.', 'INVALID_SAVINGS_TYPE');
  }

  const dueDate = calculateDueDate(savingsType, period);
  const lateFeePaisa = nowInDhaka() > dueDate ? calculateLateFee(principalPaisa) : 0;
  const totalDuePaisa = principalPaisa + lateFeePaisa;

  const existing = await SavingsDue.findOne({ member: memberId, savingsType, period }).session(session || null);
  if (existing) {
    // Update late fee if overdue
    if (existing.status === SAVINGS_DUE_STATUS.DUE && nowInDhaka() > existing.dueDate) {
      existing.lateFeePaisa = calculateLateFee(existing.principalPaisa);
      existing.totalDuePaisa = existing.principalPaisa + existing.lateFeePaisa;
      existing.status = SAVINGS_DUE_STATUS.OVERDUE;
      await existing.save({ session: session || null });
    }
    return existing;
  }

  const dueNo = await nextDocNo('DUE', 'savings-due', { date: dueDate });

  const [due] = await SavingsDue.create(
    [
      {
        dueNo,
        member: memberId,
        savingsType,
        period,
        principalPaisa,
        lateFeePaisa,
        totalDuePaisa,
        dueDate,
        status: nowInDhaka() > dueDate ? SAVINGS_DUE_STATUS.OVERDUE : SAVINGS_DUE_STATUS.DUE,
        createdBy: actor._id,
      },
    ],
    session ? { session } : {},
  );

  await writeAudit({
    actor: actor._id,
    action: 'savings_due.created',
    entityType: 'SavingsDue',
    entityId: due._id,
    after: due,
    req,
    session,
  });

  return due;
}

/** Create SavingsDue for all active members for a given period (batch job) */
export async function generateDuesForPeriod(savingsType, period, actor, req) {
  assertValidPeriod(savingsType, period);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const members = await Member.find({ status: MEMBER_STATUS.ACTIVE }).session(session);
      const dues = [];
      for (const member of members) {
        const due = await ensureSavingsDue(member._id, savingsType, period, actor, req, { session });
        dues.push(due);
      }
      return dues;
    });
  } finally {
    await session.endSession();
  }
}

/** Pay a SavingsDue - MUST pay full amount (principal + late fee) */
export async function paySavingsDue(dueId, payload, actor, req, { idempotencyKey } = {}) {
  if (idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) return { payment: existing, duplicate: true };
  }

  const due = await SavingsDue.findById(dueId);
  if (!due) throw ApiError.notFound('Savings due not found.', 'DUE_NOT_FOUND');
  if (due.status === SAVINGS_DUE_STATUS.PAID) {
    throw ApiError.conflict('This due has already been paid.', 'DUE_ALREADY_PAID');
  }
  if (due.status === SAVINGS_DUE_STATUS.CANCELLED) {
    throw ApiError.conflict('This due has been cancelled.', 'DUE_CANCELLED');
  }

  // Recalculate the 5% late fee if the due date has already passed.
  if (due.status === SAVINGS_DUE_STATUS.DUE && nowInDhaka() > due.dueDate) {
    due.lateFeePaisa = calculateLateFee(due.principalPaisa);
    due.totalDuePaisa = due.principalPaisa + due.lateFeePaisa;
    due.status = SAVINGS_DUE_STATUS.OVERDUE;
    await due.save();
  }

  // Enforce full payment (no partial payments)
  const requiredAmount = due.totalDuePaisa;
  const paidAmount = toPaisa(payload.amount);
  if (paidAmount !== requiredAmount) {
    throw ApiError.badRequest(
      `Partial payments not allowed. Exact amount due: ${formatMoney(requiredAmount)}`,
      'PARTIAL_PAYMENT_NOT_ALLOWED',
      { requiredAmount, paidAmount },
    );
  }

  const member = await Member.findById(due.member);
  if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');

  const account = await SavingsAccount.findOne({ member: member._id, status: 'active' }).sort({ createdAt: 1 });
  if (!account) throw ApiError.notFound('No active savings account for this member.', 'ACCOUNT_NOT_FOUND');

  const method = payload.method;
  const needsOfflineVerification = method === 'cash' || method === 'bank_transfer';

  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      if (idempotencyKey) {
        const duplicate = await Payment.findOne({ idempotencyKey }).session(session);
        if (duplicate) return { payment: duplicate, duplicate: true };
      }

      const paymentNo = await nextDocNo('PAY', 'payment', { date: nowInDhaka() });
      const receiptNo = await nextDocNo('RCP', 'receipt', { date: nowInDhaka() });

      const [payment] = await Payment.create(
        [
          {
            paymentNo,
            member: member._id,
            savingsDue: due._id,
            method,
            amountPaisa: paidAmount,
            status: needsOfflineVerification ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.CONFIRMED,
            providerRef: payload.providerRef,
            senderNumber: payload.senderNumber,
            bankName: payload.bankName,
            note: payload.note,
            receiptNo: needsOfflineVerification ? undefined : receiptNo,
            createdBy: actor._id,
            paidAt: needsOfflineVerification ? undefined : nowInDhaka(),
            confirmedBy: needsOfflineVerification ? undefined : actor._id,
            confirmedAt: needsOfflineVerification ? undefined : nowInDhaka(),
          },
        ],
        { session },
      );

      // Create the savings transaction (deposit)
      const txnNo = await nextDocNo('TXN', 'savings-txn', { date: nowInDhaka() });
      const [txn] = await SavingsTransaction.create(
        [
          {
            txnNo,
            member: member._id,
            account: account._id,
            savingsDue: due._id,
            type: TRANSACTION_TYPES.DEPOSIT,
            amountPaisa: paidAmount,
            method,
            status: needsOfflineVerification
              ? TRANSACTION_STATUS.PENDING_APPROVAL
              : TRANSACTION_STATUS.POSTED,
            payment: payment._id,
            receiptNo: needsOfflineVerification ? undefined : receiptNo,
            note: payload.note,
            idempotencyKey: idempotencyKey || undefined,
            createdBy: actor._id,
            postedBy: needsOfflineVerification ? undefined : actor._id,
            postedAt: needsOfflineVerification ? undefined : nowInDhaka(),
          },
        ],
        { session },
      );

      payment.transaction = txn._id;
      await payment.save({ session });

      if (!needsOfflineVerification) {
        // Post to ledger immediately
        await applyPosting({ txn, actor, session });

        // Mark due as paid
        due.status = SAVINGS_DUE_STATUS.PAID;
        due.paidAt = nowInDhaka();
        due.payment = payment._id;
        await due.save({ session });

        await writeAudit({
          actor: actor._id,
          action: 'savings_due.paid',
          entityType: 'SavingsDue',
          entityId: due._id,
          after: due,
          req,
          session,
        });
      } else {
        // Offline payment - needs verification
        await writeAudit({
          actor: actor._id,
          action: 'savings_due.payment_submitted',
          entityType: 'Payment',
          entityId: payment._id,
          after: payment,
          req,
          session,
        });
      }

      return { payment, transaction: txn, needsOfflineVerification };
    });

    const populated = await Payment.findById(result.payment._id)
      .populate('member', 'code fullName phone')
      .populate('savingsDue', 'dueNo period totalDuePaisa')
      .populate('transaction', 'txnNo receiptNo')
      .populate('createdBy', 'name');

    return { ...result, payment: populated };
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey });
      if (existing) return { payment: existing, duplicate: true };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/** Verify/approve an offline payment (cash/bank slip) */
export async function verifyPayment(paymentId, { approved, rejectionReason }, actor, req) {
  const isApproved = approved === true || approved === 'true';
  if (!isApproved && (!rejectionReason || !String(rejectionReason).trim())) {
    throw ApiError.badRequest(
      'A rejection reason is mandatory.',
      'REJECTION_REASON_REQUIRED',
    );
  }

  const session = await mongoose.startSession();

  try {
    const payment = await session.withTransaction(async () => {
      const pmt = await Payment.findById(paymentId).session(session);
      if (!pmt) throw ApiError.notFound('Payment not found.', 'PAYMENT_NOT_FOUND');
      if (pmt.status !== PAYMENT_STATUS.PENDING) {
        throw ApiError.conflict('Payment is no longer pending verification.', 'PAYMENT_NOT_PENDING');
      }

      if (!isApproved) {
        pmt.status = PAYMENT_STATUS.FAILED;
        pmt.rejectionReason = String(rejectionReason).trim().slice(0, 500);
        pmt.confirmedBy = actor._id;
        pmt.confirmedAt = nowInDhaka();
        await pmt.save({ session });

        // Also reject the transaction
        if (pmt.transaction) {
          const txn = await SavingsTransaction.findById(pmt.transaction).session(session);
          if (txn) {
            txn.status = TRANSACTION_STATUS.REJECTED;
            await txn.save({ session });
          }
        }

        await writeAudit({
          actor: actor._id,
          action: 'payment.rejected',
          entityType: 'Payment',
          entityId: pmt._id,
          after: pmt,
          req,
          session,
        });

        return pmt;
      }

      // Approved - post to ledger
      pmt.status = PAYMENT_STATUS.CONFIRMED;
      pmt.confirmedBy = actor._id;
      pmt.confirmedAt = nowInDhaka();
      pmt.paidAt = pmt.paidAt || nowInDhaka();

      if (!pmt.receiptNo) {
        pmt.receiptNo = await nextDocNo('RCP', 'receipt', { date: nowInDhaka() });
      }
      await pmt.save({ session });

      // Post the transaction
      const txn = await SavingsTransaction.findById(pmt.transaction).session(session);
      if (txn) {
        await applyPosting({ txn, actor, session });
        txn.receiptNo = pmt.receiptNo;
        await txn.save({ session });
      }

      // Mark due as paid
      if (pmt.savingsDue) {
        const due = await SavingsDue.findById(pmt.savingsDue).session(session);
        if (due) {
          due.status = SAVINGS_DUE_STATUS.PAID;
          due.paidAt = nowInDhaka();
          due.payment = pmt._id;
          await due.save({ session });
        }
      }

      await writeAudit({
        actor: actor._id,
        action: 'payment.approved',
        entityType: 'Payment',
        entityId: pmt._id,
        after: pmt,
        req,
        session,
      });

      return pmt;
    });

    return payment;
  } finally {
    await session.endSession();
  }
}

/** Apply posting to ledger (used internally) */
async function applyPosting({ txn, actor, session }) {
  const account = await SavingsAccount.findById(txn.account).session(session);
  if (!account) throw ApiError.notFound('Savings account not found.', 'ACCOUNT_NOT_FOUND');
  if (account.status !== 'active') throw ApiError.conflict('Savings account is closed.', 'ACCOUNT_CLOSED');

  const amount = txn.amountPaisa;

  if (txn.type === TRANSACTION_TYPES.WITHDRAWAL) {
    if (account.balancePaisa < amount) {
      throw ApiError.badRequest('Insufficient savings balance for this withdrawal.', 'INSUFFICIENT_BALANCE');
    }
    account.balancePaisa -= amount;
  } else {
    account.balancePaisa += amount;
  }

  await account.save({ session });

  txn.status = TRANSACTION_STATUS.POSTED;
  txn.balanceAfterPaisa = account.balancePaisa;
  txn.postedBy = actor._id;
  txn.postedAt = nowInDhaka();
  if (!txn.receiptNo) {
    txn.receiptNo = await nextDocNo('RCP', 'receipt', { date: nowInDhaka() });
  }
  await txn.save({ session });

  const assetCode = PAYMENT_METHOD_ACCOUNTS[txn.method];
  const journalLines = txn.type === TRANSACTION_TYPES.DEPOSIT
    ? [
        { code: assetCode, debitPaisa: amount },
        { code: ACCOUNT_CODES.MEMBER_SAVINGS_PAYABLE, creditPaisa: amount },
      ]
    : [
        { code: ACCOUNT_CODES.MEMBER_SAVINGS_PAYABLE, debitPaisa: amount },
        { code: assetCode, creditPaisa: amount },
      ];

  const entry = await postJournal({
    description: `${txn.type === TRANSACTION_TYPES.DEPOSIT ? 'Savings deposit' : 'Savings withdrawal'} ${txn.txnNo}`,
    lines: journalLines,
    sourceType: 'savings_transaction',
    sourceId: txn._id,
    postedBy: actor._id,
    session,
  });

  if (txn.payment) {
    const payment = await Payment.findById(txn.payment).session(session);
    if (payment) {
      payment.status = PAYMENT_STATUS.CONFIRMED;
      payment.confirmedBy = actor._id;
      payment.confirmedAt = nowInDhaka();
      payment.paidAt = payment.paidAt || nowInDhaka();
      await payment.save({ session });
    }
  }

  return entry;
}

/** Manual bank-slip / cash payment queue for the approvals module. */
export async function listPaymentSlips(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.method) filter.method = query.method;
  if (query.search?.trim()) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [
      { paymentNo: regex },
      { providerRef: regex },
      { senderNumber: regex },
      { bankName: regex },
      { receiptNo: regex },
    ];
  }

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('member', 'code fullName fullNameBn phone')
      .populate('savingsDue', 'dueNo period savingsType principalPaisa lateFeePaisa totalDuePaisa dueDate status')
      .populate('transaction', 'txnNo receiptNo status')
      .populate('createdBy', 'name role')
      .populate('confirmedBy', 'name role'),
    Payment.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getPaymentSlipById(id) {
  assertObjectId(id, 'payment');
  const payment = await Payment.findById(id)
    .populate('member', 'code fullName fullNameBn phone address')
    .populate('savingsDue')
    .populate('transaction')
    .populate('createdBy', 'name role')
    .populate('confirmedBy', 'name role');
  if (!payment) throw ApiError.notFound('Payment not found.', 'PAYMENT_NOT_FOUND');
  return payment;
}

export async function listDues(query = {}) {
  await refreshOverdueDues();
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.memberId) {
    assertObjectId(query.memberId, 'member');
    filter.member = query.memberId;
  }
  if (query.savingsType) filter.savingsType = query.savingsType;
  if (query.status) filter.status = query.status;
  if (query.period) filter.period = query.period;
  if (query.overdue === 'true') {
    filter.status = { $in: [SAVINGS_DUE_STATUS.DUE, SAVINGS_DUE_STATUS.OVERDUE] };
    filter.dueDate = { $lt: nowInDhaka() };
  }
  if (query.search?.trim()) {
    filter.dueNo = new RegExp(escapeRegex(query.search.trim()), 'i');
  }

  const [items, total] = await Promise.all([
    SavingsDue.find(filter)
      .sort({ dueDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('member', 'code fullName phone')
      .populate('payment', 'paymentNo status receiptNo')
      .populate('createdBy', 'name'),
    SavingsDue.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getDueById(id) {
  assertObjectId(id, 'due');
  const due = await SavingsDue.findById(id)
    .populate('member', 'code fullName phone address')
    .populate('payment')
    .populate('createdBy', 'name');
  if (!due) throw ApiError.notFound('Savings due not found.', 'DUE_NOT_FOUND');
  return due;
}

export async function listTransactions(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.memberId) {
    assertObjectId(query.memberId, 'member');
    filter.member = query.memberId;
  }
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.method) filter.method = query.method;
  if (query.search?.trim()) {
    filter.txnNo = new RegExp(escapeRegex(query.search.trim()), 'i');
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

  const [items, total] = await Promise.all([
    SavingsTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('member', 'code fullName phone')
      .populate('account', 'accountNo type')
      .populate('savingsDue', 'dueNo period')
      .populate('createdBy', 'name')
      .populate('postedBy', 'name'),
    SavingsTransaction.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getTransactionById(id) {
  assertObjectId(id, 'transaction');
  const txn = await SavingsTransaction.findById(id)
    .populate('member', 'code fullName phone address')
    .populate('account', 'accountNo type balancePaisa')
    .populate('payment')
    .populate('savingsDue', 'dueNo period totalDuePaisa')
    .populate('createdBy', 'name')
    .populate('postedBy', 'name');

  if (!txn) throw ApiError.notFound('Transaction not found.', 'TRANSACTION_NOT_FOUND');
  return txn;
}

export async function listAccounts(memberId) {
  assertObjectId(memberId, 'member');
  return SavingsAccount.find({ member: memberId }).sort({ createdAt: 1 });
}

/** Helper for formatting in service */
function formatMoney(paisa) {
  return (Math.round(paisa || 0) / 100).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default {
  ensureSavingsDue,
  refreshOverdueDues,
  generateDuesForPeriod,
  paySavingsDue,
  verifyPayment,
  listPaymentSlips,
  getPaymentSlipById,
  listDues,
  getDueById,
  listTransactions,
  getTransactionById,
  listAccounts,
};