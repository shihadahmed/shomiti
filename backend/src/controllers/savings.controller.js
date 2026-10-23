import { asyncHandler } from '../utils/asyncHandler.js';
import * as savingsService from '../services/savings.service.js';

export const listDues = asyncHandler(async (req, res) => {
  const result = await savingsService.listDues(req.query);
  res.json({ success: true, data: result });
});

export const myDues = asyncHandler(async (req, res) => {
  if (!req.user.member) {
    return res.json({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } },
    });
  }
  const result = await savingsService.listDues({
    ...req.query,
    memberId: String(req.user.member),
  });
  return res.json({ success: true, data: result });
});

export const getDue = asyncHandler(async (req, res) => {
  const due = await savingsService.getDueById(req.params.id);
  res.json({ success: true, data: { due } });
});

export const payDue = asyncHandler(async (req, res) => {
  const idempotencyKey = req.get('idempotency-key') || undefined;
  const result = await savingsService.paySavingsDue(
    req.params.id,
    req.body,
    req.user,
    req,
    { idempotencyKey },
  );

  const message = result.needsOfflineVerification
    ? 'Payment submitted for verification.'
    : result.duplicate
      ? 'Payment already recorded.'
      : 'Payment processed successfully.';

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    data: result,
    message,
  });
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const result = await savingsService.verifyPayment(req.params.id, req.body, req.user, req);
  const message = result.status === 'confirmed' ? 'Payment verified and posted.' : 'Payment rejected.';
  res.json({ success: true, data: { payment: result }, message });
});

export const listPaymentSlips = asyncHandler(async (req, res) => {
  const result = await savingsService.listPaymentSlips(req.query);
  res.json({ success: true, data: result });
});

export const paymentSlipDetail = asyncHandler(async (req, res) => {
  const payment = await savingsService.getPaymentSlipById(req.params.id);
  res.json({ success: true, data: { payment } });
});

export const generateDues = asyncHandler(async (req, res) => {
  const { savingsType, period } = req.body;
  const dues = await savingsService.generateDuesForPeriod(savingsType, period, req.user, req);
  res.status(201).json({
    success: true,
    data: { items: dues, count: dues.length },
    message: `Generated ${dues.length} dues for ${period}.`,
  });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const result = await savingsService.listTransactions(req.query);
  res.json({ success: true, data: result });
});

export const myTransactions = asyncHandler(async (req, res) => {
  if (!req.user.member) {
    return res.json({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } },
    });
  }
  const result = await savingsService.listTransactions({
    ...req.query,
    memberId: String(req.user.member),
  });
  return res.json({ success: true, data: result });
});

export const transactionDetail = asyncHandler(async (req, res) => {
  const transaction = await savingsService.getTransactionById(req.params.id);
  res.json({ success: true, data: { transaction } });
});

export const memberAccounts = asyncHandler(async (req, res) => {
  const items = await savingsService.listAccounts(req.params.memberId);
  res.json({ success: true, data: { items } });
});

export default {
  listDues,
  myDues,
  getDue,
  payDue,
  verifyPayment,
  listPaymentSlips,
  paymentSlipDetail,
  generateDues,
  listTransactions,
  myTransactions,
  transactionDetail,
  memberAccounts,
};
