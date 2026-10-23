'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatMoney, formatDate, Pagination, SearchInput, FilterBar, Tab, Tabs } from '@/components/ui/common';

const ENTRY_TYPES = [
  { value: '', label: 'All' },
  { value: 'savings_transaction', label: 'Savings Transaction' },
  { value: 'payment', label: 'Payment' },
  { value: 'expense', label: 'Expense' },
  { value: 'manual', label: 'Manual' },
  { value: 'opening', label: 'Opening' },
];

export default function LedgerPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('trial-balance');
  const [entryPage, setEntryPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const trialParams = {};
  const entryParams = {
    page: entryPage,
    limit: 20,
    search: search || undefined,
    sourceType: typeFilter,
    from: fromDate,
    to: toDate,
  };

  const { data: trialData, loading: trialLoading, error: trialError, reload: reloadTrial } = useApi('/ledger/trial-balance', trialParams, {
    enabled: isAuthenticated && activeTab === 'trial-balance',
  });

  const { data: chartData, loading: chartLoading } = useApi('/ledger/chart-of-accounts', {}, {
    enabled: isAuthenticated && activeTab === 'chart-of-accounts',
  });

  const { data: entryData, loading: entryLoading, error: entryError, reload: reloadEntries } = useApi('/ledger/entries', entryParams, {
    enabled: isAuthenticated && activeTab === 'entries',
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
    setEntryPage(1);
    reloadEntries();
  }, [reloadEntries]);

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

  const trial = trialData?.items || [];
  const trialTotals = trialData?.totals || { debitPaisa: 0, creditPaisa: 0 };
  const entries = entryData?.items || [];
  const entryMeta = entryData?.meta || { total: 0, pages: 1 };
  const chartAccounts = chartData?.items || [];

  const trialBalance = trialTotals.debitPaisa - trialTotals.creditPaisa;

  return (
    <AppShell>
      <PageHeader
        title={tr('ledger.title')}
        subtitle={tr('ledger.subtitle')}
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="trial-balance">{tr('ledger.trial')}</Tab>
        <Tab value="chart-of-accounts">{tr('ledger.accounts')}</Tab>
        <Tab value="entries">{tr('ledger.entries')}</Tab>
      </Tabs>

      {activeTab === 'trial-balance' && (
        <TrialBalanceView
          trial={trial}
          loading={trialLoading}
          error={trialError}
          totals={trialTotals}
          balance={trialBalance}
        />
      )}

      {activeTab === 'chart-of-accounts' && (
        <ChartOfAccountsView
          accounts={chartAccounts}
          loading={chartLoading}
        />
      )}

      {activeTab === 'entries' && (
        <EntriesView
          entries={entries}
          meta={entryMeta}
          loading={entryLoading}
          error={entryError}
          search={search}
          setSearch={setSearch}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          fromDate={fromDate}
          setFromDate={setFromDate}
          toDate={toDate}
          setToDate={setToDate}
          page={entryPage}
          setPage={setPage}
          handleSearch={handleSearch}
        />
      )}
    </AppShell>
  );
}

