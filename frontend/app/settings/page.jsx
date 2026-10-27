'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatDate, StatusBadge, Pagination, SearchInput, FilterBar, Modal, Tab, Tabs, Table, TableHeader, TableRow, TableCell, TableBody, Tooltip, Dropdown, DropdownItem } from '@/components/ui/common';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'treasurer', label: 'role.treasurer' },
  { value: 'general_secretary', label: 'role.general_secretary' },
  { value: 'president', label: 'role.president' },
  { value: 'member', label: 'role.member' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'status.active' },
  { value: 'inactive', label: 'status.inactive' },
  { value: 'suspended', label: 'status.suspended' },
  { value: 'resigned', label: 'status.resigned' },
  { value: 'archived', label: 'status.archived' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const currentUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const hasRole = useAuthStore((state) => state.hasRole);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [userPage, setUserPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(null);

  const { data: userData, loading: userLoading, error: userError, reload: reloadUsers } = useApi('/auth/users', {
    page: userPage,
    limit: 15,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    search: searchQuery || undefined,
  }, { enabled: isAuthenticated && activeTab === 'users' });

  const { data: auditData, loading: auditLoading, error: auditError, reload: reloadAudit } = useApi('/audit', {
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

  // User Management Actions
  const handleRoleChange = async (userId, newRole, userName) => {
    if (!window.confirm(tr('users.confirmRoleChange'))) return;
    try {
      await apiPatch(`/auth/users/${userId}/role`, { role: newRole });
      toast.success(tr('users.roleAssigned'));
      reloadUsers();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const handleStatusChange = async (userId, isActive, userName) => {
    if (!window.confirm(tr('users.confirmStatusChange'))) return;
    try {
      await apiPatch(`/auth/users/${userId}/status`, { isActive });
      toast.success(tr('users.statusUpdated'));
      reloadUsers();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const handlePasswordReset = async (userId, userName) => {
    if (!window.confirm(`${tr('shell.resetPassword')} ${userName}?`)) return;
    try {
      const result = await apiPost(`/auth/users/${userId}/reset-password`, {});
      if (result.temporaryPassword) {
        alert(`${tr('users.temporaryPassword', { password: result.temporaryPassword })}`);
      } else {
        toast.success(tr('users.passwordReset'));
      }
      reloadUsers();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const canAssignExecutiveRoles = hasRole('super_admin');
  const isSelf = (userId) => currentUser?._id === userId;

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

  const users = userData?.items || [];
  const userMeta = userData?.meta || { total: 0, pages: 1 };
  const auditLogs = auditData?.items || [];
  const auditMeta = auditData?.meta || { total: 0, pages: 1 };

  const tabs = [
    { value: 'general', label: tr('settings.general') },
    { value: 'users', label: tr('settings.users') },
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

      {activeTab === 'users' && (
        <UserManagementView
          users={users}
          meta={userMeta}
          loading={userLoading}
          error={userError}
          page={userPage}
          setPage={setUserPage}
          onRoleChange={handleRoleChange}
          onStatusChange={handleStatusChange}
          onPasswordReset={handlePasswordReset}
          canAssignExecutiveRoles={canAssignExecutiveRoles}
          isSelf={isSelf}
          currentUser={currentUser}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />
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
            <p className="mt-1 font-medium text-brand-900">{tr(`role.${user?.role}`)}</p>
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

function UserManagementView({
  users,
  meta,
  loading,
  error,
  page,
  setPage,
  onEdit,
  onRoleChange,
  onStatusChange,
  onPasswordReset,
  canAssignExecutiveRoles,
  isSelf,
  currentUser,
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
}) {
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

  const filteredRoleOptions = canAssignExecutiveRoles
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(opt => opt.value === 'member');

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-brand-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <h3 className="text-lg font-semibold text-brand-900">{tr('settings.users')}</h3>
          <div className="flex gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={tr('shell.searchPlaceholder')}
              className="w-64"
            />
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={[{ value: '', label: tr('common.all') }, ...ROLE_OPTIONS]}
              className="w-40"
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: '', label: tr('common.all') }, ...STATUS_OPTIONS]}
              className="w-40"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>{tr('members.name')}</TableCell>
              <TableCell>{tr('members.email')}</TableCell>
              <TableCell>{tr('members.phone')}</TableCell>
              <TableCell>{tr('settings.member')}</TableCell>
              <TableCell>{tr('settings.role')}</TableCell>
              <TableCell>{tr('settings.status')}</TableCell>
              <TableCell>{tr('settings.lastLogin')}</TableCell>
              <TableCell className="text-right">{tr('members.actions')}</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <EmptyState icon="users" title={tr('settings.noUsers')} description={tr('common.noData')} />
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u._id} className="tr-hover">
                  <TableCell className="font-medium text-brand-900">{u.name}</TableCell>
                  <TableCell className="text-brand-700">{u.email || '-'}</TableCell>
                  <TableCell className="font-mono text-brand-700">{u.phone}</TableCell>
                  <TableCell className="text-brand-700">
                    {u.member ? (
                      <span className="text-sm">{u.member.name} ({u.member.code})</span>
                    ) : (
                      <span className="text-brand-400 italic">{tr('common.na')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Dropdown
                      trigger={
                        <span className="badge badge-brand cursor-pointer select-none">
                          {tr(`role.${u.role}`)}
                          <Icon name="chevronDown" className="h-3 w-3 ml-1 inline" />
                        </span>
                      }
                      items={
                        filteredRoleOptions
                          .filter(opt => opt.value !== u.role)
                          .filter(opt => {
                            // Prevent self-demotion
                            if (isSelf(u._id)) return false;
                            // Only super_admin can assign executive roles
                            if (!canAssignExecutiveRoles && opt.value !== 'member') return false;
                            return true;
                          })
                          .map(opt => ({
                            label: tr(opt.label),
                            onClick: () => onRoleChange(u._id, opt.value, u.name),
                            disabled: isSelf(u._id),
                          }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Dropdown
                      trigger={
                        <StatusBadge status={u.isActive ? 'active' : 'inactive'} className="cursor-pointer" />
                      }
                      items={[
                        { label: tr('status.active'), onClick: () => onStatusChange(u._id, true, u.name), disabled: u.isActive || isSelf(u._id) },
                        { label: tr('status.inactive'), onClick: () => onStatusChange(u._id, false, u.name), disabled: !u.isActive || isSelf(u._id) },
                        { label: tr('status.suspended'), onClick: () => onStatusChange(u._id, false, u.name), disabled: !u.isActive || isSelf(u._id), className: 'text-orange-600' },
                      ]}
                    />
                  </TableCell>
                  <TableCell className="text-brand-700">{u.lastLoginAt ? formatDate(u.lastLoginAt, { time: true }) : tr('common.na')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isSelf(u._id) && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onPasswordReset(u._id, u.name)}
                          title={tr('shell.resetPassword')}
                        >
                          <Icon name="lock" className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => {
                        router.push('/users');
                      }}>
                        <Icon name="edit" className="h-4 w-4" />
                        {tr('common.edit')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination meta={meta} onPage={setPage} />
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
