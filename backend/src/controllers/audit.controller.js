import { asyncHandler } from '../utils/asyncHandler.js';
import AuditLog from '../models/AuditLog.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const filter = {};
  if (req.query.action) filter.action = new RegExp(String(req.query.action), 'i');
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.actor) filter.actor = req.query.actor;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'name role email phone'),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ success: true, data: { items, meta: paginationMeta(total, page, limit) } });
});

export default { list };
