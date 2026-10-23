import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Document from '../models/Document.js';
import Member from '../models/Member.js';
import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { getPagination, paginationMeta } from '../utils/pagination.js';
import { writeAudit } from '../utils/audit.js';

function assertObjectId(id, label) {
  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${label} id.`, 'INVALID_IDENTIFIER');
  }
}

export async function createDocument({ file, body }, actor, req) {
  if (!file) throw ApiError.badRequest('Please choose a file to upload.', 'FILE_REQUIRED');

  if (body.memberId) {
    assertObjectId(body.memberId, 'member');
    const member = await Member.findById(body.memberId);
    if (!member) throw ApiError.notFound('Member not found.', 'MEMBER_NOT_FOUND');
  }

  const doc = await Document.create({
    title: body.title || file.originalname,
    description: body.description,
    category: body.category || 'other',
    member: body.memberId || undefined,
    file: {
      storedName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
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

  const storedName = path.basename(doc.file.storedName);
  const absolutePath = path.join(config.uploadDir, storedName);

  try {
    await fs.access(absolutePath);
  } catch {
    throw ApiError.notFound('The stored file is missing.', 'FILE_MISSING');
  }

  return {
    absolutePath,
    originalName: doc.file.originalName,
    mimeType: doc.file.mimeType,
  };
}

export async function deleteDocument(id, actor, req) {
  assertObjectId(id, 'document');
  const doc = await Document.findById(id);
  if (!doc) throw ApiError.notFound('Document not found.', 'DOCUMENT_NOT_FOUND');

  await doc.deleteOne();

  const absolutePath = path.join(config.uploadDir, path.basename(doc.file.storedName));
  await fs.unlink(absolutePath).catch(() => {});

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
