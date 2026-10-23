'use client';

import React from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, EmptyState, Icon } from '@/components/ui/common';

export default function MySchemesPage() {
  const { tr } = useLang();

  return (
    <AppShell>
      <PageHeader title={tr('savings.mySchemes')} subtitle={tr('savings.activeSchemes')} />
      <div className="card card-pad text-center py-12">
        <Icon name="target" className="mx-auto h-12 w-12 text-brand-300" />
        <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('savings.mySchemes')}</h3>
        <p className="mt-2 text-brand-500">{tr('savings.monthlyScheme')} / {tr('savings.halfYearlyScheme')} / {tr('savings.oneTimeScheme')}</p>
        <p className="mt-4 text-sm text-brand-400">This page is under development.</p>
      </div>
    </AppShell>
  );
}