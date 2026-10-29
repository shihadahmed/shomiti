import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { writeAudit } from '../utils/audit.js';
import { NOTIFICATION_TYPE } from '../config/constants.js';

/** Create an in-app notification (bell icon) for a user. */
export async function createNotification(
  { userId, type, title, message, link, metadata, actor, req, session },
) {
  const notification = await Notification.create(
    [
      {
        user: userId,
        type,
        title,
        message,
        link,
        metadata: metadata || null,
      },
    ],
    session ? { session } : {},
  );

  try {
    await writeAudit({
      actor: actor || userId,
      action: `notification.${type}`,
      entityType: 'Notification',
      entityId: notification[0]._id,
      after: notification[0],
      req,
      session,
    });
  } catch {
    // Audit failures must not break notification delivery.
  }

  return notification[0];
}

/** List notifications for a user with pagination. */
export async function listNotifications(userId, query = {}) {
  const { page = 1, limit = 20, unread } = query;
  const skip = (page - 1) * limit;

  const filter = { user: userId };
  if (unread === 'true') filter.isRead = false;

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ isRead: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    items,
    meta: paginationMeta(total, page, limit),
    unreadTotal: await Notification.countDocuments({ user: userId, isRead: false }),
  };
}

/** Count unread notifications for a user. */
export async function countUnreadNotifications(userId) {
  return Notification.countDocuments({ user: userId, isRead: false });
}

/** Mark a single notification as read (owned by user). */
export async function markNotificationRead(notificationId, userId, actor, req) {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw ApiError.badRequest('Invalid notification id.', 'INVALID_IDENTIFIER');
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  );
  if (!notification) {
    throw ApiError.notFound('Notification not found.', 'NOTIFICATION_NOT_FOUND');
  }

  await writeAudit({
    actor: actor || userId,
    action: 'notification.read',
    entityType: 'Notification',
    entityId: notification._id,
    after: notification,
    req,
  });

  return notification;
}

/** Mark all unread notifications as read for a user. */
export async function markAllNotificationsRead(userId, actor, req) {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );

  await writeAudit({
    actor: actor || userId,
    action: 'notification.read_all',
    entityType: 'Notification',
    entityId: userId,
    after: { matched: result.matchedCount, modified: result.modifiedCount },
    req,
  });

  return { matched: result.matchedCount, modified: result.modifiedCount };
}

export default {
  createNotification,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
