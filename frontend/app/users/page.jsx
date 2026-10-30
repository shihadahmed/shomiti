'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPatch, apiPost, apiDelete } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import UserEditModal from '@/components/ui/UserEditModal';
import {
  Icon, Button, Select, PageHeader, EmptyState, LoadingSpinner,
  Badge, Table, TableHeader, TableBody, TableRow, TableCell,
  SearchInput, Pagination, StatCard, Dropdown, Avatar, FormatDate
} from '@/components/ui/common';
import { toast } from 'react-toastify';

const EXECUTIVE_ROLES = ['super_admin', 'president', 'general_secretary', 'treasurer'];

export default function UsersPage() {
  const router = useRouter();
  const { tr } = useLang();
  const currentUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRole = useAuthStore((state) => state.hasRole);

  const isSuperAdmin = hasRole('super_admin');
  const isExecutive = hasRole(...EXECUTIVE_ROLES);

  const [userPage, setUserPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ role: '', isActive: true, name: '', email: '', phone: '', password: '' });
  const [userErrors, setUserErrors] = useState({});
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Database theke dynamically roles load kora
  const { data: rolesApiData } = useApi(
    '/roles',
    { limit: 100 },
    { enabled: isAuthenticated && isExecutive }
  );

  // Dynamic role options toiri kora
  const roleOptions = useMemo(() => {
    const dbRoles = rolesApiData?.items || [];
    if (!dbRoles.length) return [];

    return dbRoles.map((r) => ({
      value: r.name,
      label: r.name === 'super_admin' ? 'Super Admin' : r.name.replace(/_/g, ' ').toUpperCase(),
    }));
  }, [rolesApiData]);

  // Form-e default role set kora jodi faka thake
  useEffect(() => {
    if (!userForm.role && roleOptions.length > 0) {
      setUserForm((prev) => ({ ...prev, role: roleOptions[0].value }));
    }
  }, [roleOptions, userForm.role]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setUserPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = useMemo(() => {
    const q = { page: userPage, limit: 15 };
    if (debouncedSearch) q.search = debouncedSearch;
    if (roleFilter) q.role = roleFilter;
    if (statusFilter) q.status = statusFilter;
    return q;
  }, [userPage, debouncedSearch, roleFilter, statusFilter]);

  const { data: userData, loading: userLoading, error: userError, reload: reloadUsers } = useApi(
    '/auth/users',
    queryParams,
    { enabled: isAuthenticated && isExecutive }
  );

  const { data: metricsData, reload: reloadMetrics } = useApi('/auth/users/metrics', {}, { enabled: isAuthenticated && isExecutive });

  if (!isAuthenticated) return null;

  if (!isExecutive) {
    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader title={tr('nav.users')} subtitle={tr('error.forbidden')} />
          <div className="card card-pad text-center py-12">
            <Icon name="alert" className="mx-auto h-12 w-12 text-amber-500" />
            <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('error.forbidden')}</h3>
            <p className="mt-2 text-brand-500">Access restricted to administrative staff.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const users = userData?.items || [];
  const userMeta = userData?.meta || { total: 0, pages: 1 };
  const metrics = metricsData || { totalUsers: 0, executiveLeaders: 0, activeMembers: 0, inactiveAccounts: 0 };

  const openAddUser = () => {
    setEditingUser(null);
    setUserForm({
      role: roleOptions[0]?.value || 'member',
      isActive: true,
      name: '',
      email: '',
      phone: '',
      nid: '',
    });
    setUserErrors({});
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    if (user._id === currentUser?._id) {
      toast.error(tr('users.cannotEditSelf'));
      return;
    }
    setEditingUser(user);
    setUserForm({ role: user.role, isActive: user.isActive });
    setUserErrors({});
    setShowUserModal(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setUserErrors({});
    setUserSubmitting(true);
    try {
      if (editingUser) {
        if (userForm.role !== editingUser.role) {
          await apiPatch(`/auth/users/${editingUser._id}/role`, { role: userForm.role });
          toast.success(tr('users.roleUpdated'));
        }
        if (userForm.isActive !== editingUser.isActive) {
          await apiPatch(`/auth/users/${editingUser._id}/status`, { isActive: userForm.isActive });
          toast.success(tr('users.statusUpdated'));
        }
      } else {
        const res = await apiPost('/auth/users', userForm);
        if (res?.data?.emailSent) {
          toast.success(tr('users.inviteSent'));
        } else {
          toast.success(tr('users.created'));
        }
      }
      setShowUserModal(false);
      reloadUsers();
      reloadMetrics();
    } catch (err) {
      setUserErrors({ submit: err?.message || tr('error.generic') });
    } finally {
      setUserSubmitting(false);
    }
  };

  const handlePasswordReset = async (user) => {
    if (!window.confirm(tr('users.confirmResetPassword'))) return;
    try {
      const res = await apiPost(`/auth/users/${user._id}/reset-password`, {});
      if (res?.temporaryPassword) {
        toast.success(tr('users.passwordResetSuccess', { password: res.temporaryPassword }), { duration: 10000 });
      } else {
        toast.success(tr('users.passwordReset'));
      }
      reloadUsers();
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    }
  };

  const handleStatusToggle = async (userId, nextStatus) => {
    if (!window.confirm(tr('users.confirmStatusChange'))) return;
    try {
      await apiPatch(`/auth/users/${userId}/status`, { isActive: nextStatus });
      toast.success(tr('users.statusUpdated'));
      reloadUsers();
      reloadMetrics();
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    }
  };

  const handleDeleteUser = async (user) => {
    if (user._id === currentUser?._id) {
      toast.error(tr('users.cannotDeleteSelf'));
      return;
    }
    if (user.role === 'super_admin') {
      toast.error('Super Admin account cannot be deleted.');
      return;
    }
    if (!window.confirm(tr('users.confirmDelete', { name: user.name }))) return;
    try {
      await apiDelete(`/auth/users/${user._id}`);
      toast.success(tr('users.deleted'));
      reloadUsers();
      reloadMetrics();
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Icon name="users" className="h-6 w-6 text-brand-700" />
              <span>{tr('users.title')}</span>
            </div>
          }
          subtitle={tr('users.subtitle')}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex bg-brand-100 rounded-xl p-1" role="tablist">
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-brand-900 shadow-sm"
                >
                  <Icon name="users" className="h-4 w-4" />
                  <span>{tr('users.title')}</span>
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => router.push('/roles')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-brand-600 hover:text-brand-900 transition-all"
                  >
                    <Icon name="shield" className="h-4 w-4" />
                    <span>{tr('roles.title')}</span>
                  </button>
                )}
              </div>
              {isSuperAdmin && (
                <Button variant="primary" onClick={openAddUser}>
                  <Icon name="plus" className="h-4 w-4" />
                  {tr('users.add')}
                </Button>
              )}
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={tr('users.totalUsers')} value={metrics.totalUsers || userMeta.total || 0} icon="users" tone="brand" />
          <StatCard label={tr('users.executiveLeaders')} value={metrics.executiveLeaders || 0} icon="award" tone="gold" />
          <StatCard label={tr('users.activeMembers')} value={metrics.activeMembers || 0} icon="check" tone="sky" />
          <StatCard label={tr('users.inactiveAccounts')} value={metrics.inactiveAccounts || 0} icon="alert" tone="rose" />
        </div>

        <div className="card card-pad">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={tr('users.searchPlaceholder')}
              className="w-full sm:w-80"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                options={[{ value: '', label: tr('users.allRoles') }, ...roleOptions]}
                className="w-40"
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: tr('users.allStatuses') },
                  { value: 'active', label: tr('users.statusActive') },
                  { value: 'inactive', label: tr('users.statusInactive') },
                ]}
                className="w-40"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="w-56">{tr('users.identity')}</TableCell>
                  <TableCell className="w-40 hidden md:table-cell">{tr('users.memberId')}</TableCell>
                  <TableCell className="w-48">{tr('users.contact')}</TableCell>
                  <TableCell className="w-32 text-center">{tr('users.role')}</TableCell>
                  <TableCell className="w-28 text-center">{tr('users.status')}</TableCell>
                  <TableCell className="w-40">{tr('users.lastActivity')}</TableCell>
                  <TableCell className="w-40 text-right">{tr('users.actions')}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8"><LoadingSpinner size="md" /></TableCell>
                  </TableRow>
                ) : userError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <EmptyState icon="alert" title={tr('common.error')} description={tr('users.error.loadFailed')} />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <EmptyState icon="users" title={tr('users.noUsers')} description={tr('common.noData')} />
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u._id} className="tr-hover">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="md" />
                          <div className="min-w-0">
                            <p className="font-medium text-brand-900 truncate">{u.name}</p>
                            <p className="text-xs text-brand-500 truncate">@{u.phone?.slice(-4) || 'user'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="font-mono text-sm text-brand-700">{u.member?.code || tr('common.na')}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-brand-700 font-mono">
                            <Icon name="phone" className="h-3.5 w-3.5 text-brand-400" />
                            <span>{u.phone}</span>
                          </div>
                          {u.email && (
                            <div className="flex items-center gap-1.5 text-xs text-brand-500 truncate max-w-xs">
                              <Icon name="globe" className="h-3.5 w-3.5 text-brand-400" />
                              <span>{u.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="badge-slate">
                          {u.role === 'super_admin' ? 'Super Admin' : u.role.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={u.isActive ? 'badge-green' : 'badge-red'}>
                          {u.isActive ? tr('users.statusActive') : tr('users.statusInactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <FormatDate date={u.lastLoginAt} showTime />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isSuperAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => handlePasswordReset(u)}>
                              <Icon name="lock" className="h-4 w-4" />
                            </Button>
                          )}
                          {isSuperAdmin && u._id !== currentUser?._id && u.role !== 'super_admin' && (
                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteUser(u)}>
                              <Icon name="trash" className="h-4 w-4" />
                            </Button>
                          )}
                          {u._id !== currentUser?._id && (
                            <Dropdown
                              trigger={
                                <Button variant="ghost" size="sm">
                                  <Icon name="edit" className="h-4 w-4" />
                                </Button>
                              }
                              items={[
                                ...(u.role !== 'super_admin'
                                  ? [{ label: tr('users.changeRole'), onClick: () => openEditUser(u), icon: 'users' }]
                                  : []),
                                { label: tr('users.changeStatus'), onClick: () => handleStatusToggle(u._id, !u.isActive), icon: u.isActive ? 'alert' : 'check' },
                              ]}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={userMeta} onPage={setUserPage} />
        </div>

        {/* Dynamic roleOptions pass kora hoyeche */}
        <UserEditModal
          open={showUserModal}
          onClose={() => setShowUserModal(false)}
          user={editingUser}
          form={userForm}
          errors={userErrors}
          onChange={setUserForm}
          submitting={userSubmitting}
          onSubmit={handleUserSubmit}
          currentUserId={currentUser?._id}
          roleOptions={roleOptions}
          tr={tr}
        />
      </div>
    </AppShell>
  );
}