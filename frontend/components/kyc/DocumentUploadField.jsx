'use client';

import React, { useId, useState } from 'react';
import { toast } from 'react-toastify';
import { useLang } from '@/lib/useLang';
import { apiUpload } from '@/lib/useApi';
import { Icon } from '@/components/ui/common';

function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(url) || /\/raw\/upload\//i.test(url);
}

function acceptsFile(accept, mimeType) {
  return accept
    .split(',')
    .map((entry) => entry.trim())
    .some((entry) => {
      if (!entry) return false;
      if (entry.endsWith('/*')) return mimeType.startsWith(entry.slice(0, -1));
      return entry === mimeType;
    });
}

/**
 * Upload control for KYC photographs and identity documents.
 * Files go through POST /api/upload and the resulting CDN URL is stored in the
 * parent form state, so the KYC submission only carries URLs.
 */
export default function DocumentUploadField({
  label,
  value,
  onChange,
  accept = 'image/jpeg,image/png',
  maxSizeMB = 2,
  hint,
  error,
  disabled = false,
  size = 'md',
  uploadLabel,
  changeLabel,
  onUploadingChange,
}) {
  const { tr } = useLang();
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  const setUploadingState = (next) => {
    setUploading(next);
    if (onUploadingChange) onUploadingChange(next);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!acceptsFile(accept, file.type)) {
      toast.error(tr('toast.fileTypeNotAllowed'));
      event.target.value = '';
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(tr('toast.fileSizeExceeded', { maxSizeMB }));
      event.target.value = '';
      return;
    }

    const data = new FormData();
    data.append('file', file);

    setUploadingState(true);
    try {
      const result = await apiUpload('/upload', data);
      if (result?.url) {
        onChange(result.url);
        toast.success(tr('toast.fileUploaded'));
      } else {
        toast.error(tr('toast.fileUploadFailed'));
      }
    } catch (uploadError) {
      toast.error(uploadError?.message || tr('toast.fileUploadFailed'));
    } finally {
      setUploadingState(false);
      event.target.value = '';
    }
  };

  const previewBox = size === 'sm'
    ? 'h-14 w-14 rounded-lg'
    : 'h-24 w-24 rounded-xl';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-3">
        <div
          className={`${previewBox} flex shrink-0 items-center justify-center overflow-hidden border border-brand-200 bg-white shadow-inner`}
        >
          {value ? (
            isPdfUrl(value) ? (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-rose-600 hover:text-rose-700"
                aria-label={tr('kyc.viewDocument')}
              >
                <Icon name="fileText" className="h-6 w-6" />
                <span className="text-[10px] font-bold">PDF</span>
              </a>
            ) : (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="h-full w-full"
                aria-label={tr('kyc.viewDocument')}
              >
                <img src={value} alt={label || ''} className="h-full w-full object-cover" />
              </a>
            )
          ) : (
            <Icon
              name={size === 'sm' ? 'camera' : 'fileText'}
              className="h-6 w-6 text-brand-400"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {!disabled && (
            <label
              htmlFor={inputId}
              className={`inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 ${
                uploading ? 'pointer-events-none opacity-70' : ''
              }`}
            >
              <Icon name={uploading ? 'refresh' : 'upload'} className={`h-3.5 w-3.5 ${uploading ? 'animate-spin' : ''}`} />
              {uploading
                ? tr('kyc.uploading')
                : value
                  ? changeLabel || tr('kyc.changeDocument')
                  : uploadLabel || tr('kyc.uploadDocument')}
              <input
                id={inputId}
                type="file"
                accept={accept}
                className="sr-only"
                disabled={disabled || uploading}
                onChange={handleFile}
              />
            </label>
          )}

          {value ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-brand-700 underline hover:text-brand-900"
              >
                {tr('kyc.viewDocument')}
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange('')}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  {tr('kyc.removeDocument')}
                </button>
              )}
            </div>
          ) : (
            !disabled && <span className="text-[11px] text-brand-400">{tr('kyc.noDocument')}</span>
          )}

          {hint && <span className="text-[10px] text-brand-500">{hint}</span>}
        </div>
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
