'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { toast } from 'react-toastify';
import {
  Icon,
  Button,
  Input,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  formatDate,
  Badge,
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const KYC_STATUS = {
  pending_kyc: { en: 'KYC Pending', bn: 'KYC অপেক্ষমাণ' },
  under_review: { en: 'Under Review', bn: 'নির্বাচনাধীন' },
  active: { en: 'Active', bn: 'সক্রিয়' },
  inactive: { en: 'Inactive', bn: 'নিষ্ক্রিয়' },
};

export default function ProfilePage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const { data: memberData, loading, error, reload } = useApi('/auth/users/me/kyc', undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) router.replace('/login');
  }, [mounted, checking, isAuthenticated, router]);

  const member = memberData?.member;
  const kycStatus = memberData?.user?.status || 'pending_kyc';
  const statusLabel = KYC_STATUS[kycStatus]?.[lang] || KYC_STATUS[kycStatus]?.en || kycStatus;

  const handleEdit = () => {
    if (member) {
      setForm({
        fullName: member.fullName || '',
        fullNameBn: member.fullNameBn || '',
        phone: member.phone || '',
        email: member.email || '',
        presentAddress: member.presentAddress || '',
        permanentAddress: member.permanentAddress || '',
        nidNumber: member.nidNumber || '',
        dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
        occupation: member.occupation || '',
      });
      setEditing(true);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setForm({});
    setFormErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!form.fullName?.trim()) {
      setFormErrors({ fullName: tr('profile.nameRequired') });
      return;
    }
    if (!form.phone?.trim()) {
      setFormErrors({ phone: tr('profile.phoneRequired') });
      return;
    }

    setSubmitting(true);
    try {
      await apiPatch('/auth/users/me/kyc', form);
      toast.success(tr('profile.updated'));
      setEditing(false);
      setForm({});
      reload();
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      setFormErrors({ submit: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || checking) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }
  if (!isAuthenticated) return null;

  if (loading) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }

  if (error) {
    return <AppShell><EmptyState icon="alert" title={tr('common.error')} description={error} className="p-12" /></AppShell>;
  }

  if (!member) {
    return <AppShell><EmptyState icon="user" title={tr('profile.noMember')} description={tr('profile.noMemberDesc')} className="p-12" /></AppShell>;
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('profile.title')}
          subtitle={tr('profile.subtitle')}
        />
        {!editing && (
          <Button variant="secondary" onClick={handleEdit} className="shadow-sm">
            <Icon name="pencilLine" className="h-4 w-4 mr-1.5" />
            {tr('common.edit')}
          </Button>
        )}
      </div>

      {/* KYC Status Card */}
      <div className="mb-6 rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-500">{tr('profile.kycStatus')}</p>
            <Badge status={kycStatus} customLabels={KYC_STATUS} size="lg" />
          </div>
          {kycStatus === 'under_review' && memberData?.requestedChanges && (
            <div className="text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              {tr('profile.changesPendingReview')}
            </div>
          )}
        </div>
      </div>

      {/* Profile Information */}
      <div className="rounded-2xl border border-brand-200/80 bg-white shadow-xs overflow-hidden">
        {editing ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {formErrors.submit && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {formErrors.submit}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="w-full">
                <label className="label">{tr('profile.fullName')}</label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Full Name"
                  error={formErrors.fullName}
                  required
                />
                {formErrors.fullName && <p className="field-error" role="alert">{formErrors.fullName}</p>}
              </div>

              <div className="w-full">
                <label className="label">{tr('profile.fullNameBn')}</label>
                <Input
                  value={form.fullNameBn}
                  onChange={(e) => setForm({ ...form, fullNameBn: e.target.value })}
                  placeholder="বাংলায় নাম"
                  error={formErrors.fullNameBn}
                />
                {formErrors.fullNameBn && <p className="field-error" role="alert">{formErrors.fullNameBn}</p>}
              </div>

              <div className="w-full">
                <label className="label">{tr('profile.phone')}</label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="017XXXXXXXX"
                  error={formErrors.phone}
                  required
                />
                {formErrors.phone && <p className="field-error" role="alert">{formErrors.phone}</p>}
              </div>

              <div className="w-full">
                <label className="label">{tr('profile.email')}</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  error={formErrors.email}
                />
                {formErrors.email && <p className="field-error" role="alert">{formErrors.email}</p>}
              </div>

              <div className="sm:col-span-2 w-full">
                <label className="label">{tr('profile.dateOfBirth')}</label>
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  error={formErrors.dateOfBirth}
                />
                {formErrors.dateOfBirth && <p className="field-error" role="alert">{formErrors.dateOfBirth}</p>}
              </div>

              <div className="sm:col-span-2 w-full">
                <label className="label">{tr('profile.occupation')}</label>
                <Input
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  placeholder="Occupation"
                  error={formErrors.occupation}
                />
                {formErrors.occupation && <p className="field-error" role="alert">{formErrors.occupation}</p>}
              </div>

              <div className="sm:col-span-2 w-full">
                <label className="label">{tr('profile.nidNumber')}</label>
                <Input
                  value={form.nidNumber}
                  onChange={(e) => setForm({ ...form, nidNumber: e.target.value })}
                  placeholder="NID Number"
                  error={formErrors.nidNumber}
                />
                {formErrors.nidNumber && <p className="field-error" role="alert">{formErrors.nidNumber}</p>}
              </div>

              <div className="sm:col-span-2 w-full">
                <label className="label">{tr('profile.presentAddress')}</label>
                <Input
                  value={form.presentAddress}
                  onChange={(e) => setForm({ ...form, presentAddress: e.target.value })}
                  placeholder="Present Address"
                  as="textarea"
                  rows={3}
                  error={formErrors.presentAddress}
                />
                {formErrors.presentAddress && <p className="field-error" role="alert">{formErrors.presentAddress}</p>}
              </div>

              <div className="sm:col-span-2 w-full">
                <label className="label">{tr('profile.permanentAddress')}</label>
                <Input
                  value={form.permanentAddress}
                  onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })}
                  placeholder="Permanent Address"
                  as="textarea"
                  rows={3}
                  error={formErrors.permanentAddress}
                />
                {formErrors.permanentAddress && <p className="field-error" role="alert">{formErrors.permanentAddress}</p>}
              </div>
            </div>

            <FormActions>
              <Button type="button" variant="secondary" onClick={handleCancel}>
                {tr('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
                {tr('common.save')}
              </Button>
            </FormActions>
          </form>
        ) : (
          <div className="p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-brand-500">{tr('profile.fullName')}</dt>
                <dd className="mt-1 text-lg font-semibold text-brand-900">{member.fullName}</dd>
              </div>
              {member.fullNameBn && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.fullNameBn')}</dt>
                  <dd className="mt-1 text-lg font-semibold text-brand-900">{member.fullNameBn}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-brand-500">{tr('profile.phone')}</dt>
                <dd className="mt-1 font-mono text-brand-900">{member.phone}</dd>
              </div>
              {member.email && (
                <div>
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.email')}</dt>
                  <dd className="mt-1 text-brand-900">{member.email}</dd>
                </div>
              )}
              {member.dateOfBirth && (
                <div>
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.dateOfBirth')}</dt>
                  <dd className="mt-1 text-brand-900">{formatDate(member.dateOfBirth)}</dd>
                </div>
              )}
              {member.occupation && (
                <div>
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.occupation')}</dt>
                  <dd className="mt-1 text-brand-900">{member.occupation}</dd>
                </div>
              )}
              {member.nidNumber && (
                <div>
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.nidNumber')}</dt>
                  <dd className="mt-1 font-mono text-brand-900">{member.nidNumber}</dd>
                </div>
              )}
              {member.presentAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.presentAddress')}</dt>
                  <dd className="mt-1 text-brand-700 whitespace-pre-wrap">{member.presentAddress}</dd>
                </div>
              )}
              {member.permanentAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-brand-500">{tr('profile.permanentAddress')}</dt>
                  <dd className="mt-1 text-brand-700 whitespace-pre-wrap">{member.permanentAddress}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-brand-500">{tr('profile.memberCode')}</dt>
                <dd className="mt-1 font-mono text-brand-900">{member.code}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-brand-500">{tr('profile.joinedDate')}</dt>
                <dd className="mt-1 text-brand-900">{formatDate(member.createdAt)}</dd>
              </div>
            </dl>

            {member.nominees && member.nominees.length > 0 && (
              <div className="mt-6 pt-6 border-t border-brand-200">
                <h3 className="text-lg font-semibold text-brand-900 mb-4">{tr('profile.nominees')}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                    <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                      <tr>
                        <th scope="col" className="px-5 py-3">{tr('profile.nomineeName')}</th>
                        <th scope="col" className="px-4 py-3">{tr('profile.relationship')}</th>
                        <th scope="col" className="px-4 py-3">{tr('profile.share')}</th>
                        <th scope="col" className="px-4 py-3">{tr('profile.nomineeNid')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100/80 bg-white">
                      {member.nominees.map((nominee, idx) => (
                        <tr key={idx} className="transition-colors hover:bg-brand-50/40">
                          <td className="px-5 py-3 font-medium text-brand-900">{nominee.name}</td>
                          <td className="px-4 py-3 text-brand-700">{nominee.relationship}</td>
                          <td className="px-4 py-3 text-brand-700">{nominee.share}%</td>
                          <td className="px-4 py-3 text-brand-700 font-mono">{nominee.nid || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}