import path from 'node:path';
import { asyncHandler } from '../utils/asyncHandler.js';
import config from '../config/env.js';
import * as memberService from '../services/member.service.js';

/** GET /api/members — searchable, paginated member registry. */
export const listMembers = asyncHandler(async (req, res) => {
  const result = await memberService.listMembers(req.query);
  res.json({ success: true, data: result });
});

/** GET /api/members/options — compact list for member pickers. */
export const memberOptions = asyncHandler(async (req, res) => {
  const items = await memberService.getMemberOptions(req.query);
  res.json({ success: true, data: { items } });
});

/** GET /api/members/:id — profile, accounts and recent transactions. */
export const getMember = asyncHandler(async (req, res) => {
  const result = await memberService.getMemberById(req.params.id);
  res.json({ success: true, data: result });
});

/** POST /api/members */
export const createMember = asyncHandler(async (req, res) => {
  const result = await memberService.createMember(req.body, req.user, req);
  res.status(201).json({
    success: true,
    data: result,
    message: 'Member created successfully.',
  });
});

/** PATCH /api/members/:id */
export const updateMember = asyncHandler(async (req, res) => {
  const member = await memberService.updateMember(req.params.id, req.body, req.user, req);
  res.json({ success: true, data: { member }, message: 'Member updated successfully.' });
});

/** DELETE /api/members/:id — soft deactivate, history is retained. */
export const deleteMember = asyncHandler(async (req, res) => {
  const member = await memberService.deactivateMember(req.params.id, req.user, req);
  res.json({ success: true, data: { member }, message: 'Member deactivated successfully.' });
});

/** GET /api/members/:id/transactions */
export const getMemberTransactions = asyncHandler(async (req, res) => {
  const result = await memberService.getMemberTransactions(req.params.id, req.query);
  res.json({ success: true, data: result });
});

/** POST /api/members/:id/photo */
export const uploadPhoto = asyncHandler(async (req, res) => {
  const member = await memberService.setMemberPhoto(req.params.id, req.file, req.user, req);
  res.json({ success: true, data: { member }, message: 'Member photo updated.' });
});

/** GET /api/members/:id/photo */
export const downloadPhoto = asyncHandler(async (req, res) => {
  const photo = await memberService.getMemberPhoto(req.params.id);
  const filePath = path.join(config.uploadDir, path.basename(photo.storedName));
  return res.type(photo.mimeType).sendFile(filePath);
});

export default {
  listMembers,
  memberOptions,
  getMember,
  createMember,
  updateMember,
  deleteMember,
  getMemberTransactions,
  uploadPhoto,
  downloadPhoto,
};
