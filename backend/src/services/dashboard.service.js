import Member from '../models/Member.js';
import SavingsAccount from '../models/SavingsAccount.js';
import SavingsTransaction from '../models/SavingsTransaction.js';
import SavingsDue from '../models/SavingsDue.js';
import Expense from '../models/Expense.js';
import Payment from '../models/Payment.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { EXPENSE_STATUS, MEMBER_STATUS, PAYMENT_STATUS, TRANSACTION_STATUS, TRANSACTION_TYPES, SAVINGS_DUE_STATUS } from '../config/constants.js';
import { refreshOverdueDues } from './savings.service.js';

const PENDING_EXPENSE_STATUSES = [
  EXPENSE_STATUS.PENDING_TREASURER,
  EXPENSE_STATUS.PENDING_GS,
  EXPENSE_STATUS.PENDING_PRESIDENT,
];

function startOfToday() {
  const now = new Date();
  const dhaka = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  dhaka.setHours(0, 0, 0, 0);
  return dhaka;
}

function startOfMonth() {
  const date = startOfToday();
  date.setDate(1);
  return date;
}

/**
 * Live administrative metrics. All monetary values are returned in paisa so
 * the client can localise them with the shared money formatter.
 */
export async function getDashboardMetrics() {
  await refreshOverdueDues();

  const sixMonthsAgo = startOfMonth();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

  const [
    totalMembers,
    activeMembers,
    collectionAgg,
    todayCollectionAgg,
    monthCollectionAgg,
    monthlyCollection,
    dueAgg,
    pendingDueCount,
    expenseAgg,
    pendingExpenseApprovals,
    pendingPaymentSlips,
    pendingApprovalRequests,
    savingsAgg,
    totalDues,
  ] = await Promise.all([
    Member.countDocuments({}),
    Member.countDocuments({ status: MEMBER_STATUS.ACTIVE }),
    SavingsTransaction.aggregate([
      { $match: { status: TRANSACTION_STATUS.POSTED, type: TRANSACTION_TYPES.DEPOSIT } },
      { $group: { _id: null, total: { $sum: '$amountPaisa' } } },
    ]),
    SavingsTransaction.aggregate([
      {
        $match: {
          status: TRANSACTION_STATUS.POSTED,
          type: TRANSACTION_TYPES.DEPOSIT,
          createdAt: { $gte: startOfToday() },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaisa' } } },
    ]),
    SavingsTransaction.aggregate([
      {
        $match: {
          status: TRANSACTION_STATUS.POSTED,
          type: TRANSACTION_TYPES.DEPOSIT,
          createdAt: { $gte: startOfMonth() },
        },
      },
      { $group: { _id: null, total: { $sum: '$amountPaisa' } } },
    ]),
    SavingsTransaction.aggregate([
      {
        $match: {
          status: TRANSACTION_STATUS.POSTED,
          type: TRANSACTION_TYPES.DEPOSIT,
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          totalPaisa: { $sum: '$amountPaisa' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    SavingsDue.aggregate([
      {
        $facet: {
          totalDue: [
            { $match: { status: { $in: ['due', 'overdue'] } } },
            { $group: { _id: null, total: { $sum: '$totalDuePaisa' } } },
          ],
          overdue: [
            {
              $match: {
                $or: [
                  { status: 'overdue' },
                  { status: 'due', dueDate: { $lt: new Date() } },
                ],
              },
            },
            { $group: { _id: null, total: { $sum: '$totalDuePaisa' } } },
          ],
        },
      },
    ]),
    SavingsDue.countDocuments({ status: { $in: ['due', 'overdue'] } }),
    Expense.aggregate([
      { $match: { status: EXPENSE_STATUS.APPROVED } },
      { $group: { _id: null, total: { $sum: '$amountPaisa' } } },
    ]),
    Expense.countDocuments({ status: { $in: PENDING_EXPENSE_STATUSES } }),
    Payment.countDocuments({ status: PAYMENT_STATUS.PENDING }),
    ApprovalRequest.countDocuments({ status: 'pending' }),
    SavingsAccount.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$balancePaisa' } } },
    ]),
    SavingsDue.countDocuments({ status: { $in: ['due', 'overdue'] } }),
  ]);

  const totalCollection = collectionAgg[0]?.total || 0;
  const todayCollection = todayCollectionAgg[0]?.total || 0;
  const monthCollection = monthCollectionAgg[0]?.total || 0;
  const totalDue = dueAgg[0]?.totalDue[0]?.total || 0;
  const totalOverdue = dueAgg[0]?.overdue[0]?.total || 0;
  const totalExpenses = expenseAgg[0]?.total || 0;
  const totalSavingsBalance = savingsAgg[0]?.total || 0;

  return {
    totalMembers,
    activeMembers,
    totalCollection,
    todayCollection,
    monthCollection,
    monthlyCollection: monthlyCollection.map((row) => ({
      year: row._id.year,
      month: row._id.month,
      period: `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
      totalPaisa: row.totalPaisa,
      count: row.count,
    })),
    totalDue,
    totalOverdue,
    totalDues,
    pendingDueCount,
    totalExpenses,
    availableFund: totalCollection - totalExpenses,
    totalSavingsBalance,
    pendingPaymentSlips,
    pendingExpenseApprovals,
    pendingApprovals: pendingPaymentSlips + pendingExpenseApprovals + pendingApprovalRequests,
    pendingApprovalRequests,
  };
}

/** Recent posted savings transactions for the dashboard feed. */
export async function getRecentTransactions(limit = 8) {
  return SavingsTransaction.find({ status: TRANSACTION_STATUS.POSTED })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 8, 50))
    .populate('member', 'code fullName fullNameBn phone')
    .populate('account', 'accountNo type')
    .populate('postedBy', 'name')
    .lean();
}

/** Combined pending queue: manual slips and expenses awaiting a stage. */
export async function getPendingApprovals(limit = 8) {
  const perType = Math.min(Number(limit) || 8, 25);
  const [slips, expenses] = await Promise.all([
    Payment.find({ status: PAYMENT_STATUS.PENDING })
      .sort({ createdAt: -1 })
      .limit(perType)
      .populate('member', 'code fullName fullNameBn phone')
      .populate('savingsDue', 'dueNo period totalDuePaisa')
      .populate('createdBy', 'name role')
      .lean(),
    Expense.find({ status: { $in: PENDING_EXPENSE_STATUSES } })
      .sort({ createdAt: -1 })
      .limit(perType)
      .populate('createdBy', 'name role')
      .lean(),
  ]);

  return [
    ...slips.map((row) => ({ ...row, kind: 'payment_slip' })),
    ...expenses.map((row) => ({ ...row, kind: 'expense' })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, perType);
}

/** Overdue members for the "needs attention" panel. */
export async function getOverdueMembers(limit = 8) {
  await refreshOverdueDues();
  return SavingsDue.find({ status: 'overdue' })
    .sort({ dueDate: 1 })
    .limit(Math.min(Number(limit) || 8, 50))
    .populate('member', 'code fullName fullNameBn phone')
    .lean();
}

/**
 * Aggregated member dashboard data for authenticated members.
 * Returns personal savings, dues, transactions, and profile info.
 */
export async function getMemberDashboard(memberId) {
  await refreshOverdueDues();

  const [accounts, duesResult, transactionsResult] = await Promise.all([
    SavingsAccount.find({ member: memberId }).sort({ createdAt: 1 }).lean(),
    SavingsDue.find({
      member: memberId,
      status: { $in: [SAVINGS_DUE_STATUS.DUE, SAVINGS_DUE_STATUS.OVERDUE] },
    })
      .sort({ dueDate: 1 })
      .populate('member', 'code fullName phone')
      .populate('payment', 'paymentNo status receiptNo')
      .lean(),
    SavingsTransaction.find({
      member: memberId,
      status: TRANSACTION_STATUS.POSTED,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('account', 'accountNo type')
      .populate('savingsDue', 'dueNo period')
      .populate('postedBy', 'name')
      .lean(),
  ]);

  // Calculate savings summary
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balancePaisa || 0), 0);
  const activeAccounts = accounts.filter((acc) => acc.status === 'active').length;

  // Calculate monthly deposits (current month)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthlyDeposits = transactionsResult
    .filter((txn) => txn.type === TRANSACTION_TYPES.DEPOSIT && new Date(txn.createdAt) >= startOfMonth)
    .reduce((sum, txn) => sum + (txn.amountPaisa || 0), 0);

  // Dues summary
  const overdueDues = duesResult.filter((d) => d.status === SAVINGS_DUE_STATUS.OVERDUE);
  const dueDues = duesResult.filter((d) => d.status === SAVINGS_DUE_STATUS.DUE);
  const totalOverdueAmount = overdueDues.reduce((sum, d) => sum + (d.totalDuePaisa || 0), 0);
  const totalDueAmount = dueDues.reduce((sum, d) => sum + (d.totalDuePaisa || 0), 0);

  return {
    accounts: accounts.map((acc) => ({
      _id: acc._id,
      accountNo: acc.accountNo,
      type: acc.type,
      balancePaisa: acc.balancePaisa || 0,
      status: acc.status,
      createdAt: acc.createdAt,
    })),
    dues: {
      items: duesResult,
      summary: {
        totalOverdueCount: overdueDues.length,
        totalOverdueAmount,
        totalDueCount: dueDues.length,
        totalDueAmount,
        totalItems: duesResult.length,
        totalAmount: totalOverdueAmount + totalDueAmount,
      },
    },
    transactions: {
      items: transactionsResult.map((txn) => ({
        _id: txn._id,
        txnNo: txn.txnNo,
        date: txn.createdAt,
        type: txn.type,
        amountPaisa: txn.amountPaisa || 0,
        status: txn.status,
        account: txn.account,
        savingsDue: txn.savingsDue,
        postedBy: txn.postedBy,
      })),
      summary: {
        monthlyDeposits,
        totalBalance,
        activeAccounts,
      },
    },
  };
}

export default {
  getDashboardMetrics,
  getRecentTransactions,
  getPendingApprovals,
  getOverdueMembers,
  getMemberDashboard,
};
