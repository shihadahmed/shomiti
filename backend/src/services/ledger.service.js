import LedgerAccount from '../models/LedgerAccount.js';
import JournalEntry from '../models/JournalEntry.js';
import ApiError from '../utils/ApiError.js';
import { nextDocNo } from '../utils/sequence.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';

export const CHART_OF_ACCOUNTS = Object.freeze([
  { code: '1000', name: 'Cash in Hand', nameBn: 'হাতে নগদ', type: 'asset', normalBalance: 'debit' },
  { code: '1010', name: 'Bank Account', nameBn: 'ব্যাংক হিসাব', type: 'asset', normalBalance: 'debit' },
  { code: '1020', name: 'bKash Account', nameBn: 'বিকাশ হিসাব', type: 'asset', normalBalance: 'debit' },
  { code: '1030', name: 'Nagad Account', nameBn: 'নগদ (Nagad) হিসাব', type: 'asset', normalBalance: 'debit' },
  { code: '1040', name: 'Rocket Account', nameBn: 'রকেট হিসাব', type: 'asset', normalBalance: 'debit' },
  { code: '2000', name: 'Member Savings Payable', nameBn: 'সদস্য সঞ্চয় প্রদেয়', type: 'liability', normalBalance: 'credit' },
  { code: '2100', name: 'Member Share Capital', nameBn: 'সদস্য শেয়ার মূলধন', type: 'liability', normalBalance: 'credit' },
  { code: '3000', name: 'General Fund', nameBn: 'সাধারণ তহবিল', type: 'equity', normalBalance: 'credit' },
  { code: '4000', name: 'Membership Fee Income', nameBn: 'সদস্য ফি আয়', type: 'income', normalBalance: 'credit' },
  { code: '4100', name: 'Service Charge Income', nameBn: 'সেবা চার্জ আয়', type: 'income', normalBalance: 'credit' },
  { code: '5000', name: 'Administrative Expense', nameBn: 'প্রশাসনিক ব্যয়', type: 'expense', normalBalance: 'debit' },
  { code: '5100', name: 'Interest Expense', nameBn: 'সুদ ব্যয়', type: 'expense', normalBalance: 'debit' },
]);

/** Ensures every ledger account exists. Safe to call repeatedly. */
export async function ensureChartOfAccounts(session) {
  const operations = CHART_OF_ACCOUNTS.map((account) => ({
    updateOne: {
      filter: { code: account.code },
      update: { $setOnInsert: { ...account, isSystem: true, isActive: true } },
      upsert: true,
    },
  }));

  await LedgerAccount.bulkWrite(operations, session ? { session } : {});
  return CHART_OF_ACCOUNTS;
}

/**
 * Posts a balanced double-entry journal.
 * `lines` use ledger account codes, e.g. { code: '1000', debitPaisa: 50000 }.
 */
export async function postJournal({
  description,
  lines,
  sourceType = 'savings_transaction',
  sourceId,
  postedBy,
  date = new Date(),
  session,
}) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw ApiError.badRequest('A journal entry needs at least two lines', 'JOURNAL_LINES_REQUIRED');
  }

  const normalised = lines.map((line) => ({
    code: String(line.code),
    debitPaisa: Math.round(Number(line.debitPaisa || 0)),
    creditPaisa: Math.round(Number(line.creditPaisa || 0)),
  }));

  for (const line of normalised) {
    const sides = Number(line.debitPaisa > 0) + Number(line.creditPaisa > 0);
    if (sides !== 1) {
      throw ApiError.badRequest(
        `Journal line ${line.code} must have exactly one debit or credit side`,
        'JOURNAL_LINE_INVALID',
      );
    }
  }

  const debit = normalised.reduce((sum, line) => sum + line.debitPaisa, 0);
  const credit = normalised.reduce((sum, line) => sum + line.creditPaisa, 0);

  if (debit !== credit) {
    throw ApiError.badRequest(
      'Journal entry is unbalanced',
      'JOURNAL_UNBALANCED',
      { debitPaisa: debit, creditPaisa: credit },
    );
  }

  const codes = [...new Set(normalised.map((line) => line.code))];
  const accounts = await LedgerAccount.find({ code: { $in: codes } }).session(session || null);
  const byCode = new Map(accounts.map((account) => [account.code, account]));

  const missing = codes.filter((code) => !byCode.has(code));
  if (missing.length) {
    throw ApiError.badRequest(
      `Ledger account(s) missing: ${missing.join(', ')}`,
      'LEDGER_ACCOUNT_MISSING',
      { codes: missing },
    );
  }

  const entryNo = await nextDocNo('JV', 'journal-entry', { date });

  const [entry] = await JournalEntry.create(
    [
      {
        entryNo,
        date,
        description,
        sourceType,
        sourceId: sourceId || undefined,
        lines: normalised.map((line) => ({
          account: byCode.get(line.code)._id,
          code: line.code,
          debitPaisa: line.debitPaisa,
          creditPaisa: line.creditPaisa,
        })),
        totalDebitPaisa: debit,
        totalCreditPaisa: credit,
        postedBy,
      },
    ],
    session ? { session } : {},
  );

  return entry;
}

/** Aggregated debit/credit/balance per ledger account. */
export async function getTrialBalance() {
  const rows = await JournalEntry.aggregate([
    { $match: { status: 'posted' } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.code',
        debitPaisa: { $sum: '$lines.debitPaisa' },
        creditPaisa: { $sum: '$lines.creditPaisa' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const accounts = await LedgerAccount.find({ code: { $in: rows.map((row) => row._id) } });
  const byCode = new Map(accounts.map((account) => [account.code, account]));

  return rows.map((row) => {
    const account = byCode.get(row._id);
    const signed = account?.normalBalance === 'credit'
      ? row.creditPaisa - row.debitPaisa
      : row.debitPaisa - row.creditPaisa;
    return {
      code: row._id,
      name: account?.name || row._id,
      nameBn: account?.nameBn,
      type: account?.type,
      debitPaisa: row.debitPaisa,
      creditPaisa: row.creditPaisa,
      balancePaisa: signed,
      debit: row.debitPaisa / 100,
      credit: row.creditPaisa / 100,
      balance: signed / 100,
    };
  });
}

export async function listJournalEntries(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { status: 'posted' };

  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  if (query.sourceType) filter.sourceType = query.sourceType;

  const [items, total] = await Promise.all([
    JournalEntry.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('postedBy', 'name')
      .populate('lines.account', 'code name nameBn'),
    JournalEntry.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export default {
  ensureChartOfAccounts,
  postJournal,
  getTrialBalance,
  listJournalEntries,
  CHART_OF_ACCOUNTS,
};
