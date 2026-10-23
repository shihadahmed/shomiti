'use client';

import React from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, EmptyState, Icon } from '@/components/ui/common';

export default function StatementPage() {
  const { tr } = useLang();

  return (
    <AppShell>
      <PageHeader title={tr('statement.title')} subtitle={tr('statement.credit')} />
      <div className="card card-pad text-center py-12">
        <Icon name="file" className="mx-auto h-12 w-12 text-brand-300" />
        <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('statement.title')}</h3>
        <p className="mt-2 text-brand-500">{tr('statement.credit')} / {tr('statement.debit')}</p>
        <p className="mt-4 text-sm text-brand-400">This page is under development.</p>
      </div>
    </AppShell>
  );
}