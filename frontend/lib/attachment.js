const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// This app uploads every non-image (including Word/Excel) to Cloudinary as a
// raw asset, so /raw/upload/ only implies PDF when nothing else identifies the
// file as a different document type.
const OTHER_DOCUMENT_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const OTHER_DOCUMENT_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx'];

/** Strip query strings and fragments so extension checks only see the path. */
export function stripUrlDecorations(url = '') {
  return String(url).split('#')[0].split('?')[0].toLowerCase();
}

/**
 * Classify an attachment for inline preview.
 *
 * Cloudinary URLs frequently have no file extension, so the MIME type and the
 * original filename are checked before the URL. Raw Cloudinary uploads
 * (`/raw/upload/`) are the delivery path used for PDFs in this app.
 *
 * @returns {'image' | 'pdf' | 'other'}
 */
export function getAttachmentKind(file) {
  const mimeType = String(file?.mimeType || '').toLowerCase();
  const fileName = String(file?.originalName || '').toLowerCase();
  const cleanUrl = stripUrlDecorations(file?.url);

  const isImage = IMAGE_MIME_TYPES.has(mimeType)
    || IMAGE_EXTENSIONS.some((ext) => fileName.endsWith(ext) || cleanUrl.endsWith(ext));
  if (isImage) return 'image';

  const isOtherDocument = OTHER_DOCUMENT_MIME_TYPES.has(mimeType)
    || OTHER_DOCUMENT_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  const isPdf = mimeType === 'application/pdf'
    || fileName.endsWith('.pdf')
    || cleanUrl.includes('.pdf')
    || (cleanUrl.includes('/raw/upload/') && !isOtherDocument);
  if (isPdf) return 'pdf';

  return 'other';
}
