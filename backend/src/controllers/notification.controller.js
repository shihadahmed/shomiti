import { asyncHandler } from '../utils/asyncHandler.js';
import * as notificationService from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await notificationService.listNotifications(req.user._id, req.query);
  res.json({ success: true, data: result });
});

export const countUnread = asyncHandler(async (req, res) => {
  const total = await notificationService.countUnreadNotifications(req.user._id);
  res.json({ success: true, data: { unreadTotal: total } });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead(
    req.params.id,
    req.user._id,
    req.user,
    req,
  );
  res.json({ success: true, data: { notification } });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(req.user._id, req.user, req);
  res.json({ success: true, data: result });
});

export default { list, countUnread, markRead, markAllRead };
