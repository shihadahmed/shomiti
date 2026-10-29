'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon,
  Button,
  Input,
  Textarea,
  Select,
  PageHeader,
  Badge,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';
import toast from 'react-hot-toast';

const KYC_BLOCKED_STATUSES = ['pending_kyc', 'under_review', 'rejected'];

const STATUS_LABELS = {
  invited: 'status.invited',
  pending_kyc: 'status.pending_kyc',
  under_review: 'status.under_review',
  active: 'status.active',
  rejected: 'status.rejected',
};

const STATUS_VARIANT = {
  invited: 'badge-slate',
  pending_kyc: 'badge-amber',
  under_review: 'badge-amber',
  active: 'badge-green',
  rejected: 'badge-red',
};

const INITIAL_FORM = {
  fullName: '',
  fatherName: '',
  motherName: '',
  spouseName: '',
  nid: '',
  dateOfBirth: '',
  occupation: '',
  email: '',
  phone: '',
  village: '',
  postOffice: '',
  upazila: '',
  district: '',
  nomineeName: '',
  nomineeRelation: '',
  nomineePhone: '',
  shareCount: '',
  notes: '',
};

export default function CompleteProfilePage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const { data: profileData, loading: profileLoading, error: profileError, reload: reloadProfile } = useApi(
    '/auth/users/me/kyc',
    undefined,
    { enabled: isAuthenticated },
  );

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

  useEffect(() => {
    if (!profileLoading && profileData) {
      const profile = profileData.profile || profileData;
      setStatus(profile.status || null);
      setRejectionReason(profile.rejectionReason || null);
      if (profile.profileData) {
        setForm((prev) => ({ ...prev, ...profile.profileData }));
      }
    }
  }, [profileLoading, profileData]);

  const STATUS = status;

  const isBlocked = KYC_BLOCKED_STATUSES.includes(STATUS);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const res = await apiPost('/auth/users/me/kyc', form);
      toast.success(res?.message || tr('kyc.submittedSuccess'));
      setStatus('under_review');
      setRejectionReason(null);
      await reloadProfile();
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      if (requestError?.details) {
        const fieldErrors = {};
        for (const detail of requestError.details) {
          fieldErrors[detail.field] = detail.message;
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ submit: message });
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = () => {
    if (!STATUS) return null;
    return (
      <Badge variant={STATUS_VARIANT[STATUS] || 'badge-slate'} className="mb-3">
        {tr(STATUS_LABELS[STATUS] || STATUS)}
      </Badge>
    );
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

  if (!isAuthenticated || !user) return null;

  if (isBlocked && STATUS === 'under_review') {
    return (
      <AppShell>
        <PageHeader title={tr('kyc.completeProfile')} subtitle={tr('kyc.profileSubtitle')} />
        <div className="card card-pad text-center py-16">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-xl mx-auto mb-4">
            <Icon name="clock" className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-brand-900">{tr('kyc.underReviewTitle')}</h3>
          <p className="mt-3 text-brand-500 max-w-sm mx-auto">
            {tr('kyc.underReviewBody')}
          </p>
          <p className="mt-3 text-sm text-brand-400">
            {tr('kyc.underReviewNote', { name: user.name })}
          </p>
        </div>
      </AppShell>
    );
  }

  const formDisabled = STATUS === 'under_review';

  return (
    <AppShell>
      <PageHeader title={tr('kyc.completeProfile')} subtitle={tr('kyc.profileSubtitle')} />
      <div className="max-w-3xl">
        {isBlocked && STATUS === 'rejected' && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">{tr('kyc.rejectedTitle')}</p>
                {rejectionReason && (
                  <p className="mt-1 text-sm text-red-700">
                    <span className="font-medium">{tr('kyc.rejectionReasonLabel')} </span>
                    {rejectionReason}
                  </p>
                )}
                <p className="mt-2 text-sm text-red-600">
                  {tr('kyc.rejectedBody')}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {statusBadge()}

          <FormSection title={tr('kyc.sectionPersonal')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={tr('kyc.fullName')}
                value={form.fullName}
                onChange={updateField('fullName')}
                error={errors.fullName}
                disabled={formDisabled}
                required={!formDisabled}
                icon={<Icon name="user" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.nid')}
                value={form.nid}
                onChange={updateField('nid')}
                error={errors.nid}
                disabled={formDisabled}
                icon={<Icon name="id" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.fatherName')}
                value={form.fatherName}
                onChange={updateField('fatherName')}
                error={errors.fatherName}
                disabled={formDisabled}
                icon={<Icon name="user" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.motherName')}
                value={form.motherName}
                onChange={updateField('motherName')}
                error={errors.motherName}
                disabled={formDisabled}
                icon={<Icon name="user" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.spouseName')}
                value={form.spouseName}
                onChange={updateField('spouseName')}
                error={errors.spouseName}
                disabled={formDisabled}
                icon={<Icon name="user" className="h-5 w-5" />}
              />
              <Input
                type="date"
                label={tr('kyc.dateOfBirth')}
                value={form.dateOfBirth}
                onChange={updateField('dateOfBirth')}
                error={errors.dateOfBirth}
                disabled={formDisabled}
                icon={<Icon name="calendar" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.occupation')}
                value={form.occupation}
                onChange={updateField('occupation')}
                error={errors.occupation}
                disabled={formDisabled}
                icon={<Icon name="briefcase" className="h-5 w-5" />}
              />
              <Select
                label={tr('kyc.shareCount')}
                value={form.shareCount}
                onChange={(e) => updateField('shareCount')(e)}
                error={errors.shareCount}
                disabled={formDisabled}
              >
                <option value="">—</option>
                {[1, 2, 5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </Select>
            </div>
          </FormSection>

          <FormSection title={tr('kyc.sectionContact')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={tr('kyc.email')}
                type="email"
                value={form.email}
                onChange={updateField('email')}
                error={errors.email}
                disabled={formDisabled}
                icon={<Icon name="globe" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.phone')}
                value={form.phone}
                onChange={updateField('phone')}
                error={errors.phone}
                disabled={formDisabled}
                icon={<Icon name="phone" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.village')}
                value={form.village}
                onChange={updateField('village')}
                error={errors.village}
                disabled={formDisabled}
                icon={<Icon name="mapPin" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.postOffice')}
                value={form.postOffice}
                onChange={updateField('postOffice')}
                error={errors.postOffice}
                disabled={formDisabled}
                icon={<Icon name="mapPin" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.upazila')}
                value={form.upazila}
                onChange={updateField('upazila')}
                error={errors.upazila}
                disabled={formDisabled}
                icon={<Icon name="mapPin" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.district')}
                value={form.district}
                onChange={updateField('district')}
                error={errors.district}
                disabled={formDisabled}
                icon={<Icon name="mapPin" className="h-5 w-5" />}
              />
            </div>
          </FormSection>

          <FormSection title={tr('kyc.sectionNominee')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={tr('kyc.nomineeName')}
                value={form.nomineeName}
                onChange={updateField('nomineeName')}
                error={errors.nomineeName}
                disabled={formDisabled}
                icon={<Icon name="user" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.nomineeRelation')}
                value={form.nomineeRelation}
                onChange={updateField('nomineeRelation')}
                error={errors.nomineeRelation}
                disabled={formDisabled}
                icon={<Icon name="user" className="h-5 w-5" />}
              />
              <Input
                label={tr('kyc.nomineePhone')}
                value={form.nomineePhone}
                onChange={updateField('nomineePhone')}
                error={errors.nomineePhone}
                disabled={formDisabled}
                icon={<Icon name="phone" className="h-5 w-5" />}
              />
            </div>
          </FormSection>

          <FormSection title={tr('kyc.sectionAdditional')}>
            <Textarea
              label={tr('kyc.notes')}
              value={form.notes}
              onChange={updateField('notes')}
              error={errors.notes}
              disabled={formDisabled}
              rows={3}
              placeholder={tr('kyc.notesPlaceholder')}
            />
            {errors.submit && (
              <p className="field-error" role="alert">{errors.submit}</p>
            )}
          </FormSection>

          <FormActions>
            <Button type="button" variant="secondary" onClick={() => router.push('/dashboard')}>
              {tr('common.back')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              loadingLabel={tr('common.saving')}
              disabled={formDisabled || submitting}
            >
              {STATUS === 'rejected' ? tr('kyc.resubmit') : tr('kyc.submit')}
            </Button>
          </FormActions>
        </form>

        {!isBlocked && (
          <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 p-5">
            <p className="text-sm text-brand-600">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              {' '}
              {tr('kyc.intro')}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
