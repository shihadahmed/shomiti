'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  formatMoney,
  formatDate,
  StatCard,
} from '@/components/ui/common';

const SCHEME_TYPE_LABELS = {
  monthly: { en: 'Monthly', bn: 'মাসিক' },
  half_yearly: { en: 'Half-Yearly', bn: 'অর্ধ-বার্ষিক' },
  one_time: { en: 'One-Time', bn: 'এককালীন' },
};

export default function MySavingsPage() {
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  const { data, loading, error, reload } = useApi('/savings/my', undefined, {
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

  const dashboard = data || {};
  const accounts = dashboard.accounts || [];
  const totalBalance = dashboard.totalBalancePaisa || 0;
  const duesSummary = dashboard.duesSummary || { dueCount: 0, overdueCount: 0, totalDueCount: 0, totalDuePaisa: 0 };
  const recentTransactions = dashboard.recentTransactions || [];
  const enrolledSchemes = dashboard.enrolledSchemes || [];

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('savings.myTitle')}
          subtitle={tr('savings.mySubtitle')}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/savings/my/dues"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
          >
            <Icon name="target" className="h-4 w-4" />
            {tr('savings.viewDues')}
          </Link>
          <Link
            href="/savings/my/schemes"
            className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
          >
            <Icon name="wallet" className="h-4 w-4" />
            {tr('savings.mySchemes')}
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={tr('savings.totalBalance')}
          value={formatMoney(totalBalance)}
          icon="wallet"
          tone="emerald"
        />
        <StatCard
          label={tr('savings.totalDues')}
          value={duesSummary.totalDueCount > 0 ? `${duesSummary.totalDueCount} (${formatMoney(duesSummary.totalDuePaisa)})` : tr('common.none')}
          icon="target"
          tone={duesSummary.overdueCount > 0 ? 'rose' : duesSummary.dueCount > 0 ? 'amber' : 'emerald'}
        />
        <StatCard
          label={tr('savings.activeAccounts')}
          value={accounts.length.toString()}
          icon="bank"
          tone="blue"
        />
        <StatCard
          label={tr('savings.enrolledSchemes')}
          value={enrolledSchemes.length.toString()}
          icon="target"
          tone="purple"
        />
      </div>

      {/* Savings Accounts */}
      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">{tr('savings.accounts')}</h2>
          <Link
            href="/savings/my/schemes"
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            {tr('savings.viewAllSchemes')}
          </Link>
        </div>
        {accounts.length === 0 ? (
          <EmptyState
            icon="wallet"
            title={tr('savings.noAccounts')}
            description={tr('savings.noAccountsDesc')}
            className="rounded-2xl border border-brand-200/80 bg-white p-8 shadow-xs"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => (
              <div
                key={acc._id}
                className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-600 uppercase tracking-wide">
                      {acc.type === 'monthly' ? tr('savings.monthly') : acc.type === 'half_yearly' ? tr('savings.halfYearly') : tr('savings.oneTime')}
                    </p>
                    <p className="mt-1 text-lg font-bold text-brand-900 font-mono">{formatMoney(acc.balancePaisa)}</p>
                    <p className="mt-0.5 text-xs text-brand-500 font-mono">{acc.accountNo}</p>
                  </div>
                  <div className="shrink-0">
                    {acc.interestRate && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {acc.interestRate}% {tr('savings.interestRate')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Enrolled Schemes */}
      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">{tr('savings.enrolledSchemes')}</h2>
          <Link
            href="/savings/my/schemes"
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            {tr('common.viewAll')}
          </Link>
        </div>
        {enrolledSchemes.length === 0 ? (
          <EmptyState
            icon="target"
            title={tr('savings.noSchemes')}
            description={tr('savings.noSchemesDesc')}
            className="rounded-2xl border border-brand-200/80 bg-white p-8 shadow-xs"
          />
        ) : (
          <div className="space-y-3">
            {enrolledSchemes.map((enrollment) => {
              const scheme = enrollment.scheme;
              if (!scheme) return null;
              const typeLabel = SCHEME_TYPE_LABELS[scheme.savingsType] || { en: scheme.savingsType, bn: scheme.savingsType };
              return (
                <div
                  key={enrollment._id}
                  className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                        <Icon name="target" className="h-5 w-5 text-purple-700" />
                      </div>
                      <div>
                        <p className="font-medium text-brand-900">{scheme.name || scheme.nameBn}</p>
                        <p className="text-sm text-brand-500 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                            {typeLabel[lang]}
                          </span>
                          {scheme.interestRate && (
                            <>
                              <span className="text-brand-300">·</span>
                              <span>{scheme.interestRate}% {tr('savings.interestRate')}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-brand-600">
                      <span>{tr('savings.nextDue')}: {formatDate(enrollment.nextDueDate)}</span>
                      <span className="text-brand-300">|</span>
                      <span>{tr('savings.maturity')}: {formatDate(enrollment.maturityDate)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Transactions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">{tr('savings.recentTransactions')}</h2>
          <Link
            href="/savings"
            className="text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            {tr('common.viewAll')}
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('savings.noTransactions')}
            description={tr('savings.noTransactionsDesc')}
            className="rounded-2xl border border-brand-200/80 bg-white p-8 shadow-xs"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th scope="col" className="px-5 py-3">{tr('savings.date')}</th>
                    <th scope="col" className="px-4 py-3">{tr('savings.type')}</th>
                    <th scope="col" className="px-5 py-3 text-right">{tr('savings.amount')}</th>
                    <th scope="col" className="px-4 py-3">{tr('savings.method')}</th>
                    <th scope="col" className="px-4 py-3">{tr('savings.status')}</th>
                    <th scope="col" className="px-5 py-3">{tr('savings.due')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/80 bg-white">
                  {recentTransactions.map((txn) => {
                    const isCredit = txn.type === 'deposit';
                    return (
                      <tr key={txn._id} className="transition-colors hover:bg-brand-50/40">
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-brand-700">{formatDate(txn.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                            isCredit ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isCredit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {tr(`txn.${txn.type}`)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-sm font-bold">
                          <span className={isCredit ? 'text-emerald-700' : 'text-rose-700'}>
                            {isCredit ? '+' : '-'}{formatMoney(txn.amountPaisa || 0)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-brand-600 capitalize">{txn.method}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            txn.status === 'posted' ? 'bg-emerald-50 text-emerald-700' :
                            txn.status === 'pending_approval' ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {tr(`txn.${txn.status}`)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-brand-500">
                          {txn.savingsDue ? txn.savingsDue.dueNo : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}