import { asyncHandler } from '../utils/asyncHandler.js';
import * as documentService from '../services/document.service.js';

export const list = asyncHandler(async (req, res) => {
  const result = await documentService.listDocuments(req.query);
  res.json({ success: true, data: result });
});

export const myDocuments = asyncHandler(async (req, res) => {
  if (!req.user.member) {
    return res.json({
      success: true,
      data: { items: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } },
    });
  }
  const result = await documentService.listDocuments({
    ...req.query,
    memberId: String(req.user.member),
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
  if (req.query.inline === '1' && file.mimeType.startsWith('image/')) {
    return res.type(file.mimeType).sendFile(file.absolutePath);
  }
  return res.download(file.absolutePath, file.originalName);
});

export const remove = asyncHandler(async (req, res) => {
  await documentService.deleteDocument(req.params.id, req.user, req);
  res.json({ success: true, data: { deleted: true } });
});

export default { list, myDocuments, upload, download, remove };
