'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, EmptyState, Icon, Badge, Pagination, formatMoney } from '@/components/ui/common';

export default function MeetingsPage() {
  const { tr } = useLang();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filter, setFilter] = useState({ category: 'all', search: '' });
  const [activeTab, setActiveTab] = useState('all');

  const categories = [
    { value: 'all', label: tr('common.all') },
    { value: 'meeting', label: tr('documents.meetingResolutions') || 'Meeting Papers' },
    { value: 'resolution', label: tr('documents.societyRules') || 'Resolutions' },
    { value: 'notice', label: tr('documents.notices') || 'Notices' },
  ];

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });
      
      if (activeTab !== 'all') {
        params.append('category', activeTab);
      }
      
      if (filter.search) {
        params.append('search', filter.search);
      }

      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setDocuments(data.data.items);
        setPagination(prev => ({ ...prev, ...data.data.meta }));
      }
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [pagination.page, activeTab, filter.search]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCategoryBadge = (category) => {
    const badges = {
      meeting: { variant: 'info', label: 'Meeting' },
      resolution: { variant: 'success', label: 'Resolution' },
      notice: { variant: 'warning', label: 'Notice' },
      policy: { variant: 'secondary', label: 'Policy' },
      certificate: { variant: 'purple', label: 'Certificate' },
    };
    return badges[category] || { variant: 'default', label: category };
  };

  return (
    <AppShell>
      <PageHeader 
        title={tr('nav.meetings')} 
        subtitle={tr('admin.meetingScheduler') || 'Manage meetings, resolutions and notices'}
        action={
          <a 
            href="/documents" 
            className="btn btn-primary"
          >
            <Icon name="plus" className="mr-2 h-4 w-4" />
            {tr('documents.upload') || 'Upload Document'}
          </a>
        }
      />

      <div className="card card-pad">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-brand-200">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setActiveTab(cat.value); setPagination(p => ({...p, page: 1})); }}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === cat.value
                  ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
                  : 'text-brand-500 hover:text-brand-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-400" />
            <input
              type="text"
              placeholder={tr('documents.searchPlaceholder') || 'Search documents...'}
              value={filter.search}
              onChange={(e) => { setFilter({...filter, search: e.target.value}); setPagination(p => ({...p, page: 1})); }}
              className="input w-full pl-10 pr-4 py-2"
            />
          </div>
        </div>

        {/* Documents Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-brand-500">{tr('common.loading')}</p>
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('documents.empty') || 'No documents found'}
            description={activeTab !== 'all' 
              ? `No ${categories.find(c => c.value === activeTab)?.label.toLowerCase()} found.`
              : 'No meetings, resolutions or notices uploaded yet.'
            }
            action={
              <a href="/documents" className="btn btn-primary">
                <Icon name="plus" className="mr-2 h-4 w-4" />
                {tr('documents.upload') || 'Upload Document'}
              </a>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="w-1/3">{tr('documents.titleField') || 'Title'}</th>
                    <th className="w-1/6">{tr('documents.category') || 'Category'}</th>
                    <th className="w-1/6">{tr('documents.date') || 'Date'}</th>
                    <th className="w-1/6">{tr('documents.uploadedBy') || 'Uploaded By'}</th>
                    <th className="w-1/6">{tr('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc._id}>
                      <td>
                        <div className="font-medium text-brand-900">{doc.title}</div>
                        {doc.description && (
                          <div className="text-sm text-brand-500 truncate max-w-xs">{doc.description}</div>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const badge = getCategoryBadge(doc.category);
                          return (
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          );
                        })()}
                      </td>
                      <td className="text-sm text-brand-600">{formatDate(doc.createdAt)}</td>
                      <td className="text-sm text-brand-600">{doc.uploadedBy?.name || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <a 
                            href={`/api/documents/${doc._id}/file`}
                            className="btn btn-sm btn-outline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Icon name="download" className="h-4 w-4" />
                            <span className="hidden sm:inline">{tr('documents.download') || 'Download'}</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <Pagination
                current={pagination.page}
                total={pagination.pages}
                onChange={(page) => setPagination(p => ({...p, page}))}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}