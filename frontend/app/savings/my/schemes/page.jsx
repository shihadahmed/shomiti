'use client';

import React, { useEffect, useState } from 'react';
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

export default function MySchemesPage() {
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);

  const { data, loading, error, reload } = useApi('/savings/my/schemes', undefined, {
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

  const schemes = data?.items || [];

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('savings.mySchemes')}
          subtitle={tr('savings.mySchemesSubtitle')}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={tr('savings.enrolledSchemes')}
          value={schemes.length.toString()}
          icon="target"
          tone="purple"
        />
        <StatCard
          label={tr('savings.monthlySchemes')}
          value={schemes.filter(s => s.scheme?.savingsType === 'monthly').length.toString()}
          icon="calendar"
          tone="blue"
        />
        <StatCard
          label={tr('savings.halfYearlySchemes')}
          value={schemes.filter(s => s.scheme?.savingsType === 'half_yearly').length.toString()}
          icon="calendar"
          tone="amber"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-medium text-brand-500">{tr('common.loading')}</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <Icon name="alert" className="mx-auto h-12 w-12 text-rose-500" />
          <h3 className="mt-4 text-lg font-semibold text-rose-700">{tr('common.error')}</h3>
          <p className="mt-2 text-sm text-rose-600">{error}</p>
        </div>
      ) : schemes.length === 0 ? (
        <EmptyState
          icon="target"
          title={tr('savings.noSchemes')}
          description={tr('savings.noSchemesDesc')}
          className="rounded-2xl border border-brand-200/80 bg-white p-8 shadow-xs"
        />
      ) : (
        <div className="space-y-4">
          {schemes.map((enrollment) => {
            const scheme = enrollment.scheme;
            if (!scheme) return null;
            const typeLabel = SCHEME_TYPE_LABELS[scheme.savingsType] || { en: scheme.savingsType, bn: scheme.savingsType };
            return (
              <div
                key={enrollment._id}
                className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                      <Icon name="target" className="h-7 w-7 text-purple-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-brand-900">{scheme.name || scheme.nameBn}</p>
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
                        {scheme.lateFeePercent && (
                          <>
                            <span className="text-brand-300">·</span>
                            <span>{scheme.lateFeePercent}% {tr('savings.lateFeePercent')}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end text-sm text-brand-600">
                    <span>{tr('savings.enrolledOn')}: {formatDate(enrollment.startDate)}</span>
                    <span className="text-brand-300">|</span>
                    <span>{tr('savings.nextDue')}: {formatDate(enrollment.nextDueDate)}</span>
                    <span className="text-brand-300">|</span>
                    <span>{tr('savings.maturity')}: {formatDate(enrollment.maturityDate)}</span>
                    {enrollment.status === 'active' && new Date(enrollment.nextDueDate) < new Date() && (
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                        {tr('savings.overdue')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-brand-100 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-brand-500">{tr('savings.principal')}</p>
                    <p className="font-semibold text-brand-900 font-mono">{formatMoney(scheme.principalPaisa)}</p>
                  </div>
                  <div>
                    <p className="text-brand-500">{tr('savings.installmentAmount')}</p>
                    <p className="font-semibold text-brand-900 font-mono">{formatMoney(scheme.principalPaisa)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}