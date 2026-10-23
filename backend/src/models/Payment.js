import mongoose from 'mongoose';
import { PAYMENT_METHOD_VALUES, PAYMENT_STATUS, PAYMENT_STATUS_VALUES } from '../config/constants.js';

const paymentSchema = new mongoose.Schema(
  {
    paymentNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    savingsDue: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsDue', index: true },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsTransaction' },
    method: { type: String, enum: PAYMENT_METHOD_VALUES, required: true },
    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Amount must be integer paisa' },
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    providerRef: { type: String, trim: true, maxlength: 120 },
    senderNumber: { type: String, trim: true, maxlength: 30 },
    bankName: { type: String, trim: true, maxlength: 120 },
    paidAt: Date,
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: Date,
    receiptNo: { type: String, trim: true, uppercase: true },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

paymentSchema.virtual('amount').get(function amount() {
  return Math.round(this.amountPaisa || 0) / 100;
});

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
