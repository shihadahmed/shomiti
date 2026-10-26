'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost, apiPatch, apiDelete } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import RoleModal from '@/components/ui/RoleModal';
import {
  Icon, Button, PageHeader, EmptyState, LoadingSpinner,
  Badge, Table, TableHeader, TableBody, TableRow, TableCell,
  SearchInput, Pagination, Progress
} from '@/components/ui/common';
import toast from 'react-hot-toast';

const PERMISSION_CATEGORIES = [
  {
    key: 'members',
    labelKey: 'perm.members',
    permissions: [
      { key: 'members.view', labelKey: 'perm.members.view' },
      { key: 'members.create', labelKey: 'perm.members.create' },
      { key: 'members.edit', labelKey: 'perm.members.edit' },
      { key: 'members.suspend', labelKey: 'perm.members.suspend' },
    ],
  },
  {
    key: 'savings',
    labelKey: 'perm.savings',
    permissions: [
      { key: 'savings.view', labelKey: 'perm.savings.view' },
      { key: 'savings.configure', labelKey: 'perm.savings.configure' },
      { key: 'savings.trigger_dues', labelKey: 'perm.savings.trigger_dues' },
    ],
  },
  {
    key: 'payments',
    labelKey: 'perm.payments',
    permissions: [
      { key: 'payments.view', labelKey: 'perm.payments.view' },
      { key: 'payments.online_logs', labelKey: 'perm.payments.online_logs' },
      { key: 'payments.verify_slips', labelKey: 'perm.payments.verify_slips' },
      { key: 'payments.reject_slips', labelKey: 'perm.payments.reject_slips' },
    ],
  },
  {
    key: 'expenses',
    labelKey: 'perm.expenses',
    permissions: [
      { key: 'expenses.create', labelKey: 'perm.expenses.create' },
      { key: 'expenses.approve_tier1', labelKey: 'perm.expenses.approve_tier1' },
      { key: 'expenses.approve_tier2', labelKey: 'perm.expenses.approve_tier2' },
      { key: 'expenses.approve_tier3', labelKey: 'perm.expenses.approve_tier3' },
    ],
  },
  {
    key: 'ledger',
    labelKey: 'perm.ledger',
    permissions: [
      { key: 'ledger.view', labelKey: 'perm.ledger.view' },
      { key: 'ledger.adjust', labelKey: 'perm.ledger.adjust' },
    ],
  },
  {
    key: 'meetings',
    labelKey: 'perm.meetings',
    permissions: [
      { key: 'meetings.create', labelKey: 'perm.meetings.create' },
      { key: 'meetings.upload_resolution', labelKey: 'perm.meetings.upload_resolution' },
      { key: 'meetings.publish_notice', labelKey: 'perm.meetings.publish_notice' },
    ],
  },
  {
    key: 'documents',
    labelKey: 'perm.documents',
    permissions: [
      { key: 'documents.upload', labelKey: 'perm.documents.upload' },
      { key: 'documents.delete', labelKey: 'perm.documents.delete' },
      { key: 'documents.certificates', labelKey: 'perm.documents.certificates' },
    ],
  },
  {
    key: 'reports',
    labelKey: 'perm.reports',
    permissions: [
      { key: 'reports.view_financial', labelKey: 'perm.reports.view_financial' },
      { key: 'reports.export', labelKey: 'perm.reports.export' },
      { key: 'reports.audit_logs', labelKey: 'perm.reports.audit_logs' },
    ],
  },
  {
    key: 'roles',
    labelKey: 'perm.roles',
    permissions: [
      { key: 'roles.view', labelKey: 'perm.roles.view' },
      { key: 'roles.create', labelKey: 'perm.roles.create' },
      { key: 'roles.update', labelKey: 'perm.roles.update' },
      { key: 'roles.delete', labelKey: 'perm.roles.delete' },
      { key: 'roles.assign', labelKey: 'perm.roles.assign' },
    ],
  },
];

