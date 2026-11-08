'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import {
  Icon,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  formatDate,
  Pagination,
  SearchInput,
  StatusBadge,
} from '@/components/ui/common';

const VISIBILITY_LABELS = {
  member: { en: 'Member', bn: 'সদস্য' },
  staff: { en: 'Staff Only', bn: 'শুধু কর্মকর্তা' },
  public: { en: 'Public', bn: 'সর্বজনীন' },
};

export default function MyDocumentsPage() {
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const queryParams = { page, limit: 10, search: search.trim() || undefined };

  const { data, loading, error, reload } = useApi('/documents/my', queryParams, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) window.location.href = '/login';
  }, [mounted, checking, isAuthenticated]);

  const handleSearch = (e) => { e?.preventDefault(); setPage(1); reload(); };

  if (!mounted || checking) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }
  if (!isAuthenticated) return null;

  const documents = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <SearchParamSync onChange={(v) => { setSearch(v); setPage(1); }} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title={tr('documents.myTitle')} subtitle={tr('documents.mySubtitle')} />
      </div>

      <div className="mb-6 rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch} className="flex gap-3">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('documents.searchPlaceholder')}
            className="flex-1"
          />
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-medium text-brand-500">{tr('common.loading')}</p>
        </div>
      ) : error ? (
        <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-12" />
      ) : documents.length === 0 ? (
        <EmptyState icon="folder" title={tr('documents.myEmpty')} description={tr('documents.myEmptyDesc')} className="p-16" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th scope="col" className="px-5 py-3">{tr('documents.title')}</th>
                    <th scope="col" className="px-4 py-3">{tr('documents.category')}</th>
                    <th scope="col" className="px-4 py-3">{tr('documents.visibility')}</th>
                    <th scope="col" className="px-4 py-3">{tr('documents.uploadedAt')}</th>
                    <th scope="col" className="px-5 py-3 text-right">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/80 bg-white">
                  {documents.map((doc) => (
                    <tr key={doc._id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-brand-900 line-clamp-1">{doc.title}</p>
                        <p className="text-xs text-brand-500">{doc.fileName || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-brand-600">{doc.category || '—'}</td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={doc.visibility} customLabels={VISIBILITY_LABELS} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-brand-600">{formatDate(doc.createdAt)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-900"
                        >
                          <Icon name="download" className="h-3.5 w-3.5" />
                          {tr('documents.download')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-brand-200/70 p-4">
              <Pagination meta={meta} onPage={setPage} />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}