'use client';

import React from 'react';
import { useLang } from '@/lib/useLang';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, EmptyState, Icon } from '@/components/ui/common';

export default function NotificationsPage() {
  const { tr } = useLang();

  return (
    <AppShell>
      <PageHeader title={tr('settings.notifications')} subtitle={tr('notifications.dueAlert')} />
      <div className="card card-pad text-center py-12">
        <Icon name="bell" className="mx-auto h-12 w-12 text-brand-300" />
        <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('settings.notifications')}</h3>
        <p className="mt-2 text-brand-500">{tr('notifications.dueAlert')}</p>
        <p className="mt-4 text-sm text-brand-400">This page is under development.</p>
      </div>
    </AppShell>
  );
}