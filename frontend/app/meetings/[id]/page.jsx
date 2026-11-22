'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { notFound } from 'next/navigation';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { apiGet } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import AttachmentPreview from '@/components/documents/AttachmentPreview';
import { Icon, Button, Badge, LoadingSpinner, formatDate } from '@/components/ui/common';

const CATEGORY_ACCENTS = {
  notice: { bg: 'bg-indigo-50', border: 'border-indigo-500', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: 'FileText', label: 'Notice', dot: 'bg-indigo-500' },
  meeting: { bg: 'bg-emerald-50', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'Users', label: 'Meeting', dot: 'bg-emerald-500' },
  resolution: { bg: 'bg-amber-50', border: 'border-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'FileText', label: 'Resolution', dot: 'bg-amber-500' },
  default: { bg: 'bg-rose-50', border: 'border-rose-500', badge: 'bg-rose-100 text-rose-700 border-rose-200', icon: 'Folder', label: 'Other', dot: 'bg-rose-500' },
};

const ACCENT_COLORS = {
  notice: 'indigo',
  meeting: 'emerald',
  resolution: 'amber',
  default: 'rose',
};

function getAccent(category) {
  return CATEGORY_ACCENTS[category] || CATEGORY_ACCENTS.default;
}

export default function NoticeDetailPage() {
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const params = useParams();
  const id = params.id;

  const [document, setDocument] = useState(null);
  const [recentNotices, setRecentNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet(`/documents/${id}`);
      const doc = res?.document ?? res;
      if (doc?._id) {
        setDocument(doc);
      } else {
        throw new Error('Document not found');
      }
    } catch (err) {
      setError(err.message || 'Failed to load notice');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchRecentNotices = useCallback(async () => {
    try {
      const res = await apiGet('/documents', { limit: 5, category: '', search: '' });
      if (Array.isArray(res?.items)) {
        // Filter out current document
        const recent = res.items.filter(doc => doc._id !== id);
        setRecentNotices(recent);
      }
    } catch (err) {
      console.error('Failed to fetch recent notices:', err);
    }
  }, [id]);

  // Track mounted state and checking (matching AppShell pattern)
  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, []);

  // Fetch data when authenticated and ready
  useEffect(() => {
    if (isAuthenticated && !checking) {
      fetchDocument();
      fetchRecentNotices();
    }
  }, [isAuthenticated, checking, fetchDocument, fetchRecentNotices]);

  // Unauthenticated visitors are redirected by AppShell after it restores the
  // session from the auth cookie, so the detail page must not redirect early.

  if (!mounted || checking || loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  if (error || !document) {
    notFound();
  }

  const category = document.category || 'default';
  const accent = getAccent(category);
  const AccentIcon = accent.icon;
  const accentColor = ACCENT_COLORS[category] || 'rose';

  const fullDate = formatDate(document.createdAt, { time: false });
  const hasAttachment = document.file?.url;

  return (
    <AppShell>
      {/* Hero Banner */}
      <div className="mb-6 rounded-2xl bg-brand-900 text-white overflow-hidden shadow-xl">
        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Badge variant="default" className={`${accent.badge} flex items-center gap-1.5 px-3 py-1 text-sm`}>
                <Icon name={accent.icon} className="h-4 w-4" />
                {accent.label}
              </Badge>
              <span className="text-sm text-brand-300 font-mono">Published on {fullDate}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight max-w-3xl">
              {document.title}
            </h1>
            {document.description && (
              <p className="mt-4 text-lg text-brand-200/90 max-w-2xl line-clamp-3">{document.description}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <div className={`absolute top-4 right-4 lg:static lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/20`}>
              <Icon name="megaphone" className="h-10 w-10 sm:h-12 sm:w-12 text-white/80" />
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Main Content (70% = 8 cols) */}
        <div className="lg:col-span-8">
          {/* Main Notice Card */}
          <div className="card card-pad mb-6">
            {/* Top Metadata Row */}
            <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-brand-200">
              <Badge variant="default" className={`${accent.badge} flex items-center gap-1.5 px-3 py-1 text-sm`}>
                <Icon name={accent.icon} className="h-4 w-4" />
                {accent.label}
              </Badge>
              <span className="flex items-center gap-1.5 text-sm text-brand-600 font-mono">
                <Icon name="calendar" className="h-4 w-4 text-brand-400" />
                {fullDate}
              </span>
              {document.uploadedBy && (
                <span className="flex items-center gap-1.5 text-sm text-brand-600">
                  <Icon name="user" className="h-4 w-4 text-brand-400" />
                  {document.uploadedBy.name}
                </span>
              )}
              {document.member && (
                <span className="flex items-center gap-1.5 text-sm text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-full">
                  <Icon name="users" className="h-3.5 w-3.5 text-brand-400" />
                  {document.member.code} - {document.member.fullName}
                </span>
              )}
              {/* Mentioned Member Badge - shown when document.visibility === 'specific' (targeted notice) */}
              {document.mentionedMember && (
                <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <Icon name="userCheck" className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-medium">
                    {tr('documents.forMember') || 'For'}: {document.mentionedMember.code} — {document.mentionedMember.fullName}
                  </span>
                </span>
              )}
            </div>

            {/* Full Description/Body */}
            {document.description && (
              <div className="prose prose-brand max-w-none mb-6">
                <p className="text-brand-700 leading-relaxed whitespace-pre-wrap">{document.description}</p>
              </div>
            )}

            {/* Attachment preview + actions */}
            {hasAttachment && (
              <AttachmentPreview
                file={document.file}
                documentId={document._id}
                title={document.title}
                accent={accent}
              />
            )}
          </div>
        </div>

        {/* Right Sidebar (30% = 4 cols) */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            {/* Latest Notices Card */}
            <div className="card card-pad">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-brand-900">{tr('meetings.latestNotices') || 'Latest Notices'}</h3>
                <Link
                  href="/meetings"
                  className="text-sm text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
                >
                  {tr('common.viewAll') || 'View all'}
                  <Icon name="chevronRight" className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentNotices.length === 0 ? (
                  <p className="text-sm text-brand-400 text-center py-4">{tr('common.noData')}</p>
                ) : (
                  recentNotices.map((doc, index) => {
                    const cat = doc.category || 'default';
                    const acc = getAccent(cat);
                    const date = formatDate(doc.createdAt, { time: false });
                    return (
                      <Link
                        key={doc._id}
                        href={`/meetings/${doc._id}`}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group"
                      >
                        <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full mt-2 ${acc.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-brand-900 line-clamp-1 group-hover:text-brand-700 transition-colors">{doc.title}</p>
                          <p className="text-xs text-brand-500 mt-0.5">{date}</p>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Need Help? Card */}
            <div className="card card-pad bg-gradient-to-br from-brand-50 to-brand-100 border-brand-200">
              <h3 className="font-semibold text-brand-900 mb-4 flex items-center gap-2">
                <Icon name="helpCircle" className="h-5 w-5 text-brand-600" />
                {tr('meetings.needHelp') || 'Need Help?'}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-brand-700">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <Icon name="phone" className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{tr('meetings.supportPhone') || 'Support Phone'}</p>
                    <p className="text-brand-500">+880 1700 000 000</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-brand-700">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <Icon name="mail" className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{tr('meetings.supportEmail') || 'Support Email'}</p>
                    <p className="text-brand-500">support@shomiti.local</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 text-brand-700">
                  <div className="flex h-8 w-8 shrink-0 mt-0.5 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                    <Icon name="mapPin" className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{tr('meetings.officeAddress') || 'Office Address'}</p>
                    <p className="text-brand-500">Shopnonir Somobai Somitee, Dhaka, Bangladesh</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}