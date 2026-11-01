import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Member from '../models/Member.js';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { writeAudit } from '../utils/audit.js';
import cloudinary from '../config/cloudinary.js';
import { uploadToCloudinary, MAX_FILE_SIZE } from '../middleware/upload.js';

function assertObjectId(id, label) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label} id.`, 'INVALID_IDENTIFIER');
  }
}

export async function createDocument({ file, body }, actor, req) {
  if (!file) throw ApiError.badRequest('Please choose a file to upload.', 'FILE_REQUIRED');

  // Size ceiling is enforced by multer (see middleware/upload.js). A minimum
  // size check here would reject perfectly valid small scans and photos.
  if (file.size > MAX_FILE_SIZE) {
    throw ApiError.badRequest('File size must not exceed 5MB.', 'FILE_TOO_LARGE');
  }

  if (body.memberId) {
    assertObjectId(body.memberId, 'member');
    const member = await Member.findById(body.memberId);
    if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');
  }

  // Upload to Cloudinary
  const folder = body.memberId ? `shopnonir/members/${body.memberId}/documents` : 'shopnonir/documents';
  const uploadResult = await uploadToCloudinary(file.buffer, {
    originalName: file.originalname,
    mimeType: file.mimetype,
    folder,
  });

  const doc = await Document.create({
    title: body.title || file.originalname,
    description: body.description,
    category: body.category || 'other',
    member: body.memberId || undefined,
    file: {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      resourceType: uploadResult.resource_type,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
    },
    visibility: body.visibility || 'staff',
    uploadedBy: actor._id,
  });

  await writeAudit({
    actor: actor._id,
    action: 'document.uploaded',
    entityType: 'Document',
    entityId: doc._id,
    after: doc,
    req,
  });

  return doc;
}

export async function listDocuments(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.visibility) filter.visibility = query.visibility;
  if (query.memberId) {
    assertObjectId(query.memberId, 'member');
    filter.member = query.memberId;
  }
  if (query.search?.trim()) {
    filter.title = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const [items, total] = await Promise.all([
    Document.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('member', 'code fullName')
      .populate('uploadedBy', 'name'),
    Document.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

export async function getDocumentFile(id) {
  assertObjectId(id, 'document');
  const doc = await Document.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.', 'DOCUMENT_NOT_FOUND');

  // Return Cloudinary URL for direct access
  return {
    url: doc.file.url,
    publicId: doc.file.publicId,
    originalName: doc.file.originalName,
    mimeType: doc.file.mimeType,
    size: doc.file.size,
    resourceType: doc.file.resourceType,
  };
}

export async function deleteDocument(id, actor, req) {
  assertObjectId(id, 'document');
  const doc = await Document.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.', 'DOCUMENT_NOT_FOUND');

  // Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(doc.file.publicId, {
      resource_type: doc.file.resourceType,
    });
  } catch (error) {
    console.error('[Document Service] Failed to delete from Cloudinary:', error);
    // Continue with DB deletion even if Cloudinary delete fails
  }

  await doc.deleteOne();

  await writeAudit({
    actor: actor._id,
    action: 'document.deleted',
    entityType: 'Document',
    entityId: doc._id,
    before: doc,
    req,
  });
}

export default {
  createDocument,
  listDocuments,
  getDocumentFile,
  deleteDocument,
};