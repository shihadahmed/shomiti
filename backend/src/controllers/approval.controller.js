import { asyncHandler } from '../utils/asyncHandler.js';
import * as approvalService from '../services/approval.service.js';
import * as savingsService from '../services/savings.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await approvalService.listApprovals({
    ...req.query,
    userId: req.user._id,
  });
  res.json({ success: true, data: result });
});

export const detail = asyncHandler(async (req, res) => {
  const approval = await approvalService.getApprovalById(req.params.id);
  res.json({ success: true, data: { approval } });
});

export const decide = asyncHandler(async (req, res) => {
  const approval = await approvalService.decideApproval(
    req.params.id,
    req.body,
    req.user,
    req,
  );
  res.json({
    success: true,
    data: { approval },
    message: approval.status === 'approved' ? 'Request approved.' : 'Decision recorded.',
  });
});

export const cancel = asyncHandler(async (req, res) => {
  const approval = await approvalService.cancelApproval(req.params.id, req.user, req);
  res.json({ success: true, data: { approval } });
});

export const listSlips = asyncHandler(async (req, res) => {
  const result = await savingsService.listPaymentSlips(req.query);
  res.json({ success: true, data: result });
});

export const slipDetail = asyncHandler(async (req, res) => {
  const payment = await savingsService.getPaymentSlipById(req.params.id);
  res.json({ success: true, data: { payment } });
});

export const decideSlip = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body;
  const approved = decision === 'approved';
  const payment = await savingsService.verifyPayment(
    req.params.id,
    { approved, rejectionReason: reason },
    req.user,
    req,
  );
  res.json({
    success: true,
    data: { payment },
    message: approved ? 'Payment slip approved and posted.' : 'Payment slip rejected.',
  });
});

export default { list, detail, decide, cancel, listSlips, slipDetail, decideSlip };
