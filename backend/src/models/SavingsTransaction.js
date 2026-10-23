import mongoose from 'mongoose';
import {
  PAYMENT_METHOD_VALUES,
  TRANSACTION_STATUS,
  TRANSACTION_STATUS_VALUES,
  TRANSACTION_TYPE_VALUES,
} from '../config/constants.js';

const savingsTransactionSchema = new mongoose.Schema(
  {
    txnNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsAccount', required: true },
    savingsDue: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsDue', index: true },
    type: { type: String, enum: TRANSACTION_TYPE_VALUES, required: true },
    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Amount must be integer paisa' },
    },
    method: { type: String, enum: PAYMENT_METHOD_VALUES, required: true },
    status: {
      type: String,
      enum: TRANSACTION_STATUS_VALUES,
      default: TRANSACTION_STATUS.POSTED, // Savings transactions are posted when payment is confirmed
      index: true,
    },
    balanceAfterPaisa: { type: Number, min: 0, default: null },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    receiptNo: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 500 },
    idempotencyKey: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        delete ret.idempotencyKey;
        return ret;
      },
    },
  },
);

savingsTransactionSchema.index({ member: 1, createdAt: -1 });
savingsTransactionSchema.index({ status: 1, createdAt: -1 });
savingsTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

savingsTransactionSchema.virtual('amount').get(function amount() {
  return Math.round(this.amountPaisa || 0) / 100;
});

savingsTransactionSchema.virtual('balanceAfter').get(function balanceAfter() {
  return this.balanceAfterPaisa == null ? null : Math.round(this.balanceAfterPaisa) / 100;
});

export default mongoose.models.SavingsTransaction
  || mongoose.model('SavingsTransaction', savingsTransactionSchema);
