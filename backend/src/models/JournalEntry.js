import mongoose from 'mongoose';

const journalLineSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    code: { type: String, required: true },
    debitPaisa: { type: Number, default: 0, min: 0 },
    creditPaisa: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const journalEntrySchema = new mongoose.Schema(
  {
    entryNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    sourceType: {
      type: String,
      enum: ['savings_transaction', 'payment', 'expense', 'manual', 'opening'],
      default: 'savings_transaction',
      index: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    lines: {
      type: [journalLineSchema],
      validate: {
        validator: (lines) => Array.isArray(lines) && lines.length >= 2,
        message: 'A journal entry needs at least two lines',
      },
    },
    totalDebitPaisa: { type: Number, required: true, min: 1 },
    totalCreditPaisa: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['posted', 'void'], default: 'posted', index: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  },
);

journalEntrySchema.pre('validate', function validateBalance(next) {
  if (!Array.isArray(this.lines) || this.lines.length < 2) return next();

  const debit = this.lines.reduce((sum, line) => sum + Number(line.debitPaisa || 0), 0);
  const credit = this.lines.reduce((sum, line) => sum + Number(line.creditPaisa || 0), 0);

  this.totalDebitPaisa = debit;
  this.totalCreditPaisa = credit;

  if (debit !== credit) {
    return next(new Error(`Journal entry is unbalanced (debit ${debit} != credit ${credit})`));
  }
  return next();
});

journalEntrySchema.virtual('totalDebit').get(function totalDebit() {
  return Math.round(this.totalDebitPaisa || 0) / 100;
});

journalEntrySchema.virtual('totalCredit').get(function totalCredit() {
  return Math.round(this.totalCreditPaisa || 0) / 100;
});

/**
 * The ledger is append-only. Posted entries can never be edited or deleted;
 * corrections must be made with a new, balanced reversing entry.
 */
journalEntrySchema.pre('save', function preventJournalUpdate(next) {
  if (this.isNew) return next();
  return next(new Error('Journal entries are immutable. Post a reversing entry instead.'));
});

for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  journalEntrySchema.pre(operation, function preventJournalMutation(next) {
    return next(new Error('Journal entries are immutable. Post a reversing entry instead.'));
  });
}

export default mongoose.models.JournalEntry
  || mongoose.model('JournalEntry', journalEntrySchema);
