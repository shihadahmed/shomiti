'use client';

import React, { useState, useEffect } from 'react';
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
  memberOptions = [],
  tr,
}) {
  if (!open) return null;
  const isCreating = !user;
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    if (isCreating && memberOptions.length > 0 && !form.memberId) {
      // Don't auto-select, let user choose
    }
  }, [memberOptions, form.memberId, isCreating]);

  const handleMemberSelect = (memberId) => {
    const member = memberOptions.find(m => m._id === memberId);
    if (member) {
      setSelectedMember(member);
      onChange({ ...form, memberId: member._id });
    }
  };

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
          {isCreating ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-brand-800 mb-1.5">
                  {tr('users.selectMember')}
                </label>
                <Select
                  value={form.memberId || ''}
                  onChange={(e) => handleMemberSelect(e.target.value)}
                  options={memberOptions.map(m => ({
                    value: m._id,
                    label: `${m.code} - ${m.fullName}`,
                  }))}
                  placeholder={tr('users.selectMemberPlaceholder')}
                  required
                  error={errors.memberId}
                />
              </div>
              {selectedMember && (
                <div className="bg-brand-50 rounded-lg p-3 border border-brand-200 space-y-1">
                  <p className="text-xs font-medium text-brand-900">{tr('users.memberDetails')}</p>
                  <p className="text-xs text-brand-700">{tr('users.memberCode')}: <span className="font-mono">{selectedMember.code}</span></p>
                  <p className="text-xs text-brand-700">{tr('users.memberName')}: {selectedMember.fullName}</p>
                  <p className="text-xs text-brand-700">{tr('users.memberPhone')}: {selectedMember.phone}</p>
                  {selectedMember.email && (
                    <p className="text-xs text-brand-700">{tr('users.memberEmail')}: {selectedMember.email}</p>
                  )}
                </div>
              )}
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
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
          )}
        </FormSection>

        {isCreating && (
          <p className="text-xs text-brand-600 bg-brand-50 p-2.5 rounded-lg flex items-center gap-2">
            <Icon name="globe" className="h-4 w-4 text-brand-500 shrink-0" />
            {tr('users.inviteSentInfo')}
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