import { asyncHandler } from '../utils/asyncHandler.js';
import LedgerAccount from '../models/LedgerAccount.js';
import {
  ensureChartOfAccounts,
  getTrialBalance,
  listJournalEntries,
} from '../services/ledger.service.js';

export const trialBalance = asyncHandler(async (_req, res) => {
  const items = await getTrialBalance();
  const totals = items.reduce(
    (acc, row) => ({
      debitPaisa: acc.debitPaisa + row.debitPaisa,
      creditPaisa: acc.creditPaisa + row.creditPaisa,
    }),
    { debitPaisa: 0, creditPaisa: 0 },
  );
  res.json({ success: true, data: { items, totals } });
});

export const chartOfAccounts = asyncHandler(async (_req, res) => {
  await ensureChartOfAccounts();
  const [accounts, balances] = await Promise.all([
    LedgerAccount.find({}).sort({ code: 1 }),
    getTrialBalance(),
  ]);
  const byCode = new Map(balances.map((row) => [row.code, row]));
  const items = accounts.map((account) => ({
    ...account.toJSON(),
    debitPaisa: byCode.get(account.code)?.debitPaisa || 0,
    creditPaisa: byCode.get(account.code)?.creditPaisa || 0,
    balancePaisa: byCode.get(account.code)?.balancePaisa || 0,
  }));
  res.json({ success: true, data: { items } });
});

export const entries = asyncHandler(async (req, res) => {
  const result = await listJournalEntries(req.query);
  res.json({ success: true, data: result });
});

export const accounts = trialBalance;

export default { accounts, trialBalance, chartOfAccounts, entries };
