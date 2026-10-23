'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon, Button, Input, Textarea, PageHeader, EmptyState, LoadingSpinner,
  Badge, Modal, Table, TableHeader, TableBody, TableRow, TableCell,
  SearchInput, Pagination, Progress, Checkbox, Tooltip
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';
import toast from 'react-hot-toast';

const ROLE_ICONS = {
  super_admin: 'shield',
  president: 'award',
  general_secretary: 'users',
  treasurer: 'wallet',
  member: 'user',
};

const ROLE_ICON_COLORS = {
  super_admin: 'text-red-500 bg-red-50',
  president: 'text-purple-500 bg-purple-50',
  general_secretary: 'text-blue-500 bg-blue-50',
  treasurer: 'text-amber-500 bg-amber-50',
  member: 'text-green-500 bg-green-50',
  default: 'text-brand-500 bg-brand-50',
};

const SYSTEM_ROLE_NAMES = ['super_admin', 'president', 'general_secretary', 'treasurer', 'member'];

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
];

export default function RolesPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRole = useAuthStore((state) => state.hasRole);
  const logout = useAuthStore((state) => state.logout);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [rolePage, setRolePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissions: [],
  });
  const [roleErrors, setRoleErrors] = useState({});
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(
    PERMISSION_CATEGORIES.map(c => c.key)
  );

  const { data: roleData, loading: roleLoading, error: roleError, reload: reloadRoles } = useApi('/roles', {
    page: rolePage,
    limit: 20,
    search: searchQuery || undefined,
  }, { enabled: isAuthenticated });

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

  const isSuperAdmin = hasRole('super_admin');

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

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: [] });
    setRoleErrors({});
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    setRoleErrors({});

    if (!roleForm.name.trim()) {
      setRoleErrors({ name: tr('roles.nameRequired') });
      return;
    }
    if (!roleForm.description.trim()) {
      setRoleErrors({ description: tr('roles.descriptionRequired') });
      return;
    }
    if (editingRole && SYSTEM_ROLE_NAMES.includes(editingRole.name) && roleForm.name !== editingRole.name) {
      setRoleErrors({ name: tr('roles.reservedName') });
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
        await useApi().then(({ apiPut }) => apiPut(`/roles/${editingRole._id}`, payload));
        toast.success(tr('roles.updated'));
      } else {
        await useApi().then(({ apiPost }) => apiPost('/roles', payload));
        toast.success(tr('roles.created'));
      }
      closeRoleModal();
      reloadRoles();
    } catch (requestError) {
      const msg = requestError?.message || tr('error.generic');
      if (msg.includes('ROLE_EXISTS') || msg.includes('already exists')) {
        setRoleErrors({ name: tr('roles.nameExists') });
      } else if (msg.includes('RESERVED_NAME') || msg.includes('reserved')) {
        setRoleErrors({ name: tr('roles.reservedName') });
      } else if (msg.includes('SYSTEM_ROLE_PROTECTED') || msg.includes('system-locked')) {
        setRoleErrors({ submit: tr('roles.systemRoleProtected') });
      } else {
        setRoleErrors({ submit: msg });
      }
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (role.isSystemLocked) {
      toast.error(tr('roles.cannotDeleteSystem'));
      return;
    }
    if (role.userCount > 0) {
      toast.error(tr('roles.cannotDeleteInUse', { count: role.userCount }));
      return;
    }
    if (!window.confirm(tr('roles.confirmDelete'))) return;

    try {
      await useApi().then(({ apiDelete }) => apiDelete(`/roles/${role._id}`));
      toast.success(tr('roles.deleted'));
      reloadRoles();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const togglePermission = (permissionKey) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter(p => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  };

  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev =>
      prev.includes(categoryKey)
        ? prev.filter(c => c !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  const toggleAllInCategory = (category, checked) => {
    const allPerms = category.permissions.map(p => p.key);
    setRoleForm(prev => ({
      ...prev,
      permissions: checked
        ? [...new Set([...prev.permissions, ...allPerms])]
        : prev.permissions.filter(p => !allPerms.includes(p)),
    }));
  };

  const isCategoryAllChecked = (category) => {
    return category.permissions.every(p => roleForm.permissions.includes(p.key));
  };

  const isCategorySomeChecked = (category) => {
    return category.permissions.some(p => roleForm.permissions.includes(p.key));
  };

  const getRoleIcon = (roleName) => ROLE_ICONS[roleName] || 'shield';
  const getRoleIconColor = (roleName) => ROLE_ICON_COLORS[roleName] || ROLE_ICON_COLORS.default;

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

  if (!isSuperAdmin) {
    return (
      <AppShell>
        <PageHeader
          title={tr('roles.title')}
          subtitle={tr('error.forbidden')}
        />
        <div className="card card-pad text-center py-12">
          <Icon name="alert" className="mx-auto h-12 w-12 text-amber-500" />
          <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('error.forbidden')}</h3>
          <p className="mt-2 text-brand-500">Only Super Admin can access Roles & Permissions management.</p>
        </div>
      </AppShell>
    );
  }

  const roles = roleData?.items || [];
  const roleMeta = roleData?.meta || { total: 0, pages: 1 };
  const totalPermissions = roleData?.items?.[0]?.totalPermissions || PERMISSION_CATEGORIES.flatMap(c => c.permissions).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <Icon name="shield" className="h-6 w-6 text-brand-700" />
              <span>{tr('roles.title')}</span>
            </div>
          }
          subtitle={tr('roles.subtitle')}
          actions={
            <Button variant="primary" onClick={openAddRole}>
              <Icon name="plus" className="h-4 w-4" />
              {tr('roles.create')}
            </Button>
          }
        />

        <div className="card">
          <div className="border-b border-brand-200 p-4">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
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
                  <TableCell className="w-64">{tr('roles.privileges')}</TableCell>
                  <TableCell className="w-40 text-right">{tr('roles.actions')}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <EmptyState icon="shield" title={tr('roles.noRoles')} description={tr('common.noData')} />
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role._id} className="tr-hover">
                      <TableCell className="font-medium text-brand-900 flex items-center gap-2">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${getRoleIconColor(role.name)}`}>
                          <Icon name={getRoleIcon(role.name)} className="h-4 w-4" />
                        </span>
                        <span>{role.name === 'super_admin' ? 'Super Admin' : role.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                      </TableCell>
                      <TableCell className="text-brand-700 max-w-xs truncate" title={role.description}>
                        {role.description}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={role.isSystemLocked ? 'danger' : 'info'}
                          className={role.isSystemLocked ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}
                        >
                          {role.isSystemLocked ? tr('roles.systemLocked') : tr('roles.customRole')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={role.permissionCount || 0}
                            max={totalPermissions}
                            showLabel
                            className="flex-1"
                            label={`${role.permissionCount || 0} / ${totalPermissions}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditRole(role)}
                            aria-label={tr('common.edit')}
                          >
                            <Icon name="edit" className="h-4 w-4" />
                          </Button>
                          {!role.isSystemLocked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteRole(role)}
                              aria-label={tr('common.delete')}
                            >
                              <Icon name="trash" className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination meta={roleMeta} onPage={setRolePage} />
        </div>

        <RoleModal
          open={showRoleModal}
          onClose={closeRoleModal}
          title={editingRole ? tr('roles.edit') : tr('roles.create')}
          form={roleForm}
          errors={roleErrors}
          onChange={setRoleForm}
          submitting={roleSubmitting}
          onSubmit={handleRoleSubmit}
          isEdit={!!editingRole}
          isSystemRole={editingRole?.isSystemLocked || false}
          originalRoleName={editingRole?.name}
          categories={PERMISSION_CATEGORIES}
          expandedCategories={expandedCategories}
          onToggleCategory={toggleCategory}
          onTogglePermission={togglePermission}
          isCategoryAllChecked={isCategoryAllChecked}
          isCategorySomeChecked={isCategorySomeChecked}
          toggleAllInCategory={toggleAllInCategory}
          tr={tr}
        />
      </div>
    </AppShell>
  );
}

