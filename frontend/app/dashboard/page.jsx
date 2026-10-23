'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { Icon, Button, StatCard, PageHeader, EmptyState, formatMoney, formatDate } from '@/components/ui/common';

export default function DashboardPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  const { data: metrics, loading, error, reload } = useApi('/dashboard', undefined, {
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

  const displayName = lang === 'bn' && user.nameBn ? user.nameBn : user.name;
  const roleLabel = tr(`role.${user.role}`);
  const lastLogin = user.lastLoginAt
    ? formatDate(user.lastLoginAt, { time: true })
    : tr('common.na');

  const statCards = metrics ? [
    { label: tr('dashboard.totalMembers'), value: (metrics.totalMembers || 0).toLocaleString(), icon: 'users', tone: 'brand', href: '/members' },
    { label: tr('dashboard.totalSavings'), value: formatMoney(metrics.totalSavingsBalance || 0), icon: 'wallet', tone: 'gold', href: '/savings' },
    { label: tr('dashboard.todayCollection'), value: formatMoney(metrics.todayCollection || 0), icon: 'trendingUp', tone: 'sky', href: '/savings/transactions' },
    { label: tr('dashboard.monthCollection'), value: formatMoney(metrics.monthCollection || 0), icon: 'calendar', tone: 'sky', href: '/savings/transactions' },
    { label: tr('dashboard.totalDue'), value: formatMoney(metrics.totalDue || 0), icon: 'target', tone: 'rose', href: '/savings/dues' },
    { label: tr('dashboard.totalOverdue'), value: formatMoney(metrics.totalOverdue || 0), icon: 'alert', tone: 'rose', href: '/savings/dues' },
    { label: tr('dashboard.totalExpenses'), value: formatMoney(metrics.totalExpenses || 0), icon: 'calendar', tone: 'rose', href: '/expenses' },
    { label: tr('dashboard.availableFund'), value: formatMoney(metrics.availableFund || 0), icon: 'wallet', tone: 'gold', href: '/ledger' },
  ] : [];

  const pendingItems = metrics ? [
    { label: tr('dashboard.pendingPaymentSlips'), value: metrics.pendingPaymentSlips || 0, icon: 'file', href: '/approvals/slips' },
    { label: tr('dashboard.pendingExpenseApprovals'), value: metrics.pendingExpenseApprovals || 0, icon: 'shield', href: '/expenses' },
    { label: tr('dashboard.pendingApprovalRequests'), value: metrics.pendingApprovalRequests || 0, icon: 'clock', href: '/approvals' },
  ] : [];

  const trend = metrics?.monthlyCollection?.slice(-6).map((row) => ({
    label: `${String(row.month).padStart(2, '0')}/${row.year}`,
    totalPaisa: row.totalPaisa,
  })) || [];

  const maxTrend = trend.reduce((max, row) => Math.max(max, row.totalPaisa), 0) || 1;

  return (
    <AppShell>
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
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-300 text-base font-bold text-brand-950">
              {displayName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || '')
                .join('') || '?'}
            </span>
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="text-[11px] text-brand-100/65">
                {tr('dashboard.memberSince')} · {lastLogin}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Metrics ── */}
      <section className="mt-8" aria-labelledby="metrics-title">
        <PageHeader
          title={tr('dashboard.funds')}
          subtitle={tr('dashboard.subtitle')}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {statCards.map((card, index) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
              href={card.href}
              style={{ animationDelay: `${index * 60}ms` }}
            />
          ))}
        </div>
      </section>

      {/* ── Pending Actions ── */}
      <section className="mt-8" aria-labelledby="pending-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="pending-title" className="text-lg font-semibold tracking-tight text-brand-900">
              {tr('dashboard.pendingApprovals')}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {tr('dashboard.pendingActionsSubtitle')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {pendingItems.map((item, index) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value.toString()}
              icon={item.icon}
              tone="rose"
              href={item.href}
              style={{ animationDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
      </section>

      {/* ── Savings Trend ── */}
      <section className="mt-8" aria-labelledby="trend-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="trend-title" className="text-lg font-semibold tracking-tight text-brand-900">
              {tr('dashboard.monthlyTrend')}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {tr('dashboard.trendSubtitle')}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm">
          {trend.length === 0 ? (
            <EmptyState
              icon="trendingUp"
              title={tr('dashboard.noTrendData')}
              description={tr('dashboard.trendEmptyDesc')}
              className="py-12"
            />
          ) : (
            <div className="space-y-3">
              {trend.map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-brand-500">{row.label}</span>
                  <div className="flex-1 h-8 rounded-full bg-brand-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-700 to-gold-300 transition-all duration-500 ease-out"
                      style={{ width: `${(row.totalPaisa / maxTrend) * 100}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-sm font-mono font-semibold text-brand-900">
                    {formatMoney(row.totalPaisa)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Account details ── */}
      <section className="mt-8" aria-labelledby="account-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="account-title" className="text-lg font-semibold tracking-tight text-brand-900">
              {tr('members.account')}
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              {tr('dashboard.accountDetailsSubtitle')}
            </p>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 fade-in" style={{ animationDelay: '80ms' }}>
          <DetailCard label={tr('shell.signedInAs')} value={roleLabel} icon="shield" />
          <DetailCard label={tr('members.email')} value={user.email || tr('common.na')} icon="globe" mono />
          <DetailCard label={tr('members.phone')} value={user.phone || tr('common.na')} icon="phone" mono />
          <DetailCard label={tr('dashboard.memberSince')} value={lastLogin} icon="clock" />
        </section>
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
          <QuickAction
            icon="plus"
            title={tr('dashboard.addMember')}
            desc={tr('dashboard.addMemberDesc')}
            href="/members/add"
          />
          <QuickAction
            icon="wallet"
            title={tr('dashboard.newDeposit')}
            desc={tr('dashboard.newDepositDesc')}
            href="/savings/transactions?type=deposit"
          />
          <QuickAction
            icon="shield"
            title={tr('dashboard.approvals')}
            desc={tr('dashboard.approvalsDesc')}
            href="/approvals"
          />
          <QuickAction
            icon="calendar"
            title={tr('expenses.create')}
            desc={tr('dashboard.newExpenseDesc')}
            href="/expenses/create"
          />
        </div>
      </section>
    </AppShell>
  );
}

function DetailCard({ label, value, icon, mono = false }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/70">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-400">{label}</p>
        <p className={`mt-1 truncate text-[13px] font-semibold text-brand-900 ${mono ? 'font-mono' : ''}`} title={String(value)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function QuickAction({ icon, title, desc, href }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-gold-300">
          <Icon name={icon} className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-brand-900">{title}</p>
      <p className="mt-0.5 text-xs text-brand-500">{desc}</p>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-brand-700 to-gold-300 transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}