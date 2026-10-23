import mongoose from 'mongoose';
import { SAVINGS_TYPE_VALUES } from '../config/constants.js';
import { BUSINESS_RULES } from '../config/constants.js';

const savingsSchemeSchema = new mongoose.Schema(
  {
    savingsType: { type: String, enum: SAVINGS_TYPE_VALUES, required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameBn: { type: String, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000 },
    principalPaisa: { type: Number, required: true, min: 0 },
    lateFeePercent: { type: Number, default: BUSINESS_RULES.LATE_FEE_PERCENT, min: 0, max: 100 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

savingsSchemeSchema.virtual('principal').get(function principal() {
  return Math.round(this.principalPaisa || 0) / 100;
});

savingsSchemeSchema.virtual('lateFeePaisa').get(function lateFeePaisa() {
  return Math.round((this.principalPaisa || 0) * (this.lateFeePercent || 0) / 100);
});

savingsSchemeSchema.virtual('totalWithLateFee').get(function totalWithLateFee() {
  return (this.principalPaisa || 0) + Math.round((this.principalPaisa || 0) * (this.lateFeePercent || 0) / 100);
});

export default mongoose.models.SavingsScheme
  || mongoose.model('SavingsScheme', savingsSchemeSchema);
