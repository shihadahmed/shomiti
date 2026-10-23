import mongoose from 'mongoose';
import { MEMBER_STATUS, MEMBER_STATUS_VALUES } from '../config/constants.js';

const addressSchema = new mongoose.Schema(
  {
    village: { type: String, trim: true, maxlength: 120 },
    postOffice: { type: String, trim: true, maxlength: 120 },
    upazila: { type: String, trim: true, maxlength: 120 },
    district: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const nomineeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    relation: { type: String, required: true, trim: true, maxlength: 60 },
    nid: { type: String, required: true, trim: true, maxlength: 30 },
    phone: { type: String, trim: true, maxlength: 20 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    photo: {
      storedName: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },
  },
  { _id: true },
);

const memberSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    fullNameBn: { type: String, trim: true, maxlength: 160 },
    fatherName: { type: String, trim: true, maxlength: 160 },
    motherName: { type: String, trim: true, maxlength: 160 },
    spouseName: { type: String, trim: true, maxlength: 160 },
    nid: { type: String, required: true, unique: true, trim: true },
    dateOfBirth: Date,
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    address: { type: addressSchema, default: () => ({}) },
    occupation: { type: String, trim: true, maxlength: 120 },
    photo: {
      storedName: String,
      originalName: String,
      mimeType: String,
      size: Number,
    },
    joinDate: { type: Date, default: Date.now },
    status: { type: String, enum: MEMBER_STATUS_VALUES, default: MEMBER_STATUS.ACTIVE, index: true },
    shareCount: { type: Number, default: 1, min: 1 },
    nominees: { type: [nomineeSchema], default: [] },
    notes: { type: String, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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

memberSchema.index({ fullName: 'text', code: 'text', phone: 'text', fullNameBn: 'text', email: 'text' });
memberSchema.index({ createdAt: -1 });
memberSchema.index({ status: 1, isActive: 1 });

memberSchema.virtual('age').get(function age() {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.dateOfBirth).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
});

memberSchema.virtual('hasPhoto').get(function hasPhoto() {
  return Boolean(this.photo?.storedName);
});

memberSchema.virtual('nomineeTotalPercentage').get(function nomineeTotalPercentage() {
  return (this.nominees || []).reduce((sum, n) => sum + (n.percentage || 0), 0);
});

memberSchema.virtual('totalSavings').get(function totalSavings() {
  // This would be populated from SavingsAccount
  return 0;
});

memberSchema.pre('validate', function validateNominees(next) {
  const nominees = this.nominees || [];
  if (nominees.length > 0) {
    const total = nominees.reduce((sum, n) => sum + (n.percentage || 0), 0);
    if (total !== 100) {
      return next(new Error('Nominee percentages must sum to exactly 100%'));
    }
    const dupes = nominees.filter((n, i, arr) => arr.findIndex((x) => x.nid === n.nid) !== i);
    if (dupes.length) {
      return next(new Error('Duplicate nominee NIDs are not allowed'));
    }
  }
  next();
});

export default mongoose.models.Member || mongoose.model('Member', memberSchema);