'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner,
  Badge, Modal, Table, TableHeader, TableBody, TableRow, TableCell,
  SearchInput, Pagination, StatCard, Dropdown, DropdownItem, Tooltip,
  Avatar, FormatDate
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'users.roleOptions.super_admin', color: 'badge-red', icon: 'shield' },
  { value: 'president', label: 'users.roleOptions.president', color: 'badge-purple', icon: 'award' },
  { value: 'general_secretary', label: 'users.roleOptions.general_secretary', color: 'badge-blue', icon: 'users' },
  { value: 'treasurer', label: 'users.roleOptions.treasurer', color: 'badge-amber', icon: 'wallet' },
  { value: 'member', label: 'users.roleOptions.member', color: 'badge-green', icon: 'user' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'users.statusOptions.active', color: 'badge-green' },
  { value: 'inactive', label: 'users.statusOptions.inactive', color: 'badge-slate' },
  { value: 'suspended', label: 'users.statusOptions.suspended', color: 'badge-amber' },
  { value: 'resigned', label: 'users.statusOptions.resigned', color: 'badge-red' },
];

const ROLE_BADGE_COLORS = {
  super_admin: 'badge-red',
  president: 'badge-purple',
  general_secretary: 'badge-blue',
  treasurer: 'badge-amber',
  member: 'badge-green',
};

const STATUS_BADGE_COLORS = {
  active: 'badge-green',
  inactive: 'badge-slate',
  suspended: 'badge-amber',
  resigned: 'badge-red',
};

const EXECUTIVE_ROLES = ['super_admin', 'president', 'general_secretary', 'treasurer'];