export default function RolesPage() {
  const router = useRouter();
  const { tr } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isSuperAdmin = hasRole('super_admin');

  const [rolePage, setRolePage] = useState(1);
  const [roleSearch, setRoleSearch] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', permissions: [] });
  const [roleErrors, setRoleErrors] = useState({});
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(PERMISSION_CATEGORIES.map((c) => c.key));

  const roleQueryParams = useMemo(() => {
    const q = { page: rolePage, limit: 20 };
    if (roleSearch) q.search = roleSearch;
    return q;
  }, [rolePage, roleSearch]);

  const { data: roleData, loading: roleLoading, error: roleError, reload: reloadRoles } = useApi(
    '/roles',
    roleQueryParams,
    { enabled: isAuthenticated && isSuperAdmin }
  );

  if (!isAuthenticated) return null;

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader title={tr('roles.title')} subtitle={tr('error.forbidden')} />
          <div className="card card-pad text-center py-12">
            <Icon name="alert" className="mx-auto h-12 w-12 text-amber-500" />
            <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('error.forbidden')}</h3>
            <p className="mt-2 text-brand-500">Only Super Admins can configure roles and privileges.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const roles = roleData?.items || [];
  const roleMeta = roleData?.meta || { total: 0, pages: 1 };
  const totalPermissions = PERMISSION_CATEGORIES.flatMap((c) => c.permissions).length;

  const openAddRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    setRoleErrors({});
    setShowRoleModal(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name || '',
      description: role.description || '',
      permissions: [...(role.permissions || [])],
    });
    setRoleErrors({});
    setShowRoleModal(true);
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setRoleErrors({});

    if (!roleForm.name.trim()) {
      setRoleErrors({ name: tr('roles.nameRequired') });
      return;
    }

    setRoleSubmitting(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        permissions: roleForm.permissions,
      };

      if (editingRole) {
        await apiPatch(`/roles/${editingRole._id}`, payload);
        toast.success(tr('roles.updated'));
      } else {
        await apiPost('/roles', payload);
        toast.success(tr('roles.created'));
      }
      setShowRoleModal(false);
      reloadRoles();
    } catch (err) {
      setRoleErrors({ submit: err?.message || tr('error.generic') });
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (role.userCount > 0) {
      toast.error(tr('roles.cannotDeleteInUse', { count: role.userCount }));
      return;
    }
    if (!window.confirm(tr('roles.confirmDelete'))) return;
    try {
      await apiDelete(`/roles/${role._id}`);
      toast.success(tr('roles.deleted'));
      reloadRoles();
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    }
  };

  const togglePermission = (permKey) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter((p) => p !== permKey)
        : [...prev.permissions, permKey],
    }));
  };

  const toggleCategory = (catKey) => {
    setExpandedCategories((prev) =>
      prev.includes(catKey) ? prev.filter((c) => c !== catKey) : [...prev, catKey]
    );
  };

  const toggleAllInCategory = (category, checked) => {
    const allPerms = category.permissions.map((p) => p.key);
    setRoleForm((prev) => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...allPerms])]
        : prev.permissions.filter((p) => !allPerms.includes(p)),
    }));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Icon name="shield" className="h-6 w-6 text-brand-700" />
              <span>{tr('roles.title')}</span>
            </div>
          }
          subtitle={tr('roles.subtitle')}
          actions={
            <div className="flex items-center gap-3">
              <div className="flex bg-brand-100 rounded-xl p-1" role="tablist">
                <button
                  type="button"
                  onClick={() => router.push('/users')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-brand-600 hover:text-brand-900 transition-all"
                >
                  <Icon name="users" className="h-4 w-4" />
                  <span>{tr('users.title')}</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-brand-900 shadow-sm"
                >
                  <Icon name="shield" className="h-4 w-4" />
                  <span>{tr('roles.title')}</span>
                </button>
              </div>
              <Button variant="primary" onClick={openAddRole}>
                <Icon name="plus" className="h-4 w-4" />
                {tr('roles.create')}
              </Button>
            </div>
          }
        />

        <div className="card">
          <div className="border-b border-brand-200 p-4">
            <SearchInput
              value={roleSearch}
              onChange={setRoleSearch}
              placeholder={tr('roles.searchPlaceholder')}
              className="max-w-xs"
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="w-48">{tr('roles.name')}</TableCell>
                  <TableCell>{tr('roles.description')}</TableCell>
                  <TableCell className="w-36 text-center">{tr('roles.type')}</TableCell>
                  <TableCell className="w-28 text-center">{tr('roles.users')}</TableCell>
                  <TableCell className="w-64">{tr('roles.privileges')}</TableCell>
                  <TableCell className="w-40 text-right">{tr('roles.actions')}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8"><LoadingSpinner size="md" /></TableCell>
                  </TableRow>
                ) : roleError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <EmptyState icon="alert" title={tr('common.error')} description={tr('roles.error.loadFailed')} />
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <EmptyState icon="shield" title={tr('roles.noRoles')} description={tr('common.noData')} />
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((r) => (
                    <TableRow key={r._id} className="tr-hover">
                      <TableCell className="font-semibold text-brand-900">
                        {r.name === 'super_admin' ? 'Super Admin' : r.name.replace(/_/g, ' ').toUpperCase()}
                      </TableCell>
                      <TableCell className="text-brand-700 max-w-xs truncate">{r.description}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.isSystemLocked ? 'danger' : 'info'}>
                          {r.isSystemLocked ? tr('roles.systemLocked') : tr('roles.customRole')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={r.userCount ? 'info' : 'default'}>{r.userCount || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Progress
                          value={r.permissionCount || r.permissions?.length || 0}
                          max={totalPermissions}
                          showLabel
                          label={`${r.permissionCount || r.permissions?.length || 0} / ${totalPermissions}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditRole(r)}>
                            <Icon name="edit" className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteRole(r)}>
                            <Icon name="trash" className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={roleMeta} onPage={setRolePage} />

          {/* Reusable Role Modal from components/ui */}
          <RoleModal
            open={showRoleModal}
            onClose={() => setShowRoleModal(false)}
            title={editingRole ? tr('roles.edit') : tr('roles.create')}
            form={roleForm}
            errors={roleErrors}
            onChange={setRoleForm}
            submitting={roleSubmitting}
            onSubmit={handleRoleSubmit}
            isEdit={!!editingRole}
            isSystemRole={editingRole?.isSystemLocked}
            categories={PERMISSION_CATEGORIES}
            expandedCategories={expandedCategories}
            onToggleCategory={toggleCategory}
            onTogglePermission={togglePermission}
            toggleAllInCategory={toggleAllInCategory}
            tr={tr}
          />
        </div>
      </div>
    </AppShell>
  );
}