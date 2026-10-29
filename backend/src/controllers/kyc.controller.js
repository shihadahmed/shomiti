import { asyncHandler } from '../utils/asyncHandler.js';
import * as kycService from '../services/kyc.service.js';

export const getMyKyc = asyncHandler(async (req, res) => {
  const profile = await kycService.getMyKyc(req.user._id);
  res.json({ success: true, data: { profile } });
});

export const submitKyc = asyncHandler(async (req, res) => {
  const profile = await kycService.submitKyc(req.user._id, req.body, req);
  res.json({
    success: true,
    data: { profile },
    message: 'Your profile has been submitted for review.',
  });
});

export const listPendingKyc = asyncHandler(async (req, res) => {
  const result = await kycService.listPendingKyc(req.query);
  res.json({ success: true, data: result });
});

export const decideKyc = asyncHandler(async (req, res) => {
  const user = await kycService.decideKyc(req.params.id, req.body, req.user, req);
  res.json({
    success: true,
    data: { user },
    message:
      req.body.decision === 'approved'
        ? 'Profile approved. The account is now active.'
        : 'Profile rejected. The member has been notified.',
  });
});

export default { getMyKyc, submitKyc, listPendingKyc, decideKyc };
