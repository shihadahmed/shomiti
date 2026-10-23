import { asyncHandler } from '../utils/asyncHandler.js';
import * as schemeService from '../services/scheme.service.js';

export const list = asyncHandler(async (req, res) => {
  const items = await schemeService.listSchemes(req.query);
  res.json({ success: true, data: { items } });
});

export const create = asyncHandler(async (req, res) => {
  const scheme = await schemeService.createScheme(req.body, req.user, req);
  res.status(201).json({ success: true, data: { scheme }, message: 'Scheme created.' });
});

export const update = asyncHandler(async (req, res) => {
  const scheme = await schemeService.updateScheme(req.params.id, req.body, req.user, req);
  res.json({ success: true, data: { scheme }, message: 'Scheme updated.' });
});

export const enroll = asyncHandler(async (req, res) => {
  const enrollment = await schemeService.enrollMember(req.body, req.user, req);
  res.status(201).json({
    success: true,
    data: { enrollment },
    message: 'Member enrolled successfully.',
  });
});

export const enrollments = asyncHandler(async (req, res) => {
  const result = await schemeService.listEnrollments(req.query);
  res.json({ success: true, data: result });
});

export const enrollmentDetail = asyncHandler(async (req, res) => {
  const enrollment = await schemeService.getEnrollment(req.params.id);
  res.json({ success: true, data: { enrollment } });
});

export default { list, create, update, enroll, enrollments, enrollmentDetail };
