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
  roleOptions = [],
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
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                required
              />
              <Input
                label={tr('members.email')}
                placeholder="user@example.com (Password setup link will be sent here)"
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
                type="email"
                required
              />
              <Input
                label={tr('members.phone')}
                placeholder="017xxxxxxxx"
                value={form.phone}
                onChange={(e) => onChange({ ...form, phone: e.target.value })}
                required
              />
              <Input
                label={tr('users.nid')}
                placeholder="Enter NID number"
                value={form.nid}
                onChange={(e) => onChange({ ...form, nid: e.target.value })}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Select
              label={tr('users.role')}
              value={form.role}
              onChange={(e) => onChange({ ...form, role: e.target.value })}
              options={
                roleOptions.length > 0
                  ? roleOptions
                  : [{ value: '', label: 'Loading roles...' }]
              }
              required
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

        {isCreating && (
          <p className="text-xs text-brand-600 bg-brand-50 p-2.5 rounded-lg flex items-center gap-2">
            <Icon name="globe" className="h-4 w-4 text-brand-500 shrink-0" />
            An automatic email with a password setup link will be sent to the user upon creation.
          </p>
        )}

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