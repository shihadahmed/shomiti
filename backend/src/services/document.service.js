import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { writeAudit } from '../utils/audit.js';
import cloudinary from '../config/cloudinary.js';
import { uploadToCloudinary, MAX_FILE_SIZE } from '../middleware/upload.js';
import { createNotification } from './notification.service.js';

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

  // Validate memberId if provided (for folder organization)
  if (body.memberId) {
    assertObjectId(body.memberId, 'member');
    const member = await Member.findById(body.memberId);
    if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');
  }

  // Validate mentionedMemberId when visibility is 'specific'
  let mentionedMember = null;
  if (body.visibility === 'specific') {
    if (!body.mentionedMemberId) {
      throw ApiError.badRequest('Member must be specified when visibility is "Specific Member".', 'MEMBER_REQUIRED');
    }
    assertObjectId(body.mentionedMemberId, 'member');
    mentionedMember = await Member.findById(body.mentionedMemberId);
    if (!mentionedMember) throw ApiError.notFound('Mentioned member not found.', 'MEMBER_NOT_FOUND');
  } else if (body.visibility === 'all' && body.mentionedMemberId) {
    // Ignore mentionedMemberId when visibility is 'all' (security: prevent hidden targeting)
    // Do not throw, just ignore silently
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
    mentionedMember: mentionedMember?._id || undefined,
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
    visibility: body.visibility || 'all',
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

  // Send targeted notifications after document creation
  await sendDocumentNotifications(doc, actor, req);

  return doc;
}

/**
 * Send targeted notifications based on document visibility
 * Case A - All Members: Notify all active users EXCEPT the sender
 * Case B - Specific Member: Notify ONLY the mentioned member's linked user (if not sender)
 * Never send self-notification
 */
async function sendDocumentNotifications(doc, actor, req) {
  const notificationLink = `/meetings/${doc._id}`;
  const notificationTitle = doc.category === 'notice' ? 'New Notice Published' : 'New Document Uploaded';
  const notificationMessage = `"${doc.title}" has been published.`;

  if (doc.visibility === 'all') {
    // Case A: All Members - notify all active users except sender
    // Using insertMany for bulk efficiency; createNotification is used for single notifications
    const users = await User.find({ _id: { $ne: actor._id }, isActive: true }).select('_id').lean();
    
    const notifications = users.map(user => ({
      user: user._id,
      type: 'system',
      title: notificationTitle,
      message: notificationMessage,
      link: notificationLink,
      metadata: { documentId: doc._id, category: doc.category },
    }));

    if (notifications.length > 0) {
      await mongoose.model('Notification').insertMany(notifications);
    }
  } else if (doc.visibility === 'specific' && doc.mentionedMember) {
    // Case B: Specific Member - notify only the mentioned member's linked user
    // Find the user linked to the mentioned member
    const mentionedUser = await User.findOne({ memberId: doc.mentionedMember, isActive: true }).select('_id').lean();
    
    // SECURITY: Never send self-notification - check both sender and mentioned user
    if (mentionedUser && !mentionedUser._id.equals(actor._id)) {
      // Only send if mentioned user exists and is not the sender
      await createNotification({
        userId: mentionedUser._id,
        type: 'system',
        title: notificationTitle,
        message: `A notice has been issued for you (${doc.mentionedMember?.code || 'Member'}): "${doc.title}"`,
        link: notificationLink,
        metadata: { documentId: doc._id, category: doc.category, mentionedMemberId: doc.mentionedMember?.toString() },
        actor: actor._id,
        req,
      });
    }
  }
}

export async function listDocuments(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.category) filter.category = query.category;
  // Note: visibility filter removed - public notice board shows all documents to authenticated users
  if (query.memberId) {
    assertObjectId(query.memberId, 'member');
    filter.member = query.memberId;
  }
  if (query.mentionedMemberId) {
    assertObjectId(query.mentionedMemberId, 'member');
    filter.mentionedMember = query.mentionedMemberId;
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
      .populate('mentionedMember', 'code fullName')
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

export async function getDocumentById(id, actor, req) {
  assertObjectId(id, 'document');
  const doc = await Document.findById(id)
    .populate('member', 'code fullName')
    .populate('mentionedMember', 'code fullName')
    .populate('uploadedBy', 'name');
  if (!doc) throw ApiError.notFound('Document not found.', 'DOCUMENT_NOT_FOUND');

  // Public notice board - all authenticated users can view all documents
  // No visibility restrictions applied

  return doc;
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