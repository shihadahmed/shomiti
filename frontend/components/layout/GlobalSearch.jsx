'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { apiClient } from '@/lib/api';
import { Icon, formatMoney } from '@/components/ui/common';
import { menuSectionsForRole, navLabel, searchHrefsForRole } from '@/lib/navigation';

const MIN_RECORD_QUERY = 2;
const RECORD_LIMIT = 4;

const EMPTY_RESULTS = {
  members: [],
  documents: [],
  transactions: [],
  dues: [],
};

function toMemberResult(member, lang) {
  const name = lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName;
  const code = member.code || '';
  return {
    group: 'members',
    icon: 'users',
    label: name || code,
    sublabel: [code, member.phone].filter(Boolean).join(' · '),
    href: `/members?search=${encodeURIComponent(code || name || '')}`,
  };
}

function toDocumentResult(doc) {
  return {
    group: 'documents',
    icon: 'file',
    label: doc.title || doc.file?.originalName || '—',
    sublabel: [doc.category, doc.member?.fullName].filter(Boolean).join(' · '),
    href: `/documents?search=${encodeURIComponent(doc.title || '')}`,
  };
}

function toTransactionResult(transaction) {
  return {
    group: 'transactions',
    icon: 'wallet',
    label: transaction.txnNo || '—',
    sublabel: [transaction.member?.fullName, transaction.type, formatMoney(transaction.amountPaisa || 0)]
      .filter(Boolean)
      .join(' · '),
    href: `/savings?search=${encodeURIComponent(transaction.txnNo || '')}`,
  };
}

function toDueResult(due) {
  return {
    group: 'dues',
    icon: 'target',
    label: due.dueNo || '—',
    sublabel: [due.member?.fullName, due.period, formatMoney(due.totalDuePaisa || 0)]
      .filter(Boolean)
      .join(' · '),
    href: `/savings/dues?search=${encodeURIComponent(due.dueNo || '')}`,
  };
}

