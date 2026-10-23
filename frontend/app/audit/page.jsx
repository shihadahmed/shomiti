'use client';

import React from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, EmptyState, Icon } from '@/components/ui/common';

export default function AuditPage() {
  const { tr } = useLang();

  return (
    <AppShell>
      <PageHeader title={tr('nav.audit')} subtitle={tr('admin.auditTrail')} />
      <div className="card card-pad text-center py-12">
        <Icon name="file" className="mx-auto h-12 w-12 text-brand-300" />
        <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('nav.audit')}</h3>
        <p className="mt-2 text-brand-500">{tr('admin.auditTrail')}</p>
        <p className="mt-4 text-sm text-brand-400">This page is under development. Audit logs are available in Settings &rarr; Audit Log tab.</p>
      </div>
    </AppShell>
  );
}