function TrialBalanceView({ trial, loading, error, totals, balance }) {
  const { tr, formatMoney } = useLang();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />;
  }

  if (trial.length === 0) {
    return <EmptyState icon="book" title={tr('ledger.noEntries')} description={tr('common.noData')} className="p-12" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="stat-card bg-emerald-50 border-emerald-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{tr('ledger.totalDebit')}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{formatMoney(totals.debitPaisa || 0)}</p>
        </div>
        <div className="stat-card bg-rose-50 border-rose-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{tr('ledger.totalCredit')}</p>
          <p className="mt-2 text-2xl font-bold text-rose-900">{formatMoney(totals.creditPaisa || 0)}</p>
        </div>
        <div className={`stat-card ${balance === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">{tr('ledger.balance')}</p>
          <p className="mt-2 text-2xl font-bold">{formatMoney(Math.abs(balance))}</p>
          <p className="mt-1 text-xs">
            {balance === 0 ? tr('ledger.balanced') : balance > 0 ? tr('ledger.debitBalance') : tr('ledger.creditBalance')}
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-200 text-sm">
          <thead className="bg-brand-50/80">
            <tr>
              <th className="th">{tr('ledger.account')}</th>
              <th className="th">{tr('ledger.type')}</th>
              <th className="th">{tr('ledger.debit')}</th>
              <th className="th">{tr('ledger.credit')}</th>
              <th className="th">{tr('ledger.balance')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-200">
            {trial.map((row) => (
              <tr key={row.code} className="tr-hover">
                <td className="td font-mono text-brand-900">{row.code} — {row.name} {row.nameBn ? `(${row.nameBn})` : ''}</td>
                <td className="td text-brand-700 capitalize">{row.type}</td>
                <td className="td font-mono text-emerald-700">{formatMoney(row.debitPaisa || 0)}</td>
                <td className="td font-mono text-rose-700">{formatMoney(row.creditPaisa || 0)}</td>
                <td className="td font-mono font-semibold">
                  <span className={row.balancePaisa >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {formatMoney(Math.abs(row.balancePaisa || 0))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-brand-50 font-semibold">
            <tr>
              <td className="td" colSpan={2}>{tr('common.total')}</td>
              <td className="td font-mono text-emerald-700">{formatMoney(totals.debitPaisa || 0)}</td>
              <td className="td font-mono text-rose-700">{formatMoney(totals.creditPaisa || 0)}</td>
              <td className="td font-mono">
                <span className={balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatMoney(Math.abs(balance))}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ChartOfAccountsView({ accounts, loading }) {
  const { tr } = useLang();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  const grouped = accounts.reduce((acc, account) => {
    if (!acc[account.type]) acc[account.type] = [];
    acc[account.type].push(account);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, accounts]) => (
        <section key={type}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-600">{tr(`ledger.${type}`)}</h3>
          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-200 text-sm">
              <thead className="bg-brand-50/80">
                <tr>
                  <th className="th">{tr('ledger.code')}</th>
                  <th className="th">{tr('ledger.account')}</th>
                  <th className="th">{tr('ledger.debit')}</th>
                  <th className="th">{tr('ledger.credit')}</th>
                  <th className="th">{tr('ledger.balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200">
                {accounts.map((account) => (
                  <tr key={account._id} className="tr-hover">
                    <td className="td font-mono text-brand-900">{account.code}</td>
                    <td className="td text-brand-900">{account.name} {account.nameBn ? `(${account.nameBn})` : ''}</td>
                    <td className="td font-mono text-emerald-700">{formatMoney(account.debitPaisa || 0)}</td>
                    <td className="td font-mono text-rose-700">{formatMoney(account.creditPaisa || 0)}</td>
                    <td className="td font-mono font-semibold">
                      <span className={account.balancePaisa >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {formatMoney(Math.abs(account.balancePaisa || 0))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function EntriesView({
  entries,
  meta,
  loading,
  error,
  search,
  setSearch,
  typeFilter,
  setTypeFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  page,
  setPage,
  handleSearch,
}) {
  const { tr, formatMoney, formatDate } = useLang();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />;
  }

  if (entries.length === 0) {
    return <EmptyState icon="book" title={tr('ledger.noEntries')} description={tr('common.noData')} className="p-12" />;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="mb-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('savings.searchPlaceholder')}
            className="flex-1 min-w-[280px] max-w-md"
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={ENTRY_TYPES}
            className="w-[200px]"
          />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder={tr('savings.from')}
            className="w-[160px]"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder={tr('savings.to')}
            className="w-[160px]"
          />
        </FilterBar>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-200 text-sm">
          <thead className="bg-brand-50/80">
            <tr>
              <th className="th">{tr('ledger.entryNo')}</th>
              <th className="th">{tr('ledger.date')}</th>
              <th className="th">{tr('ledger.description')}</th>
              <th className="th">{tr('ledger.source')}</th>
              <th className="th">{tr('ledger.lines')}</th>
              <th className="th">{tr('ledger.debit')}</th>
              <th className="th">{tr('ledger.credit')}</th>
              <th className="th">{tr('ledger.postedBy')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-200">
            {entries.map((entry) => (
              <tr key={entry._id} className="tr-hover">
                <td className="td font-mono text-brand-900">{entry.entryNo}</td>
                <td className="td text-brand-700">{formatDate(entry.date)}</td>
                <td className="td text-brand-900 max-w-xs truncate">{entry.description}</td>
                <td className="td text-brand-700 capitalize">{entry.sourceType}</td>
                <td className="td text-brand-700">{entry.lines?.length || 0}</td>
                <td className="td font-mono text-emerald-700">{formatMoney(entry.totalDebitPaisa || 0)}</td>
                <td className="td font-mono text-rose-700">{formatMoney(entry.totalCreditPaisa || 0)}</td>
                <td className="td text-brand-700">{entry.postedBy?.name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}