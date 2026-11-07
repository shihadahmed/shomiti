'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
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
  formatDate,
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';
import DocumentUploadField from '@/components/kyc/DocumentUploadField';

const NID_PATTERN = /^\d{10}$|^\d{13}$|^\d{17}$/;
const BD_PHONE_PATTERN = /^01[3-9]\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EDITABLE_STATUSES = ['pending_kyc', 'rejected'];

const STATUS_LABELS = {
  invited: 'status.invited',
  pending_kyc: 'status.pending_kyc',
  under_review: 'status.under_review',
  active: 'status.active',
  rejected: 'status.rejected',
};

const STATUS_VARIANTS = {
  invited: 'default',
  pending_kyc: 'warning',
  under_review: 'warning',
  active: 'success',
  rejected: 'danger',
};

const RELATIONSHIP_VALUES = ['spouse', 'child', 'parent', 'sibling', 'other'];

const EMPTY_NOMINEE = {
  name: '',
  relation: '',
  nid: '',
  phone: '',
  percentage: 0,
  photo: '',
  nidDocument: '',
};

function createInitialForm() {
  return {
    fullName: '',
    fullNameBn: '',
    fatherHusbandName: '',
    motherName: '',
    dateOfBirth: '',
    nid: '',
    occupation: '',
    phone: '',
    email: '',
    presentAddress: '',
    permanentAddress: '',
    sameAsPresent: true,
    photo: '',
    nidDocument: '',
    nominees: [{ ...EMPTY_NOMINEE, percentage: 100 }],
    notes: '',
  };
}

