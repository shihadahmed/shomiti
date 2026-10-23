import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, trim: true, maxlength: 120, index: true },
    entityType: { type: String, trim: true, maxlength: 80 },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 300 },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

auditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