export default function UsersPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const currentUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRole = useAuthStore((state) => state.hasRole);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userPage, setUserPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ role: '', isActive: true });
  const [userErrors, setUserErrors] = useState({});
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(null);

  const isSuperAdmin = hasRole('super_admin');
  const isExecutive = hasRole(...EXECUTIVE_ROLES);

  const { data: userData, loading: userLoading, error: userError, reload: reloadUsers } = useApi('/auth/users', {
    page: userPage,
    limit: 15,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  }, { enabled: isAuthenticated });

  const { data: metricsData, loading: metricsLoading } = useApi('/auth/users/metrics', {}, {
    enabled: isAuthenticated && isExecutive,
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setUserPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm({ role: '', isActive: true });
    setUserErrors({});
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setUserErrors({});

    if (!editingUser) return;

    setUserSubmitting(true);
    try {
      // Update role if changed
      if (userForm.role !== editingUser.role) {
        await useApi().then(({ apiPatch }) => apiPatch(`/auth/users/${editingUser._id}/role`, { role: userForm.role }));
        toast.success(tr('users.roleUpdated'));
      }

      // Update status if changed
      if (userForm.isActive !== editingUser.isActive) {
        await useApi().then(({ apiPatch }) => apiPatch(`/auth/users/${editingUser._id}/status`, { isActive: userForm.isActive }));
        toast.success(tr('users.statusUpdated'));
      }

      closeUserModal();
      reloadUsers();
    } catch (requestError) {
      const msg = requestError?.message || tr('error.generic');
      if (msg.includes('SELF_DEMOTION_FORBIDDEN') || msg.includes('own role')) {
        setUserErrors({ submit: tr('users.cannotDemoteSelf') });
      } else if (msg.includes('EXECUTIVE_ROLE_RESTRICTED') || msg.includes('executive')) {
        setUserErrors({ submit: tr('users.executiveRoleRestricted') });
      } else if (msg.includes('SELF_SUSPENSION_FORBIDDEN') || msg.includes('own account')) {
        setUserErrors({ submit: tr('users.cannotSuspendSelf') });
      } else {
        setUserErrors({ submit: msg });
      }
    } finally {
      setUserSubmitting(false);
    }
  };

  const handlePasswordReset = async (user) => {
    if (!window.confirm(tr('users.confirmResetPassword'))) return;

    try {
      const result = await useApi().then(({ apiPost }) => apiPost(`/auth/users/${user._id}/reset-password`, {}));
      if (result.temporaryPassword) {
        toast.success(tr('users.passwordResetSuccess', { password: result.temporaryPassword }), { duration: 10000 });
      } else {
        toast.success(tr('users.passwordReset'));
      }
      reloadUsers();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const handleStatusChange = async (userId, isActive, userName) => {
    if (!window.confirm(tr('users.confirmStatusChange'))) return;
    try {
      await useApi().then(({ apiPatch }) => apiPatch(`/auth/users/${userId}/status`, { isActive }));
      toast.success(tr('users.statusUpdated'));
      reloadUsers();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const getRoleBadgeColor = (role) => ROLE_BADGE_COLORS[role] || 'badge-slate';
  const getStatusBadgeColor = (isActive) => isActive ? 'badge-green' : 'badge-red';
  const getStatusLabel = (isActive) => isActive ? tr('users.statusActive') : tr('users.statusInactive');

  const canEditUser = (userId) => {
    if (userId === currentUser?._id) return false;
    if (!isExecutive) return false;
    if (!isSuperAdmin && EXECUTIVE_ROLES.includes(editingUser?.role)) return false;
    return true;
  };

  const canResetPassword = () => isSuperAdmin;

  const metrics = metricsData || {
    totalUsers: 0,
    executiveLeaders: 0,
    activeMembers: 0,
    inactiveAccounts: 0,
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

  if (!isExecutive) {
    return (
      <AppShell>
        <PageHeader
          title={tr('nav.users')}
          subtitle={tr('error.forbidden')}
        />
        <div className="card card-pad text-center py-12">
          <Icon name="alert" className="mx-auto h-12 w-12 text-amber-500" />
          <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('error.forbidden')}</h3>
          <p className="mt-2 text-brand-500">Access restricted to administrative staff.</p>
        </div>
      </AppShell>
    );
  }

  const users = userData?.items || [];
  const userMeta = userData?.meta || { total: 0, pages: 1 };

  const roleFilterOptions = isSuperAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(r => r.value === 'member');

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Icon name="users" className="h-6 w-6 text-brand-700" />
              <span>{tr('users.title')}</span>
            </div>
          }
          subtitle={tr('users.subtitle')}
        />

        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={tr('users.totalUsers')}
            value={metrics.totalUsers || userMeta.total || 0}
            icon="users"
            tone="brand"
          />
          <StatCard
            label={tr('users.executiveLeaders')}
            value={metrics.executiveLeaders || 0}
            icon="award"
            tone="gold"
          />
          <StatCard
            label={tr('users.activeMembers')}
            value={metrics.activeMembers || users.filter(u => u.isActive).length}
            icon="check"
            tone="sky"
          />
          <StatCard
            label={tr('users.inactiveAccounts')}
            value={metrics.inactiveAccounts || users.filter(u => !u.isActive).length}
            icon="alert"
            tone="rose"
          />
        </div>

        {/* Filters & Search */}
        <div className="card card-pad">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={tr('users.searchPlaceholder')}
              className="w-full sm:w-80"
            />
            <div className="flex flex-wrap gap-3">
              <Select
                value={roleFilter}
                onChange={setRoleFilter}
                options={[{ value: '', label: tr('users.allRoles') }, ...roleFilterOptions]}
                className="w-40"
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: tr('users.allStatuses') },
                  { value: 'active', label: tr('users.statusActive') },
                  { value: 'inactive', label: tr('users.statusInactive') },
                  { value: 'suspended', label: tr('users.statusSuspended') },
                  { value: 'resigned', label: tr('users.statusResigned') },
                ]}
                className="w-40"
              />
            </div>
          </div>
        </div>

        {/* Users Table */}
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
                    <TableCell colSpan={7} className="text-center py-8">
                      <LoadingSpinner size="md" />
                    </TableCell>
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
                  users.map((user) => (
                    <TableRow key={user._id} className="tr-hover">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={user.name}
                            src={user.avatar}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-brand-900 truncate">{user.name}</p>
                            <p className="text-xs text-brand-500 truncate">
                              @{user.phone?.slice(-4) || 'user'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="font-mono text-sm text-brand-700">
                          {user.member?.code || tr('common.na')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-sm text-brand-700">
                            <Icon name="phone" className="h-3.5 w-3.5 text-brand-400" />
                            <span className="font-mono">{user.phone}</span>
                          </div>
                          {user.email && (
                            <div className="flex items-center gap-1.5 text-sm text-brand-500">
                              <Icon name="globe" className="h-3.5 w-3.5 text-brand-400" />
                              <span className="truncate max-w-xs">{user.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getRoleBadgeColor(user.role)}>
                          <Icon name={ROLE_OPTIONS.find(r => r.value === user.role)?.icon || 'user'} className="h-3 w-3 mr-1" />
                          {tr(`users.role${user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/_/g, '')}`) || tr(`role.${user.role}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={getStatusBadgeColor(user.isActive)}>
                          {getStatusLabel(user.isActive)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <FormatDate date={user.lastLoginAt} showTime />
                        <span className="text-xs text-brand-400 ml-1">
                          {user.lastLoginAt ? '' : `(${tr('users.never')})`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canResetPassword() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePasswordReset(user)}
                              aria-label={tr('users.resetPassword')}
                              className="text-brand-600 hover:bg-brand-50"
                            >
                              <Icon name="lock" className="h-4 w-4" />
                              <span className="hidden sm:inline">{tr('users.resetPassword')}</span>
                            </Button>
                          )}
                          {canEditUser(user._id) && (
                            <Dropdown
                              trigger={
                                <Button variant="ghost" size="sm" className="text-brand-600 hover:bg-brand-50">
                                  <Icon name="edit" className="h-4 w-4" />
                                  <span className="hidden sm:inline">{tr('users.editUser')}</span>
                                </Button>
                              }
                              items={[
                                {
                                  label: tr('users.changeRole'),
                                  onClick: () => openEditUser(user),
                                  icon: 'users',
                                },
                                {
                                  label: tr('users.changeStatus'),
                                  onClick: () => handleStatusChange(user._id, !user.isActive, user.name),
                                  icon: user.isActive ? 'alert' : 'check',
                                },
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

        {/* Edit User Modal */}
        <UserEditModal
          open={showUserModal}
          onClose={closeUserModal}
          title={tr('users.editUser')}
          user={editingUser}
          form={userForm}
          errors={userErrors}
          onChange={setUserForm}
          submitting={userSubmitting}
          onSubmit={handleUserSubmit}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUser?._id}
          roleOptions={ROLE_OPTIONS}
          tr={tr}
        />
      </div>
    </AppShell>
  );
}

function UserEditModal({
  open,
  onClose,
  title,
  user,
  form,
  errors,
  onChange,
  submitting,
  onSubmit,
  isSuperAdmin,
  currentUserId,
  roleOptions,
  tr,
}) {
  if (!open || !user) return null;

  const availableRoles = isSuperAdmin
    ? roleOptions
    : roleOptions.filter(r => r.value === 'member');

  const isSelf = user._id === currentUserId;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4" />
            {errors.submit}
          </div>
        )}

        <FormSection title={tr('settings.userDetails')}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-brand-50 rounded-xl">
              <Avatar name={user.name} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brand-900 truncate">{user.name}</p>
                <p className="text-sm text-brand-500 font-mono">{user.phone}</p>
                {user.email && <p className="text-sm text-brand-500 truncate">{user.email}</p>}
                {user.member && (
                  <p className="text-xs text-brand-400 mt-1">
                    {tr('users.memberId')}: <span className="font-mono text-brand-600">{user.member.code}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={tr('users.role')}
                value={form.role}
                onChange={(e) => onChange({ ...form, role: e.target.value })}
                required
                options={availableRoles}
                disabled={isSelf}
              />
              <Select
                label={tr('users.status')}
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => onChange({ ...form, isActive: e.target.value === 'active' })}
                required
                options={[
                  { value: 'active', label: tr('users.statusActive') },
                  { value: 'inactive', label: tr('users.statusInactive') },
                  { value: 'suspended', label: tr('users.statusSuspended') },
                  { value: 'resigned', label: tr('users.statusResigned') },
                ]}
                disabled={isSelf}
              />
            </div>

            {isSelf && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 flex items-center gap-2">
                <Icon name="alert" className="h-4 w-4" />
                {tr('users.cannotEditSelf')}
              </div>
            )}

            {!isSuperAdmin && (
              <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 flex items-center gap-2">
                <Icon name="info" className="h-4 w-4" />
                Only Super Admin can assign executive roles (President, GS, Treasurer, Super Admin).
              </div>
            )}
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {tr('common.save')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}