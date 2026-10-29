import mongoose from 'mongoose';
import { NOTIFICATION_TYPE, NOTIFICATION_TYPE_VALUES } from '../config/constants.js';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPE_VALUES,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true, maxlength: 300 },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Notification
  || mongoose.model('Notification', notificationSchema);