function RoleModal({
  open,
  onClose,
  title,
  form,
  errors,
  onChange,
  submitting,
  onSubmit,
  isEdit,
  isSystemRole,
  originalRoleName,
  categories,
  expandedCategories,
  onToggleCategory,
  onTogglePermission,
  isCategoryAllChecked,
  isCategorySomeChecked,
  toggleAllInCategory,
  tr,
}) {
  if (!open) return null;

  const allPermissions = categories.flatMap(c => c.permissions);

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="xl">
      <form onSubmit={onSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('settings.userDetails')}>
          <div className="space-y-4">
            <Input
              label={tr('roles.name')}
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              error={errors.name}
              required
              disabled={isEdit && isSystemRole}
            />
            <Textarea
              label={tr('roles.description')}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              error={errors.description}
              required
              rows={3}
              disabled={isEdit && isSystemRole}
            />
            {isEdit && isSystemRole && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <Icon name="alert" className="inline h-3 w-3 mr-1" />
                {tr('roles.systemRoleProtected')}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title={tr('roles.permissions')}>
          <div className="space-y-3">
            {categories.map((category) => {
              const isExpanded = expandedCategories.includes(category.key);
              const allChecked = isCategoryAllChecked(category);
              const someChecked = isCategorySomeChecked(category);

              return (
                <div key={category.key} className="border border-brand-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between bg-brand-50/50 hover:bg-brand-50 transition"
                    onClick={() => onToggleCategory(category.key)}
                  >
                    <span className="font-medium text-brand-900 flex items-center gap-2">
                      <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} className="h-4 w-4 text-brand-500" />
                      {tr(category.labelKey)}
                    </span>
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={(e) => toggleAllInCategory(category, e.target.checked)}
                      disabled={isEdit && isSystemRole}
                      aria-label={tr(category.labelKey)}
                    />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-brand-200 bg-white animate-slide-down">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        {category.permissions.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 cursor-pointer group"
                          >
                            <Checkbox
                              checked={form.permissions.includes(perm.key)}
                              onChange={(e) => onTogglePermission(perm.key)}
                              disabled={isEdit && isSystemRole}
                            />
                            <span className="text-sm text-brand-700 group-hover:text-brand-900">
                              {tr(perm.labelKey)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {isEdit ? tr('common.save') : tr('roles.create')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}