'use client';

import React from 'react';
import { Icon, Button, Input, Select, Modal } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

export default function UserEditModal({
  open,
  onClose,
  user,
  form,
  errors,
  onChange,
  submitting,
  onSubmit,
  currentUserId,
  roleOptions,
  tr,
}) {
  if (!open) return null;
  const isCreating = !user;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isCreating ? tr('users.add') : tr('users.editUser')}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {errors?.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4" />
            {errors.submit}
          </div>
        )}

        <FormSection title={tr('settings.userDetails')}>
          {isCreating && (
            <div className="space-y-3">
              <Input
                label={tr('members.fullName')}
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                required
              />
              <Input
                label={tr('members.email')}
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
                type="email"
              />
              <Input
                label={tr('members.phone')}
                value={form.phone}
                onChange={(e) => onChange({ ...form, phone: e.target.value })}
                required
              />
              <Input
                label={tr('users.password')}
                value={form.password}
                onChange={(e) => onChange({ ...form, password: e.target.value })}
                type="password"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Select
              label={tr('users.role')}
              value={form.role}
              onChange={(e) => onChange({ ...form, role: e.target.value })}
              options={roleOptions}
            />
            <Select
              label={tr('users.status')}
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => onChange({ ...form, isActive: e.target.value === 'active' })}
              options={[
                { value: 'active', label: tr('users.statusActive') },
                { value: 'inactive', label: tr('users.statusInactive') },
              ]}
              disabled={user?._id === currentUserId}
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isCreating ? tr('users.add') : tr('common.save')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}