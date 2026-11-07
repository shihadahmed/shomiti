import { asyncHandler } from '../utils/asyncHandler.js';
import * as dashboardService from '../services/dashboard.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Get dashboard metrics for admin dashboard
 */
export const getDashboard = asyncHandler(async (req, res) => {
  const metrics = await dashboardService.getDashboardMetrics();
  res.json({ success: true, data: metrics });
});

/**
 * Get recent transactions for dashboard
 */
export const getRecentTransactions = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const transactions = await dashboardService.getRecentTransactions(limit);
  res.json({ success: true, data: transactions });
});

/**
 * Get pending approvals for dashboard
 */
export const getPendingApprovals = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const approvals = await dashboardService.getPendingApprovals(limit);
  res.json({ success: true, data: approvals });
});

/**
 * Get overdue members for dashboard
 */
export const getOverdueMembers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const members = await dashboardService.getOverdueMembers(limit);
  res.json({ success: true, data: members });
});

/**
 * Get monthly collection trend
 */
export const getMonthlyTrend = asyncHandler(async (req, res) => {
  const metrics = await dashboardService.getDashboardMetrics();
  res.json({ success: true, data: metrics.monthlyCollection });
});

/**
 * Get member dashboard - aggregated personal data for authenticated member
 */
export const getMemberDashboard = asyncHandler(async (req, res) => {
  const memberId = req.user.memberId;
  if (!memberId) {
    throw ApiError.forbidden('No member record linked to this account.', 'MEMBER_NOT_LINKED');
  }
  const data = await dashboardService.getMemberDashboard(memberId);
  res.json({ success: true, data });
});

export default {
  getDashboard,
  getRecentTransactions,
  getPendingApprovals,
  getOverdueMembers,
  getMonthlyTrend,
  getMemberDashboard,
};