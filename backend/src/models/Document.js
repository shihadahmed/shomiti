import mongoose from 'mongoose';
import { DOCUMENT_CATEGORY_VALUES, DOCUMENT_CATEGORIES } from '../config/constants.js';

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: DOCUMENT_CATEGORY_VALUES,
      default: DOCUMENT_CATEGORIES.OTHER,
      index: true,
    },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', index: true },
    file: {
      // Cloudinary fields
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      originalName: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true, min: 1 },
      resourceType: { type: String, enum: ['image', 'raw'], default: 'raw' },
      format: String,
      width: Number,
      height: Number,
    },
    visibility: { type: String, enum: ['staff', 'member'], default: 'staff' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

documentSchema.index({ createdAt: -1 });

export default mongoose.models.Document || mongoose.model('Document', documentSchema);
