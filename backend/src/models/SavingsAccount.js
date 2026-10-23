import mongoose from 'mongoose';
import { SAVINGS_ACCOUNT_TYPE_VALUES, SAVINGS_ACCOUNT_TYPES } from '../config/constants.js';

const savingsAccountSchema = new mongoose.Schema(
  {
    accountNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    type: {
      type: String,
      enum: SAVINGS_ACCOUNT_TYPE_VALUES,
      default: SAVINGS_ACCOUNT_TYPES.GENERAL,
      index: true,
    },
    balancePaisa: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

savingsAccountSchema.index({ member: 1, type: 1 });

savingsAccountSchema.virtual('balance').get(function balance() {
  return Math.round(this.balancePaisa || 0) / 100;
});

export default mongoose.models.SavingsAccount
  || mongoose.model('SavingsAccount', savingsAccountSchema);
