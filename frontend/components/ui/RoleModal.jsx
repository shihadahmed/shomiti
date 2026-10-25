'use client';

import React from 'react';
import { Icon, Button, Input, Modal, Textarea, Checkbox } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

export default function RoleModal({
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
  categories,
  expandedCategories,
  onToggleCategory,
  onTogglePermission,
  toggleAllInCategory,
  tr,
}) {
  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="xl">
      <form onSubmit={onSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto">
        {errors?.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 flex items-center gap-2">
            <Icon name="alert" className="h-4 w-4" />
            {errors.submit}
          </div>
        )}

        <FormSection title={tr('settings.userDetails')}>
          <div className="space-y-3">
            <Input
              label={tr('roles.name')}
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              error={errors?.name}
              required
            />
            <Textarea
              label={tr('roles.description')}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              error={errors?.description}
              rows={2}
            />
            {isEdit && isSystemRole && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 flex items-center gap-2">
                <Icon name="alert" className="h-4 w-4" />
                {tr('roles.systemRoleProtected')}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title={tr('roles.permissions')}>
          <div className="space-y-3">
            {categories.map((cat) => {
              const isExpanded = expandedCategories.includes(cat.key);
              const allChecked = cat.permissions.every((p) => form.permissions.includes(p.key));
              const someChecked = cat.permissions.some((p) => form.permissions.includes(p.key));

              return (
                <div key={cat.key} className="border border-brand-200 rounded-xl overflow-hidden">
                  <div className="w-full px-4 py-2.5 flex items-center justify-between bg-brand-50/50">
                    <button
                      type="button"
                      className="font-medium text-brand-900 flex items-center gap-2"
                      onClick={() => onToggleCategory(cat.key)}
                    >
                      <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} className="h-4 w-4" />
                      {tr(cat.labelKey)}
                    </button>
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={(e) => toggleAllInCategory(cat, e.target.checked)}
                    />
                  </div>

                  {isExpanded && (
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-brand-100 bg-white">
                      {cat.permissions.map((p) => (
                        <label key={p.key} className="flex items-center gap-2 text-sm text-brand-700 cursor-pointer">
                          <Checkbox
                            checked={form.permissions.includes(p.key)}
                            onChange={() => onTogglePermission(p.key)}
                          />
                          <span>{tr(p.labelKey)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isEdit ? tr('common.save') : tr('roles.create')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}