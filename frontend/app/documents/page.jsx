'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiGet, apiPost, apiDelete } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatDate, StatusBadge, Pagination, SearchInput, FilterBar, Modal } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'resolution', label: 'Resolution' },
  { value: 'notice', label: 'Notice' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'photo', label: 'Photo' },
  { value: 'policy', label: 'Policy' },
  { value: 'member', label: 'Member Document' },
  { value: 'other', label: 'Other' },
];

const VISIBILITY_OPTIONS = [
  { value: 'staff', label: 'Staff Only' },
  { value: 'member', label: 'Member Visible' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'other',
    memberId: '',
    description: '',
    visibility: 'staff',
    file: null,
  });
  const [formErrors, setFormErrors] = useState({});

  const queryParams = {
    page,
    limit: 15,
    search: search || undefined,
    category: categoryFilter,
    visibility: visibilityFilter,
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
      router.replace('/login');
    }
  }, [mounted, checking, isAuthenticated, router]);

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
      category: 'other',
      memberId: '',
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
      category: 'other',
      memberId: '',
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
      if (form.memberId) formData.append('memberId', form.memberId);

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

  const handleDelete = async (docId) => {
    if (!window.confirm(tr('documents.deleteConfirm'))) return;
    try {
      await apiDelete(`/documents/${docId}`);
      toast.success(tr('toast.deleted'));
      reload();
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
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />
      <PageHeader
        title={tr('documents.title')}
        subtitle={tr('documents.subtitle')}
        actions={
          <Button variant="primary" onClick={openUpload}>
            <Icon name="upload" className="h-4 w-4" />
            {tr('documents.upload')}
          </Button>
        }
      />

      <form onSubmit={handleSearch} className="mb-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('documents.searchPlaceholder')}
            className="flex-1 min-w-[280px] max-w-md"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={CATEGORIES}
            className="w-[180px]"
          />
          <Select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value)}
            options={VISIBILITY_OPTIONS}
            className="w-[180px]"
          />
        </FilterBar>
      </form>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />
        ) : documents.length === 0 ? (
          <EmptyState icon="file" title={tr('documents.empty')} description={tr('common.noData')} className="p-12" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('documents.title')}</th>
                    <th className="th">{tr('documents.category')}</th>
                    <th className="th">{tr('documents.size')}</th>
                    <th className="th">{tr('documents.uploadedBy')}</th>
                    <th className="th">{tr('documents.visibility')}</th>
                    <th className="th">{tr('documents.date')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {documents.map((doc) => (
                    <tr key={doc._id} className="tr-hover">
                      <td className="td font-medium text-brand-900">
                        {doc.title}
                        {doc.member && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-brand-100 text-brand-700">
                            <Icon name="users" className="h-3 w-3" />
                            {doc.member.code}
                          </span>
                        )}
                      </td>
                      <td className="td capitalize">{tr(`category.${doc.category}`)}</td>
                      <td className="td text-brand-700 font-mono">
                        {Math.round((doc.file?.size || 0) / 1024)} KB
                      </td>
                      <td className="td text-brand-700">{doc.uploadedBy?.name || '-'}</td>
                      <td className="td">
                        <span className={`badge ${doc.visibility === 'member' ? 'badge-green' : 'badge-slate'}`}>
                          {tr(`documents.${doc.visibility}`)}
                        </span>
                      </td>
                      <td className="td text-brand-700">{formatDate(doc.createdAt)}</td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                            onClick={() => handleDownload(doc._id, doc.file?.originalName || 'document')}
                            aria-label={tr('documents.download')}
                          >
                            <Icon name="download" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon h-8 w-8 text-red-500 hover:bg-red-100"
                            onClick={() => handleDelete(doc._id)}
                            aria-label={tr('common.delete')}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

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
    <Modal isOpen={open} onClose={onClose} title={tr('documents.upload')} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('documents.details')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={tr('documents.titleField')}
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              error={errors.title}
              required
            />
            <Select
              label={tr('documents.category')}
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              required
              options={CATEGORIES.filter(c => c.value)}
            />
            <Select
              label={tr('documents.visibility')}
              value={form.visibility}
              onChange={(e) => onChange({ ...form, visibility: e.target.value })}
              required
              options={VISIBILITY_OPTIONS}
            />
            <Input
              label={tr('documents.member')}
              value={form.memberId}
              onChange={(e) => onChange({ ...form, memberId: e.target.value })}
              placeholder={tr('documents.memberPlaceholder')}
              type="text"
            />
            <div className="sm:col-span-2">
              <label className="label">{tr('documents.file')}</label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={onFileChange}
                  className="input"
                  aria-describedby="file-hint"
                />
                {errors.file && <p className="field-error">{errors.file}</p>}
                <p id="file-hint" className="hint">{tr('documents.hint')}</p>
              </div>
            </div>
            <Input
              label={tr('documents.description')}
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
            {tr('documents.upload')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}