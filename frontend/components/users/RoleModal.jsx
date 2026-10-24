"use client";

import React from "react";
import {
  Modal,
  Input,
  Textarea,
  Checkbox,
  FormSection,
  FormActions,
  Button,
  Progress,
  Icon,
  FormSection,
} from "@/components/ui/common";

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

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="xl">
      <form
        onSubmit={onSubmit}
        className="space-y-4 max-h-[80vh] overflow-y-auto"
      >
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {errors.submit}
          </div>
        )}

        <FormSection title={tr("settings.userDetails")}>
          <div className="space-y-4">
            <Input
              label={tr("roles.name")}
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              error={errors.name}
              required
              disabled={isEdit && isSystemRole}
            />
            <Textarea
              label={tr("roles.description")}
              value={form.description}
              onChange={(e) =>
                onChange({ ...form, description: e.target.value })
              }
              error={errors.description}
              required
              rows={3}
              disabled={isEdit && isSystemRole}
            />
            {isEdit && isSystemRole && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <Icon name="alert" className="inline h-3 w-3 mr-1" />
                {tr("roles.systemRoleProtected")}
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title={tr("roles.permissions")}>
          <div className="space-y-3">
            {categories.map((category) => {
              const isExpanded = expandedCategories.includes(category.key);
              const allChecked = isCategoryAllChecked(category);
              const someChecked = isCategorySomeChecked(category);

              return (
                <div
                  key={category.key}
                  className="border border-brand-200 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between bg-brand-50/50 hover:bg-brand-50 transition"
                    onClick={() => onToggleCategory(category.key)}
                  >
                    <span className="font-medium text-brand-900 flex items-center gap-2">
                      <Icon
                        name={isExpanded ? "chevronDown" : "chevronRight"}
                        className="h-4 w-4 text-brand-500"
                      />
                      {tr(category.labelKey)}
                    </span>
                    <Checkbox
                      checked={allChecked}
                      indeterminate={someChecked && !allChecked}
                      onChange={(e) =>
                        toggleAllInCategory(category, e.target.checked)
                      }
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
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            loadingLabel={tr("common.saving")}
          >
            {isEdit ? tr("common.save") : tr("roles.create")}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
