import mongoose from 'mongoose';
import { SAVINGS_TYPE_VALUES, SAVINGS_DUE_STATUS, SAVINGS_DUE_STATUS_VALUES } from '../config/constants.js';

const savingsDueSchema = new mongoose.Schema(
  {
    dueNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    savingsType: { type: String, enum: SAVINGS_TYPE_VALUES, required: true, index: true },
    period: { type: String, required: true }, // e.g., "2026-01", "2026-H1", "2026-H2"
    principalPaisa: { type: Number, required: true, min: 0 },
    lateFeePaisa: { type: Number, default: 0, min: 0 },
    totalDuePaisa: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: SAVINGS_DUE_STATUS_VALUES,
      default: SAVINGS_DUE_STATUS.DUE,
      index: true,
    },
    paidAt: Date,
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

savingsDueSchema.index({ member: 1, savingsType: 1, period: 1 }, { unique: true });
savingsDueSchema.index({ status: 1, dueDate: 1 });

savingsDueSchema.virtual('principal').get(function principal() {
  return Math.round(this.principalPaisa || 0) / 100;
});

savingsDueSchema.virtual('lateFee').get(function lateFee() {
  return Math.round(this.lateFeePaisa || 0) / 100;
});

savingsDueSchema.virtual('totalDue').get(function totalDue() {
  return Math.round(this.totalDuePaisa || 0) / 100;
});

savingsDueSchema.virtual('isOverdue').get(function isOverdue() {
  return this.status === SAVINGS_DUE_STATUS.DUE && new Date() > this.dueDate;
});

export default mongoose.models.SavingsDue
  || mongoose.model('SavingsDue', savingsDueSchema);