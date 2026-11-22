'use client';

import React, { useState } from 'react';
import { useLang } from '@/lib/useLang';
import { Icon, LoadingSpinner } from '@/components/ui/common';
import { getAttachmentKind } from '@/lib/attachment';
import { downloadFile } from '@/lib/download';

/**
 * Renders an inline preview for image and PDF attachments and keeps the
 * download/open actions reachable for every file type.
 */
export default function AttachmentPreview({ file, documentId, title, accent }) {
  const { tr } = useLang();
  const kind = getAttachmentKind(file);
  const fileName = file?.originalName || 'attachment';
  const [downloading, setDownloading] = useState(false);

  if (!file?.url) return null;

  // The backend streams the file inline with the correct Content-Type; raw
  // Cloudinary URLs cannot be embedded because they are served as
  // application/octet-stream with Content-Disposition: attachment.
  const previewUrl = `/api/documents/${documentId}/preview`;
  const downloadUrl = `/api/documents/${documentId}/file`;
  const openUrl = kind === 'pdf' ? previewUrl : file.url;
  const previewIcon = kind === 'image' ? 'image' : 'file';
  const accentText = accent?.border?.replace('border-', 'text-').replace('500', '600') || 'text-brand-600';

  const handleDownload = async (e) => {
    e.preventDefault();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadFile(downloadUrl, fileName);
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenInNewTab = (e) => {
    // For PDFs, use the preview endpoint which serves inline with correct headers
    // For images, use the direct Cloudinary URL
    e.preventDefault();
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* Attachment Preview */}
      <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-200 bg-brand-100/50">
          <h3 className="font-semibold text-brand-900 flex items-center gap-2">
            <Icon name={previewIcon} className="h-5 w-5" />
            {tr('documents.attachmentPreview')}
          </h3>
        </div>
        <div className="p-4">
          {kind === 'image' ? (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center"
              title={tr('documents.openInNewTab')}
            >
              <img
                src={file.url}
                alt={title || fileName}
                className="max-h-[600px] w-auto max-w-full mx-auto rounded-lg object-contain shadow-xs"
              />
            </a>
          ) : kind === 'pdf' ? (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              title={title || fileName}
              className="h-[600px] w-full rounded-lg border-0"
            />
          ) : (
            <div className="flex items-center justify-center gap-4 py-8 text-center">
              <Icon name="file" className="h-16 w-16 text-brand-300" />
              <div>
                <p className="text-brand-600 font-medium">{fileName}</p>
                <p className="text-sm text-brand-400 mt-1">{tr('documents.previewUnavailable')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachment actions */}
      <div className="rounded-xl border-2 border-brand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${accent?.bg || ''} ${accent?.border || ''}`}>
              <Icon name={previewIcon} className={`h-7 w-7 ${accentText}`} />
            </div>
            <div>
              <p className="font-semibold text-brand-900">{tr('documents.attachment')}</p>
              <p className="text-sm text-brand-500">{fileName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="btn btn-secondary whitespace-nowrap"
            >
              <Icon name="externalLink" className="h-4 w-4" />
              {tr('documents.openInNewTab')}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="btn btn-primary whitespace-nowrap"
            >
              {downloading ? (
                <>
                  <LoadingSpinner size="sm" className="h-4 w-4" />
                  {tr('documents.downloading')}
                </>
              ) : (
                <>
                  <Icon name="download" className="h-4 w-4" />
                  {tr('documents.download')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}