import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  category: { type: String, required: true },
  actions: [{
    action: { type: String, required: true },
    label: { type: String, required: true },
    description: String,
  }],
}, { _id: false });

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
  description: { type: String, required: true, trim: true, maxlength: 300 },
  isSystemLocked: { type: Boolean, default: false },
  permissions: { type: [String], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret.__v;
      return ret;
    },
  },
});

roleSchema.virtual('userCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'role',
  count: true,
});

roleSchema.virtual('permissionCount').get(function () {
  return this.permissions?.length || 0;
});

export default mongoose.models.Role || mongoose.model('Role', roleSchema);