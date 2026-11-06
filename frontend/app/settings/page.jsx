'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { Icon, Button, PageHeader, EmptyState, LoadingSpinner, formatDate, Tab, Tabs, Table, TableHeader, TableRow, TableCell, TableBody, Pagination } from '@/components/ui/common';
import { toast } from 'react-toastify';

export default function SettingsPage() {
  const router = useRouter();
  const { tr } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const hasRole = useAuthStore((state) => state.hasRole);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [auditPage, setAuditPage] = useState(1);

  const { data: auditData, loading: auditLoading, error: auditError } = useApi('/audit', {
    page: auditPage,
    limit: 25,
  }, { enabled: isAuthenticated && activeTab === 'audit' });

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

  const handleChangePassword = async () => {
    const current = window.prompt(tr('password.current'));
    if (!current) return;
    const newPass = window.prompt(tr('password.new'));
    if (!newPass) return;
    const confirm = window.prompt(tr('password.confirm'));
    if (newPass !== confirm) {
      alert(tr('password.mismatch'));
      return;
    }
    try {
      await apiPost('/auth/change-password', { currentPassword: current, newPassword: newPass });
      toast.success(tr('toast.passwordChanged'));
    } catch (requestError) {
      alert(requestError?.message || tr('error.generic'));
    }
  };

  const handleLogout = async () => {
    await logout();
  };

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

  const auditLogs = auditData?.items || [];
  const auditMeta = auditData?.meta || { total: 0, pages: 1 };

  const tabs = [
    { value: 'general', label: tr('settings.general') },
    ...(hasRole('super_admin') ? [{ value: 'audit', label: tr('settings.audit') }] : []),
  ];

  return (
    <AppShell>
      <PageHeader
        title={tr('settings.general')}
        subtitle={tr('settings.subtitle')}
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        {tabs.map(tab => <Tab key={tab.value} value={tab.value}>{tab.label}</Tab>)}
      </Tabs>

      {activeTab === 'general' && (
        <GeneralSettingsView onChangePassword={handleChangePassword} onLogout={handleLogout} />
      )}

      {activeTab === 'audit' && (
        <AuditLogView
          logs={auditLogs}
          meta={auditMeta}
          loading={auditLoading}
          error={auditError}
          page={auditPage}
          setPage={setAuditPage}
        />
      )}
    </AppShell>
  );
}

function GeneralSettingsView({ onChangePassword, onLogout }) {
  const { tr } = useLang();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <section className="card card-pad">
        <h3 className="text-lg font-semibold text-brand-900 mb-4">{tr('settings.account')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.name')}</p>
            <p className="mt-1 font-medium text-brand-900">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.email')}</p>
            <p className="mt-1 font-medium text-brand-900">{user?.email || tr('common.na')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.phone')}</p>
            <p className="mt-1 font-medium text-brand-900">{user?.phone}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('role.0')}</p>
            <p className="mt-1 font-medium text-brand-900">{user?.role ? tr(`role.${user.role}`) : tr('role.0')}</p>
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <h3 className="text-lg font-semibold text-brand-900 mb-4">{tr('settings.security')}</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onChangePassword}>
            <Icon name="lock" className="h-4 w-4" />
            {tr('shell.changePassword')}
          </Button>
          <Button variant="danger" onClick={onLogout}>
            <Icon name="logout" className="h-4 w-4" />
            {tr('shell.logout')}
          </Button>
        </div>
      </section>

      <section className="card card-pad">
        <h3 className="text-lg font-semibold text-brand-900 mb-4">{tr('settings.preferences')}</h3>
        <p className="text-sm text-brand-500">{tr('settings.preferencesDesc')}</p>
      </section>
    </div>
  );
}

function AuditLogView({ logs, meta, loading, error, page, setPage }) {
  const { tr } = useLang();

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

  if (logs.length === 0) {
    return <EmptyState icon="file" title={tr('settings.noAuditLogs')} description={tr('common.noData')} className="p-12" />;
  }

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>{tr('settings.auditAction')}</TableCell>
              <TableCell>{tr('settings.auditEntity')}</TableCell>
              <TableCell>{tr('settings.auditActor')}</TableCell>
              <TableCell>{tr('settings.auditDate')}</TableCell>
              <TableCell>{tr('settings.auditIp')}</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log._id} className="tr-hover">
                <TableCell className="font-medium text-brand-900">{log.action}</TableCell>
                <TableCell className="text-brand-700">{log.entityType} {log.entityId ? `#${String(log.entityId).slice(0, 8)}` : ''}</TableCell>
                <TableCell className="text-brand-700">{log.actor?.name || '-'}</TableCell>
                <TableCell className="text-brand-700 font-mono">{formatDate(log.at, { time: true })}</TableCell>
                <TableCell className="text-brand-500 font-mono text-xs">{log.ip || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}
