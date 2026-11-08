import { asyncHandler } from '../utils/asyncHandler.js';
import * as reportService from '../services/report.service.js';
import ApiError from '../utils/ApiError.js';

export const getReport = asyncHandler(async (req, res) => {
  const { type, from, to } = req.query;
  
  if (!type) {
    throw ApiError.badRequest('Report type is required.', 'MISSING_REPORT_TYPE');
  }
  
  if (!from || !to) {
    throw ApiError.badRequest('Date range (from, to) is required.', 'MISSING_DATE_RANGE');
  }

  const result = await reportService.generateReport(type, from, to, req.query);
  res.json({ success: true, data: result });
});

export const exportReport = asyncHandler(async (req, res) => {
  const { type, from, to, format = 'csv' } = req.query;
  
  if (!type || !from || !to) {
    throw ApiError.badRequest('Type, from, and to are required.', 'MISSING_PARAMETERS');
  }

  const { data, filename, contentType } = await reportService.exportReport(type, from, to, format, req.query);
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(data);
});

export default { getReport, exportReport };