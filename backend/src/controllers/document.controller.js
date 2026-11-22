import { asyncHandler } from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import * as documentService from '../services/document.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await documentService.listDocuments(req.query);
  res.json({ success: true, data: result });
});

export const myDocuments = asyncHandler(async (req, res) => {
  if (!req.user.memberId) {
    return res.json({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } },
    });
  }
  const result = await documentService.listDocuments({
    ...req.query,
    memberId: String(req.user.memberId),
    visibility: 'member',
  });
  return res.json({ success: true, data: result });
});

export const upload = asyncHandler(async (req, res) => {
  const document = await documentService.createDocument(
    { file: req.file, body: req.body },
    req.user,
    req,
  );
  res.status(201).json({ success: true, data: { document } });
});

export const download = asyncHandler(async (req, res) => {
  const file = await documentService.getDocumentFile(req.params.id);

  let upstream;
  try {
    upstream = await fetch(file.url);
  } catch {
    throw ApiError.internal('Could not load the document file.', 'DOCUMENT_DOWNLOAD_FAILED');
  }
  if (!upstream.ok) {
    throw ApiError.notFound('Document file not found.', 'DOCUMENT_FILE_NOT_FOUND');
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const fileName = String(file.originalName || 'document').replace(/["\r\n]/g, '_');

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(buffer);
});

/**
 * Stream a document inline so browsers can preview it (PDFs especially).
 * Cloudinary serves raw uploads as application/octet-stream with
 * Content-Disposition: attachment, which browsers refuse to embed.
 */
export const preview = asyncHandler(async (req, res) => {
  const file = await documentService.getDocumentFile(req.params.id);

  let upstream;
  try {
    upstream = await fetch(file.url);
  } catch {
    throw ApiError.internal('Could not load the document file.', 'DOCUMENT_PREVIEW_FAILED');
  }
  if (!upstream.ok) {
    throw ApiError.notFound('Document file not found.', 'DOCUMENT_FILE_NOT_FOUND');
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const fileName = String(file.originalName || 'document').replace(/["\r\n]/g, '_');

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(buffer);
});

export const getById = asyncHandler(async (req, res) => {
  const document = await documentService.getDocumentById(req.params.id, req.user, req);
  res.json({ success: true, data: { document } });
});

export const remove = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.params.id, req.user, req);
  res.json({ success: true, data: { deleted: true } });
});

export default { list, myDocuments, upload, download, preview, getById, remove };
