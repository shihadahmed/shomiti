'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiGet, apiPost, apiDelete, describeApiError } from '@/lib/useApi';
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
  { value: 'all', label: 'All Members' },
  { value: 'specific', label: 'Specific Member' },
];

const CATEGORY_ACCENTS = {
  notice: {
    color: 'indigo',
    colorCode: 600,
    solid: 'bg-indigo-600',
    solidHover: 'bg-indigo-700',
    light: 'bg-indigo-50',
    border: 'border-indigo-500',
    borderHover: 'hover:border-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: 'FileText',
    label: 'Notice',
    titleHover: 'group-hover:text-indigo-600',
    btnHoverBg: 'group-hover:bg-indigo-600',
    btnHoverText: 'group-hover:text-white',
  },
  meeting: {
    color: 'emerald',
    colorCode: 600,
    solid: 'bg-emerald-600',
    solidHover: 'bg-emerald-700',
    light: 'bg-emerald-50',
    border: 'border-emerald-500',
    borderHover: 'hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: 'Users',
    label: 'Meeting',
    titleHover: 'group-hover:text-emerald-600',
    btnHoverBg: 'group-hover:bg-emerald-600',
    btnHoverText: 'group-hover:text-white',
  },
  resolution: {
    color: 'amber',
    colorCode: 600,
    solid: 'bg-amber-600',
    solidHover: 'bg-amber-700',
    light: 'bg-amber-50',
    border: 'border-amber-500',
    borderHover: 'hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: 'FileText',
    label: 'Resolution',
    titleHover: 'group-hover:text-amber-600',
    btnHoverBg: 'group-hover:bg-amber-600',
    btnHoverText: 'group-hover:text-white',
  },
  default: {
    color: 'rose',
    colorCode: 600,
    solid: 'bg-rose-600',
    solidHover: 'bg-rose-700',
    light: 'bg-rose-50',
    border: 'border-rose-500',
    borderHover: 'hover:border-rose-400',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: 'Folder',
    label: 'Other',
    titleHover: 'group-hover:text-rose-600',
    btnHoverBg: 'group-hover:bg-rose-600',
    btnHoverText: 'group-hover:text-white',
  },
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
      visibility: 'all',
      mentionedMemberId: '',
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
      visibility: 'all',
      mentionedMemberId: '',
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
      setFormErrors({ file: 'Please select a file to upload.' });
      return;
    }

    if (!form.title || !form.title.trim()) {
      setFormErrors({ title: 'Title is required.' });
      return;
    }

    if (!form.category) {
      setFormErrors({ category: 'Category is required.' });
      return;
    }

    if (!form.visibility) {
      setFormErrors({ visibility: 'Visibility is required.' });
      return;
    }

    // Validate mentionedMemberId when visibility is 'specific'
    if (form.visibility === 'specific' && !form.mentionedMemberId) {
      setFormErrors({ mentionedMemberId: 'Please select a member for Specific Member visibility.' });
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
      if (form.visibility === 'specific' && form.mentionedMemberId) {
        formData.append('mentionedMemberId', form.mentionedMemberId);
      }

      await apiPost('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Document uploaded successfully.');
      closeModal();
      reload();
    } catch (requestError) {
      setFormErrors({ submit: describeApiError(requestError) });
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
      <div className="space-y-3.5">
        {loading ? (
          <div className="space-y-3.5" aria-busy="true" aria-label="Loading notices">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs animate-pulse">
                <div className="p-4 sm:p-5">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-slate-100" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-5 w-3/4 bg-slate-100 rounded" />
                      <div className="h-4 w-1/2 bg-slate-100 rounded" />
                      <div className="h-4 w-1/3 bg-slate-100 rounded mt-3" />
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState icon="alert" title={tr('common.error')} description={error} className="py-8" />
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
            className="py-12"
          />
        ) : (
          <>
            {documents.map((doc, index) => {
              const category = doc.category || 'default';
              const accent = CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.default;
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
                  className={`group relative flex flex-col sm:flex-row items-start gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${accent.borderHover} border-l-4 ${accent.border}`}
                  style={{ borderLeftWidth: '4px' }}
                >
                  {/* Left Date Badge - Solid colored square */}
                  <div className={`flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-4 py-3 text-center min-w-[64px] ${accent.solid} text-white shadow-sm`}>
                    <span className="text-2xl font-bold leading-none">{day}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 mt-0.5">{month}</span>
                  </div>

                  {/* Center Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className={`font-semibold text-brand-900 text-base sm:text-lg line-clamp-1 transition-colors duration-200 ${accent.titleHover}`}>{doc.title}</h3>

                    {/* Description excerpt */}
                    {doc.description && (
                      <p className="mt-1 mb-2.5 text-sm text-brand-600 line-clamp-2">{doc.description}</p>
                    )}

                    {/* Metadata Row - Clean horizontal layout */}
                    <div className="mt-1 flex flex-wrap items-center gap-2.5 text-sm">
                      {/* Category Pill Badge with Icon */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${accent.badge}`}>
                        <Icon name={accent.icon} className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium">{accent.label}</span>
                      </span>

                      {/* Calendar Date */}
                      <span className="flex items-center gap-1.5 text-brand-500">
                        <Icon name="calendar" className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
                        <span className="font-medium text-brand-600">{fullDate}</span>
                      </span>

                      {/* Mentioned Member Badge - shown when document.visibility === 'specific' (targeted notice) */}
                      {doc.mentionedMember && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Icon name="userCheck" className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                          <span className="font-medium">
                            {tr('documents.forMember') || 'For'}: {doc.mentionedMember.code} — {doc.mentionedMember.fullName}
                          </span>
                        </span>
                      )}

                      {/* Attachment indicator */}
                      {hasAttachment && (
                        <span className="flex items-center gap-1.5 text-brand-500 bg-brand-50 px-2.5 py-0.5 rounded-full">
                          <Icon name="paperclip" className="h-3.5 w-3.5 text-brand-400 flex-shrink-0" />
                          <span className="font-medium text-brand-700">{tr('documents.attachment') || 'Attachment'}</span>
                        </span>
                      )}

                      {/* NEW badge */}
                      {isNewItem && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider">
                          NEW
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action Button - Soft tinted circle with hover fill */}
                  <div className="flex-shrink-0 flex items-center justify-center sm:justify-end w-full sm:w-auto mt-4 sm:mt-0">
                    <div className={`group relative h-10 w-10 rounded-full transition-all duration-200 flex items-center justify-center ${accent.light} ${accent.border.replace('border-', 'text-').replace('500', '600')} ${accent.btnHoverBg} ${accent.btnHoverText}`} aria-hidden="true">
                      <Icon name="chevronRight" className={`h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5 ${accent.border.replace('border-', 'text-').replace('500', '600')} ${accent.btnHoverText}`} />
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Footer Pagination */}
            {meta.pages > 1 && (
              <div className="pt-2 border-t border-brand-200">
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
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch member options for the searchable selector
  const fetchMemberOptions = useCallback(async (query = '') => {
    setMemberSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('search', query);
      params.set('limit', '20');
      
      const response = await fetch(`/api/members/options?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setMemberOptions(data.data?.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch member options:', err);
    } finally {
      setMemberSearchLoading(false);
    }
  }, []);

  // Load initial member options when modal opens
  useEffect(() => {
    if (open) {
      fetchMemberOptions();
    }
  }, [open, fetchMemberOptions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      const dropdown = document.getElementById('member-dropdown');
      const input = dropdown?.previousElementSibling;
      if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMemberSearch = (query) => {
    setMemberSearchQuery(query);
    setDropdownOpen(true);
    // Debounce the search
    clearTimeout(window.memberSearchTimeout);
    window.memberSearchTimeout = setTimeout(() => {
      fetchMemberOptions(query);
    }, 300);
  };

  const handleVisibilityChange = (value) => {
    onChange({ ...form, visibility: value, mentionedMemberId: value === 'specific' ? form.mentionedMemberId : '' });
    if (value === 'specific' && memberOptions.length === 0) {
      fetchMemberOptions();
    }
  };

  const handleMemberSelect = (memberId) => {
    onChange({ ...form, mentionedMemberId: memberId });
  };

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
              onChange={(e) => handleVisibilityChange(e.target.value)}
              required
              options={VISIBILITY_OPTIONS}
            />
            
            {/* Member Selector - Only shown when visibility is 'specific' */}
            {form.visibility === 'specific' && (
              <div className="sm:col-span-2">
                <label className="label">
                  {tr('documents.mentionedMember') || 'Mentioned Member'} <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="input"
                    placeholder={tr('documents.searchMemberPlaceholder') || 'Search member by code, name, or phone...'}
                    value={memberSearchQuery}
                    onChange={(e) => handleMemberSearch(e.target.value)}
                    onFocus={() => setDropdownOpen(true)}
                    autoComplete="off"
                    required
                    aria-describedby="member-hint"
                  />
                  {memberSearchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-5 w-5 text-brand-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                  <div className={`absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-xl border border-brand-200 bg-white shadow-lg ${dropdownOpen ? '' : 'hidden'}`} 
                       id="member-dropdown"
                       role="listbox">
                    {memberOptions.map(member => (
                      <button
                        key={member._id}
                        type="button"
                        className={`w-full px-3 py-2 text-left hover:bg-brand-50 transition-colors ${
                          form.mentionedMemberId === member._id ? 'bg-brand-50 text-brand-700' : ''
                        }`}
                        onClick={() => handleMemberSelect(member._id)}
                        role="option"
                        aria-selected={form.mentionedMemberId === member._id}
                      >
                        <div className="font-medium text-brand-900">{member.code} — {member.fullName}</div>
                        {member.phone && <div className="text-xs text-brand-500">{member.phone}</div>}
                      </button>
                    ))}
                    {memberOptions.length === 0 && !memberSearchLoading && (
                      <div className="px-3 py-2 text-center text-sm text-brand-500">
                        {tr('documents.noMembersFound') || 'No members found'}
                      </div>
                    )}
                  </div>
                  {errors.mentionedMemberId && <p className="field-error">{errors.mentionedMemberId}</p>}
                  <p id="member-hint" className="hint">
                    {tr('documents.mentionedMemberHint') || 'Select the member this notice is issued for. They will receive a personalized notification.'}
                  </p>
                </div>
              </div>
            )}
            
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
              rows={4}
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