function toDateInput(value) {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function mapNomineeFromData(nominee) {
  return {
    ...(nominee?._id ? { _id: nominee._id } : {}),
    name: nominee?.name || '',
    relation: nominee?.relation || '',
    nid: nominee?.nid || '',
    phone: nominee?.phone || '',
    percentage: nominee?.percentage ?? 0,
    photo: nominee?.photo || '',
    nidDocument: nominee?.nidDocument || '',
  };
}

function buildForm(data, profile) {
  const presentAddress = data.presentAddress || '';
  const permanentAddress = data.permanentAddress || '';
  const nominees = Array.isArray(data.nominees) && data.nominees.length
    ? data.nominees.map(mapNomineeFromData)
    : [{ ...EMPTY_NOMINEE, percentage: 100 }];

  return {
    fullName: data.fullName || profile.name || '',
    fullNameBn: data.fullNameBn || '',
    fatherHusbandName: data.fatherHusbandName || '',
    motherName: data.motherName || '',
    dateOfBirth: toDateInput(data.dateOfBirth),
    nid: data.nid || profile.nid || '',
    occupation: data.occupation || '',
    phone: data.phone || profile.phone || '',
    email: data.email || profile.email || '',
    presentAddress,
    permanentAddress,
    sameAsPresent: !permanentAddress || permanentAddress.trim() === presentAddress.trim(),
    photo: data.photo || '',
    nidDocument: data.nidDocument || '',
    nominees,
    notes: data.notes || '',
  };
}

function normalizeErrorField(field) {
  const raw = String(field || '');
  const bracket = raw.match(/^nominees\[(\d+)\]\.(.+)$/);
  if (bracket) return `nominees.${bracket[1]}.${bracket[2]}`;
  const dot = raw.match(/^nominees\.(\d+)\.(.+)$/);
  if (dot) return `nominees.${dot[1]}.${dot[2]}`;
  if (raw.startsWith('nominees')) return 'nominees';
  return raw || 'submit';
}

function StatusBanner({ status, rejectionReason, submittedAt, hasPendingUpdate, updateSubmittedAt, userName }) {
  const { tr } = useLang();

  if (status === 'active' && hasPendingUpdate) {
    return (
      <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-900">{tr('kyc.updatePendingTitle')}</p>
            <p className="mt-1 text-sm text-amber-800">{tr('kyc.updatePendingBody')}</p>
            {updateSubmittedAt && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                {tr('kyc.submittedOn', { date: formatDate(updateSubmittedAt) })}
              </p>
            )}
            <p className="mt-2 text-xs text-amber-700">
              {tr('kyc.updatePendingNote', { name: userName })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'under_review') {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-900">{tr('kyc.underReviewTitle')}</p>
            <p className="mt-1 text-sm text-amber-800">{tr('kyc.underReviewBody')}</p>
            {submittedAt && (
              <p className="mt-1 text-xs font-medium text-amber-700">
                {tr('kyc.submittedOn', { date: formatDate(submittedAt) })}
              </p>
            )}
            <p className="mt-2 text-xs text-amber-700">
              {tr('kyc.underReviewNote', { name: userName })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0">
            <p className="font-semibold text-red-800">{tr('kyc.rejectedTitle')}</p>
            <div className="mt-2 rounded-lg border border-red-200 bg-white/70 p-3 text-sm text-red-800">
              <span className="font-semibold">{tr('kyc.rejectionReasonLabel')} </span>
              {rejectionReason || tr('kyc.noReasonProvided')}
            </div>
            <p className="mt-2 text-sm text-red-700">{tr('kyc.rejectedBody')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3">
          <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-semibold text-emerald-900">{tr('kyc.approvedTitle')}</p>
            <p className="mt-1 text-sm text-emerald-800">{tr('kyc.approvedBodyEditable')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'pending_kyc') {
    return (
      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="font-semibold text-blue-900">{tr('kyc.pendingTitle')}</p>
            <p className="mt-1 text-sm text-blue-800">{tr('kyc.pendingBody')}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const { tr } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
  const [updateSubmittedAt, setUpdateSubmittedAt] = useState(null);
  const [form, setForm] = useState(createInitialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState({});

  const {
    data: profileData,
    loading: profileLoading,
    error: profileError,
    reload: reloadProfile,
  } = useApi('/auth/users/me/kyc', undefined, { enabled: isAuthenticated });

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, checking, isAuthenticated, router]);

  useEffect(() => {
    if (profileLoading || !profileData) return;
    const profile = profileData.profile || profileData;
    const pendingUpdate =
      profile.status === 'active'
      && profile.hasPendingKycUpdate
      && profile.pendingProfileData;

    setStatus(profile.status || null);
    setRejectionReason(profile.rejectionReason || null);
    setSubmittedAt(profile.kycSubmittedAt || null);
    setHasPendingUpdate(Boolean(profile.status === 'active' && profile.hasPendingKycUpdate));
    setUpdateSubmittedAt(profile.kycUpdateSubmittedAt || null);
    setForm(buildForm(pendingUpdate || profile.profileData || {}, profile));
    setErrors({});
  }, [profileData, profileLoading]);

  const editable = EDITABLE_STATUSES.includes(status)
    || (status === 'active' && !hasPendingUpdate);
  const underReview = status === 'under_review';
  const pendingUpdate = status === 'active' && hasPendingUpdate;
  const isUploading = Object.values(uploading).some(Boolean);

  const relationOptions = useMemo(
    () => [
      { value: '', label: tr('relationship.select') },
      { value: 'spouse', label: tr('relationship.spouse') },
      { value: 'child', label: tr('relationship.child') },
      { value: 'parent', label: tr('relationship.parent') },
      { value: 'sibling', label: tr('relationship.sibling') },
      { value: 'other', label: tr('relationship.other') },
    ],
    [tr],
  );

  const totalNomineePercentage = form.nominees.reduce(
    (sum, nominee) => sum + (Number(nominee.percentage) || 0),
    0,
  );

  const clearError = useCallback((field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const updateField = useCallback((field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'presentAddress' && prev.sameAsPresent) {
        next.permanentAddress = value;
      }
      return next;
    });
    clearError(field);
  }, [clearError]);

  const handleSameAsPresent = useCallback((event) => {
    const checked = event.target.checked;
    setForm((prev) => ({
      ...prev,
      sameAsPresent: checked,
      permanentAddress: checked ? prev.presentAddress : prev.permanentAddress,
    }));
    clearError('permanentAddress');
  }, [clearError]);

  const updateNominee = useCallback((index, field, value) => {
    setForm((prev) => ({
      ...prev,
      nominees: prev.nominees.map((nominee, nomineeIndex) => (
        nomineeIndex === index ? { ...nominee, [field]: value } : nominee
      )),
    }));
    clearError(`nominees.${index}.${field}`);
    clearError('nominees');
    clearError('nomineesDuplicateNid');
  }, [clearError]);

  const addNominee = useCallback(() => {
    if (form.nominees.length >= 3) {
      toast.warning(tr('members.maxNominees'));
      return;
    }
    setForm((prev) => ({
      ...prev,
      nominees: [...prev.nominees, { ...EMPTY_NOMINEE, percentage: 0 }],
    }));
  }, [form.nominees.length, tr]);

  const removeNominee = useCallback((index) => {
    if (form.nominees.length <= 1) {
      toast.warning(tr('members.minNominees'));
      return;
    }
    setForm((prev) => ({
      ...prev,
      nominees: prev.nominees.filter((_, nomineeIndex) => nomineeIndex !== index),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith('nominees')) delete next[key];
      }
      return next;
    });
  }, [form.nominees.length, tr]);

  const handleUploadState = useCallback((key, isUploadingNow) => {
    setUploading((prev) => ({ ...prev, [key]: isUploadingNow }));
  }, []);

  const validateForm = () => {
    const next = {};

    if (!form.fullName.trim()) next.fullName = tr('validation.fullNameRequired');
    if (!form.nid.trim()) {
      next.nid = tr('validation.nidRequired');
    } else if (!NID_PATTERN.test(form.nid.trim())) {
      next.nid = tr('validation.nidInvalid');
    }

    if (!form.phone.trim()) {
      next.phone = tr('validation.phoneRequired');
    } else if (!BD_PHONE_PATTERN.test(form.phone.trim())) {
      next.phone = tr('validation.phoneInvalid');
    }

    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      next.email = tr('validation.email');
    }

    if (!form.presentAddress.trim()) {
      next.presentAddress = tr('validation.presentAddressRequired');
    }

    const nomineeNids = [];
    form.nominees.forEach((nominee, index) => {
      if (!nominee.name.trim()) {
        next[`nominees.${index}.name`] = tr('validation.nomineeNameRequired');
      }
      if (!nominee.relation) {
        next[`nominees.${index}.relation`] = tr('validation.nomineeRelationRequired');
      }
      if (!nominee.nid.trim()) {
        next[`nominees.${index}.nid`] = tr('validation.nomineeNidRequired');
      } else if (!NID_PATTERN.test(nominee.nid.trim())) {
        next[`nominees.${index}.nid`] = tr('validation.nomineeNidInvalid');
      }
      if (nominee.phone.trim() && !BD_PHONE_PATTERN.test(nominee.phone.trim())) {
        next[`nominees.${index}.phone`] = tr('validation.nomineePhoneInvalid');
      }

      const percentage = Number(nominee.percentage);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        next[`nominees.${index}.percentage`] = tr('validation.percentageRange');
      }
      if (nominee.nid.trim()) nomineeNids.push(nominee.nid.trim());
    });

    if (Math.abs(totalNomineePercentage - 100) > 0.01) {
      next.nominees = tr('validation.nomineeTotal', { percentage: totalNomineePercentage });
    }
    if (new Set(nomineeNids).size !== nomineeNids.length) {
      next.nomineesDuplicateNid = tr('validation.nomineeDuplicateNid');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => ({
    fullName: form.fullName.trim(),
    fullNameBn: form.fullNameBn.trim(),
    fatherHusbandName: form.fatherHusbandName.trim(),
    motherName: form.motherName.trim(),
    dateOfBirth: form.dateOfBirth || null,
    nid: form.nid.trim(),
    occupation: form.occupation.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    presentAddress: form.presentAddress.trim(),
    permanentAddress: form.sameAsPresent
      ? form.presentAddress.trim()
      : form.permanentAddress.trim(),
    sameAsPresent: Boolean(form.sameAsPresent),
    photo: form.photo || '',
    nidDocument: form.nidDocument || '',
    nominees: form.nominees.map((nominee) => ({
      ...(nominee._id ? { _id: nominee._id } : {}),
      name: nominee.name.trim(),
      relation: nominee.relation,
      nid: nominee.nid.trim(),
      phone: nominee.phone.trim(),
      percentage: Number(nominee.percentage) || 0,
      photo: nominee.photo || '',
      nidDocument: nominee.nidDocument || '',
    })),
    notes: form.notes.trim(),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!editable) return;

    setErrors({});
    if (isUploading) {
      toast.warning(tr('kyc.uploadInProgress'));
      return;
    }
    if (!validateForm()) {
      toast.error(tr('validation.resolveErrors'));
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiPost('/auth/users/me/kyc', buildPayload());
      const isUpdateRequest = status === 'active';
      toast.success(
        response?.message
          || tr(isUpdateRequest ? 'kyc.updateSubmittedSuccess' : 'kyc.submittedSuccess'),
      );
      if (isUpdateRequest) {
        setHasPendingUpdate(true);
      } else {
        setStatus('under_review');
      }
      setRejectionReason(null);
      await reloadProfile();
    } catch (requestError) {
      const details = requestError?.details;
      if (Array.isArray(details) && details.length) {
        const fieldErrors = {};
        for (const detail of details) {
          fieldErrors[normalizeErrorField(detail.field)] = tr(detail.message);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({ submit: requestError?.message || tr('error.generic') });
      }
      toast.error(requestError?.message || tr('error.generic'));
    } finally {
      setSubmitting(false);
    }
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

  if (profileLoading && !profileData) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (profileError) {
    return (
      <AppShell>
        <PageHeader title={tr('kyc.completeProfile')} subtitle={tr('kyc.profileSubtitle')} />
        <div className="card card-pad py-12 text-center">
          <EmptyState icon="alert" title={tr('common.error')} description={profileError} />
          <Button type="button" className="mt-5" onClick={() => reloadProfile()}>
            {tr('common.retry')}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={tr('kyc.completeProfile')}
        subtitle={tr('kyc.profileSubtitle')}
        actions={status ? (
          <Badge variant={STATUS_VARIANTS[status] || 'default'}>
            {tr(STATUS_LABELS[status] || status)}
          </Badge>
        ) : null}
      />

      <div className="max-w-4xl">
        <StatusBanner
          status={status}
          rejectionReason={rejectionReason}
          submittedAt={submittedAt}
          hasPendingUpdate={hasPendingUpdate}
          updateSubmittedAt={updateSubmittedAt}
          userName={user.name}
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset disabled={!editable} className="m-0 min-w-0 space-y-6 border-0 p-0">
            <FormSection title={tr('members.section.personalInfo')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={tr('members.fullName')}
                  value={form.fullName}
                  onChange={(event) => updateField('fullName', event.target.value)}
                  error={errors.fullName}
                  required={editable}
                  icon={<Icon name="user" className="h-5 w-5" />}
                />
                <Input
                  label={tr('members.fullNameBn')}
                  value={form.fullNameBn}
                  onChange={(event) => updateField('fullNameBn', event.target.value)}
                  error={errors.fullNameBn}
                  icon={<Icon name="user" className="h-5 w-5" />}
                />
                <Input
                  label={tr('members.fatherHusbandName')}
                  value={form.fatherHusbandName}
                  onChange={(event) => updateField('fatherHusbandName', event.target.value)}
                  error={errors.fatherHusbandName}
                  icon={<Icon name="user" className="h-5 w-5" />}
                />
                <Input
                  label={tr('members.motherName')}
                  value={form.motherName}
                  onChange={(event) => updateField('motherName', event.target.value)}
                  error={errors.motherName}
                  icon={<Icon name="user" className="h-5 w-5" />}
                />
                <Input
                  type="date"
                  label={tr('members.dob')}
                  value={form.dateOfBirth}
                  onChange={(event) => updateField('dateOfBirth', event.target.value)}
                  error={errors.dateOfBirth}
                  icon={<Icon name="calendar" className="h-5 w-5" />}
                />
                <Input
                  label={tr('members.nid')}
                  value={form.nid}
                  onChange={(event) => updateField('nid', event.target.value)}
                  error={errors.nid}
                  required={editable}
                  icon={<Icon name="id" className="h-5 w-5" />}
                />
                <Input
                  label={tr('members.occupation')}
                  value={form.occupation}
                  onChange={(event) => updateField('occupation', event.target.value)}
                  error={errors.occupation}
                  icon={<Icon name="briefcase" className="h-5 w-5" />}
                />
                <Input
                  label={tr('members.phone')}
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  error={errors.phone}
                  required={editable}
                  icon={<Icon name="phone" className="h-5 w-5" />}
                />
                <div className="sm:col-span-2">
                  <Input
                    type="email"
                    label={tr('members.email')}
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    error={errors.email}
                    icon={<Icon name="globe" className="h-5 w-5" />}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title={tr('kyc.sectionAddress')}>
              <div className="space-y-4">
                <Textarea
                  label={tr('members.presentAddress')}
                  value={form.presentAddress}
                  onChange={(event) => updateField('presentAddress', event.target.value)}
                  error={errors.presentAddress}
                  rows={3}
                  required={editable}
                />

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-brand-800">
                  <input
                    type="checkbox"
                    checked={form.sameAsPresent}
                    onChange={handleSameAsPresent}
                    disabled={!editable}
                    className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                  />
                  {tr('members.sameAsPresent')}
                </label>

                <Textarea
                  label={tr('members.permanentAddress')}
                  value={form.permanentAddress}
                  onChange={(event) => updateField('permanentAddress', event.target.value)}
                  error={errors.permanentAddress}
                  rows={3}
                  disabled={form.sameAsPresent}
                />
              </div>
            </FormSection>

            <FormSection title={tr('kyc.sectionDocuments')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DocumentUploadField
                  label={tr('members.applicantPhoto')}
                  hint={tr('members.photoHint')}
                  value={form.photo}
                  onChange={(url) => updateField('photo', url)}
                  accept="image/jpeg,image/png"
                  maxSizeMB={2}
                  disabled={!editable}
                  error={errors.photo}
                  uploadLabel={tr('members.uploadPhoto')}
                  changeLabel={tr('members.changePhoto')}
                  onUploadingChange={(isUploadingNow) => handleUploadState('photo', isUploadingNow)}
                />
                <DocumentUploadField
                  label={tr('members.nidDocument')}
                  hint={tr('members.nidDocumentHint')}
                  value={form.nidDocument}
                  onChange={(url) => updateField('nidDocument', url)}
                  accept="application/pdf,image/jpeg,image/png"
                  maxSizeMB={3}
                  disabled={!editable}
                  error={errors.nidDocument}
                  uploadLabel={tr('members.uploadNidDocument')}
                  changeLabel={tr('members.changeNidDocument')}
                  onUploadingChange={(isUploadingNow) => handleUploadState('nidDocument', isUploadingNow)}
                />
              </div>
            </FormSection>

            <FormSection title={tr('members.section.nomineeInfo')}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-brand-500">{tr('kyc.nomineeHint')}</p>
                  <Badge variant={Math.abs(totalNomineePercentage - 100) <= 0.01 ? 'success' : 'danger'}>
                    {tr('members.nomineeTotal', { percentage: totalNomineePercentage })}
                  </Badge>
                </div>

                {errors.nominees && (
                  <p className="field-error" role="alert">{errors.nominees}</p>
                )}
                {errors.nomineesDuplicateNid && (
                  <p className="field-error" role="alert">{errors.nomineesDuplicateNid}</p>
                )}

                {form.nominees.map((nominee, index) => {
                  const options = nominee.relation && !RELATIONSHIP_VALUES.includes(nominee.relation)
                    ? [...relationOptions, { value: nominee.relation, label: nominee.relation }]
                    : relationOptions;

                  return (
                    <div
                      key={nominee._id || index}
                      className="space-y-4 rounded-xl border border-brand-200/80 bg-white p-4"
                    >
                      <div className="flex items-center justify-between border-b border-brand-100 pb-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                          {tr('members.nominee', { idx: index + 1 })}
                        </span>
                        {editable && form.nominees.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeNominee(index)}
                            disabled={isUploading}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                            {tr('members.removeNominee')}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DocumentUploadField
                          label={tr('members.nomineePhoto')}
                          value={nominee.photo}
                          onChange={(url) => updateNominee(index, 'photo', url)}
                          accept="image/jpeg,image/png"
                          maxSizeMB={2}
                          disabled={!editable}
                          size="sm"
                          error={errors[`nominees.${index}.photo`]}
                          uploadLabel={tr('members.uploadNomineePhoto')}
                          changeLabel={tr('members.changeNomineePhoto')}
                          onUploadingChange={(isUploadingNow) => (
                            handleUploadState(`nominee-${index}-photo`, isUploadingNow)
                          )}
                        />
                        <DocumentUploadField
                          label={tr('members.nomineeNidDocument')}
                          value={nominee.nidDocument}
                          onChange={(url) => updateNominee(index, 'nidDocument', url)}
                          accept="application/pdf,image/jpeg,image/png"
                          maxSizeMB={3}
                          disabled={!editable}
                          size="sm"
                          error={errors[`nominees.${index}.nidDocument`]}
                          uploadLabel={tr('members.uploadNomineeNidDocument')}
                          changeLabel={tr('members.changeNomineeNidDocument')}
                          onUploadingChange={(isUploadingNow) => (
                            handleUploadState(`nominee-${index}-nidDocument`, isUploadingNow)
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <Input
                          id={`nominee-${index}-name`}
                          label={tr('members.nomineeName')}
                          value={nominee.name}
                          onChange={(event) => updateNominee(index, 'name', event.target.value)}
                          error={errors[`nominees.${index}.name`]}
                          required={editable}
                        />
                        <Select
                          id={`nominee-${index}-relation`}
                          label={tr('members.nomineeRelation')}
                          options={options}
                          value={nominee.relation}
                          onChange={(event) => updateNominee(index, 'relation', event.target.value)}
                          error={errors[`nominees.${index}.relation`]}
                          required={editable}
                        />
                        <Input
                          id={`nominee-${index}-nid`}
                          label={tr('members.nomineeNid')}
                          value={nominee.nid}
                          onChange={(event) => updateNominee(index, 'nid', event.target.value)}
                          error={errors[`nominees.${index}.nid`]}
                          required={editable}
                        />
                        <Input
                          id={`nominee-${index}-phone`}
                          label={tr('members.nomineePhone')}
                          value={nominee.phone}
                          onChange={(event) => updateNominee(index, 'phone', event.target.value)}
                          error={errors[`nominees.${index}.phone`]}
                        />
                        <Input
                          id={`nominee-${index}-percentage`}
                          type="number"
                          min="0"
                          max="100"
                          label={tr('members.nomineeShare')}
                          value={nominee.percentage}
                          onChange={(event) => updateNominee(index, 'percentage', event.target.value)}
                          error={errors[`nominees.${index}.percentage`]}
                          required={editable}
                        />
                      </div>
                    </div>
                  );
                })}

                {editable && form.nominees.length < 3 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addNominee}
                    className="w-full border-2 border-dashed py-2.5 text-xs font-semibold"
                  >
                    <Icon name="plus" className="mr-1.5 h-4 w-4" />
                    {tr('members.addNominee')}
                  </Button>
                )}
              </div>
            </FormSection>

            <FormSection title={tr('kyc.sectionAdditional')}>
              <Textarea
                label={tr('kyc.notes')}
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                error={errors.notes}
                rows={3}
                placeholder={tr('kyc.notesPlaceholder')}
              />
            </FormSection>
          </fieldset>

          {errors.submit && (
            <p className="field-error" role="alert">{errors.submit}</p>
          )}

          <FormActions>
            {underReview && (
              <p className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-brand-500">
                <Icon name="lock" className="h-3.5 w-3.5" />
                {tr('kyc.formLockedUnderReview')}
              </p>
            )}
            {pendingUpdate && (
              <p className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <Icon name="lock" className="h-3.5 w-3.5" />
                {tr('kyc.formLockedPendingUpdate')}
              </p>
            )}
            <Button type="button" variant="secondary" onClick={() => router.push('/dashboard')}>
              {tr('common.back')}
            </Button>
            {editable && (
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                loadingLabel={tr('common.saving')}
                disabled={submitting || isUploading}
              >
                {status === 'active'
                  ? tr('kyc.submitUpdateRequest')
                  : status === 'rejected'
                    ? tr('kyc.resubmit')
                    : tr('kyc.submit')}
              </Button>
            )}
          </FormActions>
        </form>
      </div>
    </AppShell>
  );
}
