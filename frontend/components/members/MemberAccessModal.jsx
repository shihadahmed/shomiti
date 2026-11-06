'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useLang } from '@/lib/useLang';
import { useApi, apiPatch, apiPost } from '@/lib/useApi';
import { Icon, Badge, Button, Input, Modal, Select } from '@/components/ui/common';

/** Built-in roles that can always be assigned from the Members module. */
const FALLBACK_ROLES = ['member', 'treasurer', 'general_secretary', 'president'];

function roleLabel(role) {
  return role === 'super_admin'
    ? 'Super Admin'
    : String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Super Admin panel for the login account behind a member.
 *
 * A member always owns exactly one portal account, so this is the only place
 * where roles, portal access and credential recovery are managed. There is no
 * separate user-management screen.
 */
export default function MemberAccessModal({ isOpen, onClose, member, onUpdated }) {
  const { tr } = useLang();

  const linkedUser = member?.user || null;
  const [role, setRole] = useState('member');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const { data: rolesData } = useApi(
    '/roles',
    { limit: 100 },
    { enabled: Boolean(isOpen) },
  );

  useEffect(() => {
    if (!isOpen) return;
    setRole(linkedUser?.role || 'member');
    setIsActive(linkedUser?.isActive !== false);
    setTemporaryPassword('');
  }, [isOpen, linkedUser?.role, linkedUser?.isActive]);

  const roleOptions = useMemo(() => {
    const names = new Set(FALLBACK_ROLES);
    (rolesData?.items || []).forEach((item) => {
      if (item?.name && item.name !== 'super_admin') names.add(item.name);
    });

    const options = Array.from(names).map((name) => ({ value: name, label: roleLabel(name) }));

    // A Super Admin's own profile cannot be demoted through member management.
    if (linkedUser?.role === 'super_admin') {
      options.unshift({ value: 'super_admin', label: roleLabel('super_admin') });
    }

    return options;
  }, [rolesData, linkedUser?.role]);

  const roleLocked = linkedUser?.role === 'super_admin';
  const emailMissing = !member?.email;
  const busy = saving || Boolean(action);

  const handleSave = async () => {
    if (!member?._id) return;
    setSaving(true);
    try {
      const updates = {};

      if (!roleLocked && role !== (linkedUser?.role || 'member')) {
        const result = await apiPatch(`/members/${member._id}/role`, { role });
        updates.user = result?.user || updates.user;
        toast.success(tr('members.access.roleUpdated'));
      }

      if (isActive !== (linkedUser?.isActive !== false)) {
        const result = await apiPatch(`/members/${member._id}/account-status`, { isActive });
        updates.user = result?.user || updates.user;
        toast.success(tr('members.access.statusUpdated'));
      }

      if (Object.keys(updates).length === 0) {
        toast.info(tr('members.access.noChanges'));
        return;
      }

      onUpdated?.(updates);
      onClose?.();
    } catch (error) {
      toast.error(error?.message || tr('error.generic'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!member?._id) return;
    if (emailMissing) {
      toast.error(tr('members.access.noEmailForReset'));
      return;
    }
    if (!window.confirm(tr('members.access.confirmResetEmail'))) return;

    setAction('email');
    try {
      await apiPost(`/members/${member._id}/reset-password-email`, {});
      toast.success(tr('members.access.resetEmailSent'));
    } catch (error) {
      toast.error(error?.message || tr('error.generic'));
    } finally {
      setAction(null);
    }
  };

  const handleResetPassword = async () => {
    if (!member?._id) return;
    if (!window.confirm(tr('members.access.confirmTemporaryPassword'))) return;

    setAction('password');
    try {
      const result = await apiPost(`/members/${member._id}/reset-password`, {});
      setTemporaryPassword(result?.temporaryPassword || '');
      toast.success(tr('members.access.temporaryPasswordIssued'));
      onUpdated?.();
    } catch (error) {
      toast.error(error?.message || tr('error.generic'));
    } finally {
      setAction(null);
    }
  };

  const copyPassword = async () => {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast.success(tr('members.access.passwordCopied'));
    } catch {
      toast.info(temporaryPassword);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tr('members.access.title')}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {tr('common.cancel')}
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} loading={saving} disabled={busy}>
            {tr('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-brand-200/80 bg-brand-50/40 p-4">
          <p className="text-sm font-semibold text-brand-900">{member?.fullName || tr('common.na')}</p>
          <p className="mt-0.5 font-mono text-xs text-brand-600">
            {member?.code || '—'} · {member?.phone || tr('members.noPhone')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={linkedUser ? 'badge-green' : 'badge-amber'}>
              {linkedUser ? tr('members.access.accountLinked') : tr('members.access.accountMissing')}
            </Badge>
            {linkedUser?.mustChangePassword && (
              <Badge variant="warning">{tr('members.access.mustChangePassword')}</Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={tr('members.access.role')}
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={roleOptions}
            disabled={busy || roleLocked}
            hint={roleLocked ? tr('members.access.superAdminLocked') : undefined}
          />

          <div>
            <span className="label">{tr('members.access.portalAccess')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((previous) => !previous)}
              disabled={busy}
              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span>{isActive ? tr('members.access.enabled') : tr('members.access.disabled')}</span>
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  isActive ? 'bg-emerald-500' : 'bg-rose-400'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    isActive ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
            <p className="hint">{tr('members.access.portalAccessHint')}</p>
          </div>
        </div>

        <div className="rounded-xl border border-brand-200/80 p-4">
          <div className="flex items-center gap-2">
            <Icon name="lock" className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              {tr('members.access.credentials')}
            </h4>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSendResetEmail}
              loading={action === 'email'}
              disabled={busy || emailMissing}
              className="flex-1"
            >
              <Icon name="mail" className="h-4 w-4" />
              {tr('members.access.sendResetEmail')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleResetPassword}
              loading={action === 'password'}
              disabled={busy}
              className="flex-1"
            >
              <Icon name="key" className="h-4 w-4" />
              {tr('members.access.generatePassword')}
            </Button>
          </div>

          {emailMissing ? (
            <p className="mt-2 text-xs text-amber-700">
              {tr('members.access.noEmailForReset')}
            </p>
          ) : (
            <p className="mt-2 text-xs text-brand-500">{tr('members.access.resetEmailHint')}</p>
          )}

          {temporaryPassword && (
            <div className="mt-3 space-y-2">
              <Input
                label={tr('members.access.temporaryPassword')}
                value={temporaryPassword}
                readOnly
                className="font-mono"
                onFocus={(event) => event.target.select()}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-amber-700">{tr('members.access.temporaryPasswordHint')}</p>
                <Button type="button" variant="ghost" size="sm" onClick={copyPassword}>
                  <Icon name="copy" className="h-3.5 w-3.5" />
                  {tr('common.copy')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
