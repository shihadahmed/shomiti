import mongoose from 'mongoose';
import {
  APPROVAL_ENTITY_VALUES,
  APPROVAL_STATUS,
  APPROVAL_STATUS_VALUES,
} from '../config/constants.js';

const approvalActionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    note: { type: String, trim: true, maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const approvalRequestSchema = new mongoose.Schema(
  {
    requestNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    entityType: { type: String, enum: APPROVAL_ENTITY_VALUES, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, trim: true, maxlength: 120 },
    amountPaisa: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: APPROVAL_STATUS_VALUES,
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },
    requiredApprovals: { type: Number, default: 1, min: 1, max: 3 },
    approvals: { type: [approvalActionSchema], default: [] },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    decidedAt: Date,
    policy: { type: String, trim: true, maxlength: 120 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

approvalRequestSchema.index({ status: 1, createdAt: -1 });

approvalRequestSchema.virtual('amount').get(function amount() {
  return Math.round(this.amountPaisa || 0) / 100;
});

approvalRequestSchema.virtual('approvalCount').get(function approvalCount() {
  return (this.approvals || []).filter((entry) => entry.decision === 'approved').length;
});

export default mongoose.models.ApprovalRequest
  || mongoose.model('ApprovalRequest', approvalRequestSchema);
