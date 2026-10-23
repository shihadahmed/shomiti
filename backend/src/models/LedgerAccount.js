import mongoose from 'mongoose';

const ledgerAccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    nameBn: { type: String, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: ['asset', 'liability', 'equity', 'income', 'expense'],
      required: true,
    },
    normalBalance: { type: String, enum: ['debit', 'credit'], required: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.models.LedgerAccount
  || mongoose.model('LedgerAccount', ledgerAccountSchema);
