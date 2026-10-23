import mongoose from 'mongoose';
import { EXPENSE_STATUS, EXPENSE_STATUS_VALUES, ROLES } from '../config/constants.js';

const expenseApprovalSchema = new mongoose.Schema(
  {
    role: { type: String, enum: [ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT, ROLES.SUPER_ADMIN], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    comment: { type: String, trim: true, maxlength: 500 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const expenseSchema = new mongoose.Schema(
  {
    expenseNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    amountPaisa: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: 'Amount must be integer paisa' },
    },
    payee: { type: String, trim: true, maxlength: 160 },
    paymentMethod: { type: String, enum: ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer'], default: 'cash' },
    description: { type: String, trim: true, maxlength: 1000 },
    attachment: {
      storedName: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },
    status: {
      type: String,
      enum: EXPENSE_STATUS_VALUES,
      default: EXPENSE_STATUS.DRAFT,
      index: true,
    },
    currentApproverRole: { type: String, enum: [ROLES.TREASURER, ROLES.GENERAL_SECRETARY, ROLES.PRESIDENT] },
    approvals: { type: [expenseApprovalSchema], default: [] },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },
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

expenseSchema.index({ status: 1, createdAt: -1 });
expenseSchema.index({ currentApproverRole: 1, status: 1 });

expenseSchema.virtual('amount').get(function amount() {
  return Math.round(this.amountPaisa || 0) / 100;
});

expenseSchema.virtual('nextApproverRole').get(function nextApproverRole() {
  const order = [EXPENSE_STATUS.PENDING_TREASURER, EXPENSE_STATUS.PENDING_GS, EXPENSE_STATUS.PENDING_PRESIDENT, EXPENSE_STATUS.APPROVED];
  const currentIdx = order.indexOf(this.status);
  if (currentIdx >= 0 && currentIdx < order.length - 1) {
    return order[currentIdx + 1].replace('pending_', '');
  }
  return null;
});

export default mongoose.models.Expense || mongoose.model('Expense', expenseSchema);