'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiGet, apiPost, apiDelete } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { toast } from 'react-toastify';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, Badge, Modal, Pagination, SearchInput, FilterBar, formatDate } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const MEETING_CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'notice', label: 'Notice' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'resolution', label: 'Resolution' },
];

const VISIBILITY_OPTIONS = [
  { value: 'staff', label: 'Staff Only' },
  { value: 'member', label: 'Member Visible' },
];

const CATEGORY_ACCENTS = {
  notice: { bg: 'bg-indigo-50', border: 'border-indigo-500', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'FileText', label: 'Notice' },
  meeting: { bg: 'bg-emerald-50', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'Users', label: 'Meeting' },
  resolution: { bg: 'bg-amber-50', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'FileText', label: 'Resolution' },
  default: { bg: 'bg-rose-50', border: 'border-rose-500', badge: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'Folder', label: 'Other' },
};

const canCreateDocument = (user) => {
  if (!user) return false;
  const staffRoles = ['super_admin', 'treasurer', 'general_secretary', 'president'];
  return staffRoles.includes(user.role);
};

function isNew(createdAt) {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

export default function MeetingsPage() {
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'notice',
    description: '',
    visibility: 'staff',
    file: null,
  });
  const [formErrors, setFormErrors] = useState({});

  const queryParams = {
    page,
    limit: 10,
    search: search || undefined,
    category: categoryFilter,
  };

  const { data, loading, error, reload } = useApi('/documents', queryParams, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [mounted, checking, isAuthenticated]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setPage(1);
    reload();
  }, [reload]);

  const applyUrlSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const openUpload = () => {
    setForm({
      title: '',
      category: 'notice',
      description: '',
      visibility: 'staff',
      file: null,
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({
      title: '',
      category: 'notice',
      description: '',
      visibility: 'staff',
      file: null,
    });
    setFormErrors({});
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        setFormErrors({ file: 'File size must be less than 5 MB.' });
        return;
      }
      setForm(prev => ({ ...prev, file, title: prev.title || file.name }));
      setFormErrors(prev => ({ ...prev, file: undefined }));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!form.file) {
      setFormErrors({ file: tr('validation.required') });
      return;
    }

    if (!form.title) {
      setFormErrors({ title: tr('validation.required') });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', form.file);
      formData.append('title', form.title);
      formData.append('category', form.category);
      formData.append('description', form.description);
      formData.append('visibility', form.visibility);

      await apiPost('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(tr('toast.created'));
      closeModal();
      reload();
    } catch (requestError) {
      setFormErrors({ submit: requestError?.message || tr('error.generic') });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (docId, originalName) => {
    try {
      const blob = await apiGet(`/documents/${docId}/file`, {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  if (!mounted || checking) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  const documents = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1, limit: 10 };
  const canUpload = canCreateDocument(user);

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />
      
      {/* Page Header with Create Button */}
      <PageHeader
        title={tr('nav.meetings')}
        subtitle={tr('admin.meetingScheduler') || 'Manage meetings, resolutions and notices'}
        actions={
          canUpload && (
            <Button variant="primary" onClick={openUpload} className="whitespace-nowrap">
              <Icon name="plus" className="h-4 w-4" />
              {tr('documents.upload') || 'Upload Document'}
            </Button>
          )
        }
      />

      {/* Search & Filter Bar */}
      <div className="card card-pad mb-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 items-stretch">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('documents.searchPlaceholder') || 'Search notices & meetings...'}
            className="flex-1 min-w-[280px]"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            options={MEETING_CATEGORIES}
            className="w-full sm:w-[200px]"
          />
          <Button type="submit" variant="primary" className="whitespace-nowrap sm:w-auto">
            <Icon name="filter" className="h-4 w-4" />
            Filter
          </Button>
        </form>
      </div>

      {/* Section Header with Title and Pagination Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-1 rounded-full bg-brand-700" />
          <h2 className="text-lg font-semibold text-brand-900">
            {tr('meetings.allNoticesMeetings') || 'All Notices & Meetings'}
          </h2>
        </div>
        <div className="text-sm text-brand-600 font-mono">
          {meta.total > 0
            ? `${(page - 1) * meta.limit + 1}–${Math.min(page * meta.limit, meta.total)} of ${meta.total}`
            : `0 of 0`}
        </div>
      </div>

      {/* Horizontal Cards List */}
      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />
        ) : documents.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('documents.empty') || 'No documents found'}
            description={categoryFilter
              ? `No ${MEETING_CATEGORIES.find(c => c.value === categoryFilter)?.label.toLowerCase()} found.`
              : 'No meetings, resolutions or notices uploaded yet.'}
            action={
              canUpload && (
                <Button variant="primary" onClick={openUpload}>
                  <Icon name="plus" className="h-4 w-4" />
                  {tr('documents.upload') || 'Upload Document'}
                </Button>
              )
            }
            className="p-12"
          />
        ) : (
          <>
            <div className="divide-y divide-brand-200">
              {documents.map((doc, index) => {
                const category = doc.category || 'default';
                const accent = CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.default;
                const AccentIcon = accent.icon;
                const dateObj = doc.createdAt ? new Date(doc.createdAt) : null;
                const day = dateObj ? dateObj.getDate().toString().padStart(2, '0') : '—';
                const month = dateObj ? dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '—';
                const fullDate = formatDate(doc.createdAt, { time: false });
                const hasAttachment = doc.file?.url;
                const isNewItem = isNew(doc.createdAt);

                return (
                  <Link
                    key={doc._id}
                    href={`/meetings/${doc._id}`}
                    className={`relative flex flex-col sm:flex-row items-start gap-4 p-4 sm:p-5 transition-all hover:bg-brand-50/50 border-l-4 ${accent.border} ${accent.bg} group`}
                    style={{ borderLeftWidth: '4px' }}
                  >
                    {/* Left Date Badge */}
                    <div className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-3 py-2.5 text-center min-w-[60px] ${accent.border} bg-white shadow-sm`}>
                      <span className="text-2xl font-bold text-brand-900 leading-none">{day}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 mt-0.5">{month}</span>
                    </div>

                    {/* Center Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="font-semibold text-brand-900 text-base sm:text-lg line-clamp-1 group-hover:text-brand-700 transition-colors">{doc.title}</h3>
                      
                      {/* Description preview */}
                      {doc.description && (
                        <p className="mt-1 text-sm text-brand-500 line-clamp-2 max-w-2xl">{doc.description}</p>
                      )}

                      {/* Metadata Row */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                        {/* Category Pill Badge with Icon */}
                        <Badge variant="default" className={`${accent.badge} flex items-center gap-1.5 px-2.5 py-0.5`}>
                          <Icon name={accent.icon} className="h-3.5 w-3.5" />
                          {accent.label}
                        </Badge>

                        {/* Calendar Date */}
                        <span className="flex items-center gap-1.5 text-brand-600">
                          <Icon name="calendar" className="h-4 w-4 text-brand-400" />
                          {fullDate}
                        </span>

                        {/* Attachment indicator */}
                        {hasAttachment && (
                          <span className="flex items-center gap-1.5 text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-full">
                            <Icon name="paperclip" className="h-3.5 w-3.5 text-brand-400" />
                            <span className="font-medium text-brand-700">{tr('documents.attachment') || 'Attachment'}</span>
                          </span>
                        )}

                        {/* NEW badge */}
                        {isNewItem && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider">
                            NEW
                          </span>
                        )}

                        {/* Uploaded by */}
                        {doc.uploadedBy && (
                          <span className="flex items-center gap-1.5 text-brand-500">
                            <Icon name="user" className="h-3.5 w-3.5" />
                            {doc.uploadedBy.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Action Trigger - now part of the link */}
                    <div className="flex-shrink-0 flex items-center justify-center sm:justify-end w-full sm:w-auto mt-4 sm:mt-0">
                      <div className={`btn-icon h-10 w-10 rounded-full transition-all flex items-center justify-center ${accent.bg} group-hover:bg-opacity-80 ${accent.border.replace('border-', 'text-').replace('500', '600')}`} aria-hidden="true">
                        <Icon name="chevronRight" className="h-5 w-5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Footer Pagination */}
            {meta.pages > 1 && (
              <div className="border-t border-brand-200 px-5 py-4">
                <Pagination meta={meta} onPage={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={showModal}
        onClose={closeModal}
        form={form}
        errors={formErrors}
        onChange={setForm}
        onFileChange={handleFileChange}
        uploading={uploading}
        onSubmit={handleUpload}
      />
    </AppShell>
  );
}

function UploadModal({ open, onClose, form, errors, onChange, onFileChange, uploading, onSubmit }) {
  const { tr } = useLang();

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('documents.upload') || 'Upload Document'} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('documents.details') || 'Document Details'}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={tr('documents.titleField') || 'Title'}
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              error={errors.title}
              required
            />
            <Select
              label={tr('documents.category') || 'Category'}
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              required
              options={MEETING_CATEGORIES.filter(c => c.value)}
            />
            <Select
              label={tr('documents.visibility') || 'Visibility'}
              value={form.visibility}
              onChange={(e) => onChange({ ...form, visibility: e.target.value })}
              required
              options={VISIBILITY_OPTIONS}
            />
            <div className="sm:col-span-2">
              <label className="label">{tr('documents.file') || 'File'}</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={onFileChange}
                  className="input"
                  aria-describedby="file-hint"
                />
                {errors.file && <p className="field-error">{errors.file}</p>}
                <p id="file-hint" className="hint">{tr('documents.hint') || 'PDF, DOC, XLS, JPG, PNG up to 5MB'}</p>
              </div>
            </div>
            <Input
              label={tr('documents.description') || 'Description'}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              className="sm:col-span-2"
              multiline
              rows={3}
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={uploading} loadingLabel={tr('common.saving')}>
            {tr('documents.upload') || 'Upload'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}