function SearchField({
  inputRef,
  value,
  onChange,
  onClear,
  onFocus,
  onKeyDown,
  placeholder,
  clearLabel,
  loading = false,
}) {
  return (
    <div className="relative w-full">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="input pl-9 pr-9 text-sm"
        autoComplete="off"
        role="searchbox"
        aria-label={placeholder}
      />
      <span className="absolute inset-y-0 right-2.5 flex items-center">
        {loading && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
            aria-hidden="true"
          />
        )}
        {value && !loading && (
          <button
            type="button"
            onClick={onClear}
            className="rounded p-1 text-brand-400 transition hover:bg-brand-100 hover:text-brand-700"
            aria-label={clearLabel}
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

function ResultRow({ item, active, onHover, onSelect }) {
  return (
    <Link
      id={`global-search-result-${item.index}`}
      href={item.href}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex items-center gap-3 rounded-xl px-2.5 py-2 transition ${
        active ? 'bg-brand-100' : 'hover:bg-brand-50'
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-700'
        }`}
      >
        <Icon name={item.icon} className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-brand-900">{item.label}</span>
        {item.sublabel && <span className="block truncate text-[11px] text-brand-500">{item.sublabel}</span>}
      </span>
      <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-brand-300" />
    </Link>
  );
}

function ResultsPanel({
  query,
  groups,
  loading,
  activeIndex,
  onHover,
  onSelect,
  onSeeAll,
  labels,
  className = '',
}) {
  const hasQuery = query.trim().length > 0;

  if (!hasQuery) {
    return (
      <div className={className}>
        <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-brand-400">
          {labels.quickLinks}
        </p>
        <div className="space-y-0.5 px-1.5 pb-2">
          {groups.map((group) => group.items.map((item) => (
            <ResultRow
              key={item.key}
              item={item}
              active={activeIndex === item.index}
              onHover={() => onHover(item.index)}
              onSelect={onSelect}
            />
          )))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {groups.map((group) => (
        <div key={group.key}>
          <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-400">{group.label}</p>
            {group.href && (
              <Link
                href={group.href}
                onClick={onSeeAll}
                className="shrink-0 text-[11px] font-semibold text-brand-600 hover:text-brand-900"
              >
                {labels.viewAll}
              </Link>
            )}
          </div>
          <div className="space-y-0.5 px-1.5">
            {group.items.map((item) => (
              <ResultRow
                key={item.key}
                item={item}
                active={activeIndex === item.index}
                onHover={() => onHover(item.index)}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}

      {loading && groups.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-brand-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          {labels.loading}
        </div>
      )}

      {loading && groups.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 text-[11px] text-brand-400">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          {labels.loading}
        </div>
      )}

      {!loading && groups.length === 0 && (
        <div className="px-4 py-8 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-500">
            <Icon name="search" className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-brand-800">
            {labels.noResults.replace('{query}', query.trim())}
          </p>
          <p className="mt-1 text-xs text-brand-500">{labels.noResultsHint}</p>
        </div>
      )}
    </div>
  );
}

export default function GlobalSearch({ className = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entityResults, setEntityResults] = useState(EMPTY_RESULTS);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchPending = query.trim() !== debouncedQuery;

  const desktopRef = useRef(null);
  const desktopInputRef = useRef(null);
  const mobileInputRef = useRef(null);

  const sources = useMemo(() => {
    const hrefs = new Set(searchHrefsForRole(user?.role));
    const next = [];
    if (hrefs.has('/members')) {
      next.push({ group: 'members', path: '/members', map: (item) => toMemberResult(item, lang) });
    }
    if (hrefs.has('/savings')) {
      next.push({ group: 'transactions', path: '/savings/transactions', map: toTransactionResult });
    }
    if (hrefs.has('/savings/dues')) {
      next.push({ group: 'dues', path: '/savings/dues', map: toDueResult });
    }
    if (hrefs.has('/documents')) {
      next.push({ group: 'documents', path: '/documents', map: toDocumentResult });
    }
    return next;
  }, [user?.role, lang]);

  useEffect(() => {
    setEntityResults(EMPTY_RESULTS);
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open && !mobileOpen) return undefined;
    if (debouncedQuery.length < MIN_RECORD_QUERY || sources.length === 0) {
      setEntityResults(EMPTY_RESULTS);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    setEntityResults(EMPTY_RESULTS);
    setLoading(true);

    Promise.allSettled(
      sources.map((source) =>
        apiClient.get(
          source.path,
          { search: debouncedQuery, limit: RECORD_LIMIT },
          { signal: controller.signal },
        ),
      ),
    ).then((responses) => {
      if (cancelled) return;
      const next = { ...EMPTY_RESULTS };
      responses.forEach((response, index) => {
        if (response.status !== 'fulfilled') return;
        const source = sources[index];
        const payload = response.value.data?.data;
        const rows = Array.isArray(payload) ? payload : payload?.items || [];
        next[source.group] = rows.map(source.map).filter(Boolean);
      });
      setEntityResults(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
      setLoading(false);
    };
  }, [debouncedQuery, open, mobileOpen, sources]);

  useEffect(() => {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    setDebouncedQuery('');
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (desktopRef.current && !desktopRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const timer = setTimeout(() => mobileInputRef.current?.focus(), 50);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, entityResults]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const node = document.getElementById(`global-search-result-${activeIndex}`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const pageResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    const seen = new Set();
    const rows = [];

    for (const section of menuSectionsForRole(user?.role)) {
      const sectionLabel = navLabel(tr, section.section, section.title);
      for (const item of section.items) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        const label = navLabel(tr, item.label, item.defaultTitle);
        const keywords = `${label} ${sectionLabel} ${item.href} ${item.label}`.toLowerCase();
        if (!term || keywords.includes(term)) {
          rows.push({
            key: `page-${item.href}`,
            group: 'pages',
            icon: item.icon,
            label,
            sublabel: sectionLabel,
            href: item.href,
          });
        }
      }
    }

    return rows.slice(0, term ? 8 : 6);
  }, [query, tr, user?.role]);

  const groups = useMemo(() => {
    const term = query.trim();
    const base = [
      {
        key: 'pages',
        label: term ? tr('shell.searchPages') : tr('shell.searchQuickLinks'),
        items: pageResults,
      },
      {
        key: 'members',
        label: tr('shell.searchMembers'),
        href: `/members?search=${encodeURIComponent(term)}`,
        items: entityResults.members,
      },
      {
        key: 'transactions',
        label: tr('shell.searchTransactions'),
        href: `/savings?search=${encodeURIComponent(term)}`,
        items: entityResults.transactions,
      },
      {
        key: 'dues',
        label: tr('shell.searchDues'),
        href: `/savings/dues?search=${encodeURIComponent(term)}`,
        items: entityResults.dues,
      },
      {
        key: 'documents',
        label: tr('shell.searchDocuments'),
        href: `/documents?search=${encodeURIComponent(term)}`,
        items: entityResults.documents,
      },
    ];

    let cursor = 0;
    return base
      .filter((group) => group.items.length > 0)
      .map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const index = cursor;
          cursor += 1;
          return { ...item, key: item.key || `${group.key}-${index}`, index };
        }),
      }));
  }, [pageResults, entityResults, query, tr]);

  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    setDebouncedQuery('');
    setEntityResults(EMPTY_RESULTS);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      } else {
        setOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const goTo = useCallback((item) => {
    closeSearch();
    router.push(item.href);
  }, [closeSearch, router]);

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => {
        if (flatResults.length === 0) return -1;
        return current >= flatResults.length - 1 ? 0 : current + 1;
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => {
        if (flatResults.length === 0) return -1;
        return current <= 0 ? flatResults.length - 1 : current - 1;
      });
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        event.preventDefault();
        goTo(flatResults[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      desktopInputRef.current?.blur();
      mobileInputRef.current?.blur();
    }
  };

  const labels = useMemo(() => ({
    quickLinks: tr('shell.searchQuickLinks'),
    viewAll: tr('shell.searchViewAll'),
    loading: tr('shell.searchLoading'),
    noResults: tr('shell.searchNoResults'),
    noResultsHint: tr('shell.searchNoResultsHint'),
  }), [tr]);

  const searchPlaceholder = sources.length > 0
    ? tr('shell.searchPlaceholder')
    : tr('shell.searchPagesPlaceholder');

  return (
    <div className={`relative ${className}`}>
      <div ref={desktopRef} className="relative hidden md:block">
        <SearchField
          inputRef={desktopInputRef}
          value={query}
          onChange={(value) => {
            setQuery(value);
            setOpen(true);
          }}
          onClear={() => {
            setQuery('');
            desktopInputRef.current?.focus();
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={searchPlaceholder}
          clearLabel={tr('shell.clearSearch')}
          loading={loading || searchPending}
        />

        {open && (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-xl">
            <ResultsPanel
              query={query}
              groups={groups}
              loading={loading || searchPending}
              activeIndex={activeIndex}
              onHover={setActiveIndex}
              onSelect={closeSearch}
              onSeeAll={closeSearch}
              labels={labels}
              className="max-h-[min(70vh,30rem)] overflow-y-auto py-1"
            />
            <div className="hidden items-center justify-between border-t border-brand-100 bg-brand-50/60 px-3 py-1.5 text-[10px] text-brand-400 sm:flex">
              <span>{tr('shell.searchKeyboard')}</span>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-icon text-brand-500 hover:bg-brand-100 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label={tr('shell.searchOpen')}
      >
        <Icon name="search" />
      </button>

      {mobileOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col bg-white md:hidden">
          <div className="flex h-16 shrink-0 items-center gap-2 border-b border-brand-200 px-3">
            <div className="min-w-0 flex-1">
              <SearchField
                inputRef={mobileInputRef}
                value={query}
                onChange={setQuery}
                onClear={() => {
                  setQuery('');
                  mobileInputRef.current?.focus();
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                clearLabel={tr('shell.clearSearch')}
                loading={loading || searchPending}
              />
            </div>
            <button type="button" className="btn-secondary btn-sm shrink-0" onClick={closeSearch}>
              {tr('common.cancel')}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-brand-50/50 px-2 py-2">
            <div className="overflow-hidden rounded-2xl border border-brand-200 bg-white">
              <ResultsPanel
                query={query}
                groups={groups}
                loading={loading || searchPending}
                activeIndex={activeIndex}
                onHover={setActiveIndex}
                onSelect={closeSearch}
                onSeeAll={closeSearch}
                labels={labels}
                className="py-1"
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-brand-100 bg-white px-3 py-2 text-center text-[10px] text-brand-400">
            {tr('shell.searchKeyboard')}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}