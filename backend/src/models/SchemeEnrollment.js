import mongoose from 'mongoose';

const schemeEnrollmentSchema = new mongoose.Schema(
  {
    enrollmentNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    scheme: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsScheme', required: true },
    startDate: { type: Date, required: true, default: Date.now },
    nextDueDate: { type: Date, required: true },
    maturityDate: Date,
    paidInstallments: { type: Number, default: 0, min: 0 },
    missedInstallments: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['active', 'completed', 'defaulted', 'cancelled'],
      default: 'active',
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

schemeEnrollmentSchema.index({ member: 1, scheme: 1, status: 1 });

export default mongoose.models.SchemeEnrollment
  || mongoose.model('SchemeEnrollment', schemeEnrollmentSchema);
