'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon,
  Button,
  StatCard,
  PageHeader,
  EmptyState,
  formatMoney,
  formatDate,
  Avatar,
  StatusBadge,
  LoadingSpinner,
  Card,
} from '@/components/ui/common';

export default function MemberDashboard() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [payingDueId, setPayingDueId] = useState(null);

  const { data: dashboardData, loading, error, reload } = useApi('/dashboard/my', undefined, {
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

  const displayName = lang === 'bn' && user?.nameBn ? user.nameBn : user?.name;
  const roleLabel = tr(`role.${user?.role}`);
  const lastLogin = user?.lastLoginAt
    ? formatDate(user.lastLoginAt, { time: true })
    : tr('common.na');

  const accounts = dashboardData?.accounts || [];
  const dues = dashboardData?.dues || { items: [], summary: {} };
  const transactions = dashboardData?.transactions || { items: [], summary: {} };

  const totalBalance = transactions.summary?.totalBalance || 0;
  const monthlyDeposits = transactions.summary?.monthlyDeposits || 0;
  const activeAccounts = transactions.summary?.activeAccounts || accounts.filter(a => a.status === 'active').length;

  const overdueCount = dues.summary?.totalOverdueCount || 0;
  const overdueAmount = dues.summary?.totalOverdueAmount || 0;
  const dueCount = dues.summary?.totalDueCount || 0;
  const dueAmount = dues.summary?.totalDueAmount || 0;
  const totalDuesAmount = dues.summary?.totalAmount || 0;
  const totalDuesItems = dues.summary?.totalItems || 0;

  const hasOverdue = overdueCount > 0;
  const kycNotActive = user?.status !== 'active';

  const handlePayDue = async (dueId) => {
    setPayingDueId(dueId);
    try {
      const due = dues.items.find(d => d._id === dueId);
      if (!due) return;

      // For now, redirect to payments page with due pre-selected
      // In a full implementation, you'd open a payment modal here
      router.push(`/payments?dueId=${dueId}`);
    } catch (err) {
      alert(err?.message || tr('error.generic'));
    } finally {
      setPayingDueId(null);
    }
  };

  if (!mounted || checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50">
        <span className="flex h-16 w-16 animate-pulse items-center justify-center overflow-hidden rounded-2xl bg-brand-700 shadow-lg ring-4 ring-brand-100">
          <img src="/logo.png" alt="" className="h-full w-full object-cover" aria-hidden="true" />
        </span>
        <p className="text-sm text-brand-500">{tr('common.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <AppShell>
      {/* ── KYC Status Banner ── */}
      {kycNotActive && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm" role="alert">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Icon name="alert" className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">
                  {user?.status === 'under_review' ? tr('kyc.underReviewTitle') :
                   user?.status === 'rejected' ? tr('kyc.rejectedTitle') :
                   tr('kyc.pendingKycTitle')}
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  {user?.status === 'under_review' ? tr('kyc.underReviewBody') :
                   user?.status === 'rejected' ? `${tr('kyc.rejectedBody')} ${user.rejectionReason ? `(${user.rejectionReason})` : ''}` :
                   tr('kyc.pendingKycBody')}
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="whitespace-nowrap shrink-0"
              onClick={() => { window.location.href = '/complete-profile'; }}
            >
              {user?.status === 'rejected' ? tr('kyc.updateProfile') : tr('kyc.goToProfile')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Overdue Alert Banner ── */}
      {hasOverdue && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm" role="alert">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <Icon name="alert" className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-rose-900">{tr('dashboard.overdueAlert')}</p>
                <p className="text-sm text-rose-700 mt-0.5">
                  {tr('dashboard.overdueAlertDesc', { count: overdueCount, amount: formatMoney(overdueAmount) })}
                </p>
              </div>
            </div>
            <Link
              href="/savings/my/dues"
              className="whitespace-nowrap shrink-0"
            >
              <Button variant="danger" size="sm">
                {tr('dashboard.payNow')}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* ── Welcome hero ── */}
      <section className="auth-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-[0_34px_80px_-46px_rgba(45,21,27,0.8)] sm:p-9 fade-in">
        <span className="auth-glow -left-16 -top-20 h-56 w-56 bg-gold-300/20" aria-hidden="true" />
        <span className="auth-glow -bottom-24 right-0 h-64 w-64 bg-brand-600/60" aria-hidden="true" />
        <span className="auth-ring -right-10 -top-16 h-64 w-64" aria-hidden="true" />
        <span className="auth-ring right-10 top-4 h-40 w-40 border-gold-200/20" aria-hidden="true" />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold-200/25 bg-white/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
              {tr('login.secure')}
            </p>
            <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-[32px]">
              {tr('dashboard.welcome', { name: displayName })}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-100/75">
              {tr('dashboard.subtitle')}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-200/30 bg-gold-300/10 px-3 py-1 text-[11px] font-semibold text-gold-200">
                <Icon name="shield" className="h-3.5 w-3.5" />
                {roleLabel}
              </span>
              <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] text-brand-100/75">
                {tr('shell.signedInAs')}: {user.email || user.phone}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/12 bg-white/8 p-3 pr-5 backdrop-blur">
            <Avatar name={displayName} src={user?.photo} size="lg" />
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-[11px] text-brand-100/65">
                {tr('dashboard.memberSince')} · {lastLogin}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Personal Savings Summary ── */}
      <section className="mt-8" aria-labelledby="savings-title">
        <PageHeader
          title={tr('dashboard.mySavings')}
          subtitle={tr('dashboard.mySavingsSubtitle')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label={tr('dashboard.totalBalance')}
            value={formatMoney(totalBalance)}
            icon="wallet"
            tone="gold"
            href="/savings/my"
          />
          <StatCard
            label={tr('dashboard.monthlyDeposits')}
            value={formatMoney(monthlyDeposits)}
            icon="trendingUp"
            tone="sky"
            href="/savings/my/transactions"
          />
          <StatCard
            label={tr('dashboard.activeAccounts')}
            value={activeAccounts.toString()}
            icon="creditCard"
            tone="brand"
            href="/savings/my"
          />
        </div>
      </section>

      {/* ── Dues Summary ── */}
      <section className="mt-8" aria-labelledby="dues-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="dues-title" className="text-lg font-semibold tracking-tight text-brand-900">
              {tr('dashboard.myDues')}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {tr('dashboard.myDuesSubtitle')}
            </p>
          </div>
          <Link href="/savings/my/dues" className="shrink-0">
            <Button variant="secondary" size="sm">
              {tr('dashboard.viewAll')}
            </Button>
          </Link>
        </div>

        {totalDuesItems === 0 ? (
          <EmptyState
            icon="check-circle"
            title={tr('dashboard.noDues')}
            description={tr('dashboard.noDuesDesc')}
            className="py-12 rounded-2xl border border-brand-200 bg-white"
          />
        ) : (
          <div className="space-y-3">
            {hasOverdue && (
              <StatCard
                label={tr('dashboard.totalOverdue')}
                value={formatMoney(overdueAmount)}
                icon="alert"
                tone="rose"
                href="/savings/my/dues"
              />
            )}
            {dueCount > 0 && (
              <StatCard
                label={tr('dashboard.totalDue')}
                value={formatMoney(dueAmount)}
                icon="target"
                tone="amber"
                href="/savings/my/dues"
              />
            )}
            <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('savings.period')}</th>
                    <th className="th">{tr('savings.type')}</th>
                    <th className="th">{tr('savings.amount')}</th>
                    <th className="th">{tr('savings.status')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {dues.items.slice(0, 5).map((due) => (
                    <tr key={due._id} className="tr-hover">
                      <td className="td text-brand-700">{due.period}</td>
                      <td className="td capitalize text-brand-700">
                        {tr(`savings.${due.savingsType}`) || due.savingsType}
                      </td>
                      <td className="td font-mono font-semibold text-brand-900">
                        {formatMoney(due.totalDuePaisa || 0)}
                      </td>
                      <td className="td">
                        <StatusBadge status={due.status} />
                      </td>
                      <td className="td">
                        {due.status !== SAVINGS_DUE_STATUS.PAID && (
                          <Button
                            variant="primary"
                            size="xs"
                            loading={payingDueId === due._id}
                            onClick={() => handlePayDue(due._id)}
                          >
                            {tr('dashboard.payNow')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dues.items.length > 5 && (
                <div className="mt-4 text-center">
                  <Link href="/savings/my/dues">
                    <Button variant="ghost" size="sm">
                      {tr('dashboard.viewAll', { count: dues.items.length })}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Recent Transactions ── */}
      <section className="mt-8" aria-labelledby="transactions-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="transactions-title" className="text-lg font-semibold tracking-tight text-brand-900">
              {tr('dashboard.recentTransactions')}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {tr('dashboard.recentTransactionsSubtitle')}
            </p>
          </div>
          <Link href="/savings/my/transactions" className="shrink-0">
            <Button variant="secondary" size="sm">
              {tr('dashboard.viewAll')}
            </Button>
          </Link>
        </div>

        {transactions.items.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={tr('dashboard.noTransactions')}
            description={tr('dashboard.noTransactionsDesc')}
            className="py-12 rounded-2xl border border-brand-200 bg-white"
          />
        ) : (
          <div className="rounded-2xl border border-brand-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-brand-200 text-sm">
              <thead className="bg-brand-50/80">
                <tr>
                  <th className="th">{tr('approvals.date')}</th>
                  <th className="th">{tr('savings.account')}</th>
                  <th className="th">{tr('savings.type')}</th>
                  <th className="th">{tr('savings.amount')}</th>
                  <th className="th">{tr('savings.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200">
                {transactions.items.map((txn) => (
                  <tr key={txn._id} className="tr-hover">
                    <td className="td text-brand-700">{formatDate(txn.date)}</td>
                    <td className="td text-brand-700">
                      {txn.account?.accountNo || '-'}
                    </td>
                    <td className="td capitalize text-brand-700">
                      {tr(`savings.${txn.type}`) || txn.type}
                    </td>
                    <td className="td font-mono font-semibold text-brand-900">
                      {formatMoney(txn.amountPaisa || 0)}
                    </td>
                    <td className="td">
                      <StatusBadge status={txn.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Quick Actions ── */}
      <section className="mt-9" aria-labelledby="quick-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="quick-title" className="text-lg font-semibold tracking-tight text-brand-900">
              {tr('dashboard.quickActions')}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {tr('dashboard.quickActionsSubtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/payments" className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 transition group-hover:bg-rose-700 group-hover:text-white">
                <Icon name="creditCard" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-brand-900">{tr('dashboard.payDue')}</p>
            <p className="mt-0.5 text-xs text-brand-500">{tr('dashboard.payDueDesc')}</p>
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-rose-500 to-amber-400 transition-transform duration-300 group-hover:scale-x-100" />
          </Link>

          <Link href="/savings/my/transactions" className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 transition group-hover:bg-sky-700 group-hover:text-white">
                <Icon name="fileText" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-brand-900">{tr('dashboard.viewPassbook')}</p>
            <p className="mt-0.5 text-xs text-brand-500">{tr('dashboard.viewPassbookDesc')}</p>
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-sky-500 to-blue-500 transition-transform duration-300 group-hover:scale-x-100" />
          </Link>

          <Link href="/certificate" className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition group-hover:bg-amber-700 group-hover:text-white">
                <Icon name="award" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-brand-900">{tr('dashboard.downloadCertificate')}</p>
            <p className="mt-0.5 text-xs text-brand-500">{tr('dashboard.downloadCertificateDesc')}</p>
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-amber-500 to-gold-500 transition-transform duration-300 group-hover:scale-x-100" />
          </Link>

          <Link href="/profile" className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white">
                <Icon name="user" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-brand-900">{tr('dashboard.myProfile')}</p>
            <p className="mt-0.5 text-xs text-brand-500">{tr('dashboard.myProfileDesc')}</p>
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-500 to-brand-700 transition-transform duration-300 group-hover:scale-x-100" />
          </Link>
        </div>
      </section>
    </AppShell>
  );
}