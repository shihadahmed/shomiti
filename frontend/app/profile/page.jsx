'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import MemberProfileView from '@/components/members/MemberProfileView';
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

const KYC_EDITABLE_STATUSES = ['pending_kyc', 'rejected'];

const KYC_STATUS_LABELS = {
  invited: 'status.invited',
  pending_kyc: 'status.pending_kyc',
  under_review: 'status.under_review',
  active: 'status.active',
  rejected: 'status.rejected',
};

const KYC_STATUS_VARIANTS = {
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

function KYCStatusBanner({ status, rejectionReason, submittedAt, hasPendingUpdate, updateSubmittedAt, userName, tr }) {
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

const RELATIONSHIP_LABELS = {
  spouse: 'relationship.spouse',
  child: 'relationship.child',
  parent: 'relationship.parent',
  sibling: 'relationship.sibling',
  other: 'relationship.other',
};

export default function ProfilePage() {
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
    const member = profileData.member || profile.member;
    const pendingUpdate =
      profile.status === 'active'
      && profile.hasPendingKycUpdate
      && profile.pendingProfileData;

    setStatus(profile.status || null);
    setRejectionReason(profile.rejectionReason || null);
    setSubmittedAt(profile.kycSubmittedAt || null);
    setHasPendingUpdate(Boolean(profile.status === 'active' && profile.hasPendingKycUpdate));
    setUpdateSubmittedAt(profile.kycUpdateSubmittedAt || null);
    setForm(buildForm(pendingUpdate || profile.profileData || {}, member));
    setErrors({});
  }, [profileData, profileLoading]);

  const editable = KYC_EDITABLE_STATUSES.includes(status)
    || (status === 'active' && !hasPendingUpdate);
  const underReview = status === 'under_review';
  const pendingUpdate = status === 'active' && hasPendingUpdate;
  const isUploading = Object.values(uploading).some(Boolean);

  const relationOptions = useMemo(
    () => RELATIONSHIP_VALUES.map((v) => ({ value: v, label: tr(RELATIONSHIP_LABELS[v]) })),
    [tr]
  );

  const nomineeTotal = form.nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleNomineeChange = (idx, field, value) => {
    setForm((prev) => ({
      ...prev,
      nominees: prev.nominees.map((n, i) => (i === idx ? { ...n, [field]: value } : n)),
    }));
    if (errors[`nominees.${idx}.${field}`]) {
      setErrors((prev) => ({ ...prev, [`nominees.${idx}.${field}`]: undefined }));
    }
  };

  const addNominee = () => {
    if (form.nominees.length >= 3) return;
    setForm((prev) => ({ ...prev, nominees: [...prev.nominees, { ...EMPTY_NOMINEE }] }));
  };

  const removeNominee = (idx) => {
    if (form.nominees.length <= 1) return;
    setForm((prev) => ({ ...prev, nominees: prev.nominees.filter((_, i) => i !== idx) }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.fullName?.trim()) newErrors.fullName = tr('validation.fullNameRequired');
    if (!form.nid?.trim()) newErrors.nid = tr('validation.nidRequired');
    else if (!NID_PATTERN.test(form.nid)) newErrors.nid = tr('validation.nidInvalid');
    if (!form.phone?.trim()) newErrors.phone = tr('validation.phoneRequired');
    else if (!BD_PHONE_PATTERN.test(form.phone)) newErrors.phone = tr('validation.phoneInvalid');
    if (form.email && !EMAIL_PATTERN.test(form.email)) newErrors.email = tr('validation.email');
    if (!form.presentAddress?.trim()) newErrors.presentAddress = tr('validation.presentAddressRequired');
    if (form.nominees.length === 0) newErrors.nominees = tr('validation.nomineesRequired');
    else {
      form.nominees.forEach((n, i) => {
        if (!n.name?.trim()) newErrors[`nominees.${i}.name`] = tr('validation.nomineeNameRequired');
        if (!n.relation) newErrors[`nominees.${i}.relation`] = tr('validation.nomineeRelationRequired');
        if (!n.nid?.trim()) newErrors[`nominees.${i}.nid`] = tr('validation.nomineeNidRequired');
        else if (!NID_PATTERN.test(n.nid)) newErrors[`nominees.${i}.nid`] = tr('validation.nomineeNidInvalid');
        if (n.phone && !BD_PHONE_PATTERN.test(n.phone)) newErrors[`nominees.${i}.phone`] = tr('validation.nomineePhoneInvalid');
      });
      if (nomineeTotal !== 100) newErrors.nomineesTotal = tr('validation.nomineeTotal', { percentage: nomineeTotal });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors({});
    try {
      const payload = { ...form };
      delete payload.sameAsPresent; // server doesn't need this
      await apiPatch('/auth/users/me/kyc', payload);
      toast.success(tr('kyc.submittedSuccess') || tr('profile.updated'));
      reloadProfile();
    } catch (requestError) {
      const err = requestError?.details;
      if (err) {
        const mapped = {};
        Object.keys(err).forEach((k) => {
          mapped[normalizeErrorField(k)] = err[k];
        });
        setErrors(mapped);
      } else {
        setErrors({ submit: requestError?.message || tr('error.generic') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || checking) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }
  if (!isAuthenticated) return null;

  if (profileLoading) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }

  if (profileError) {
    return <AppShell><EmptyState icon="alert" title={tr('common.error')} description={profileError} className="p-12" /></AppShell>;
  }

  const profile = profileData?.profile || profileData;
  const member = profileData?.member || profile?.member;
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
        {editable && !underReview && !pendingUpdate && (
          <Button variant="secondary" onClick={() => setForm(buildForm(profileData?.profile || {}, member))} className="shadow-sm" disabled={submitting || isUploading}>
            <Icon name="rotateCcw" className="h-4 w-4 mr-1.5" />
            {tr('common.reset')}
          </Button>
        )}
      </div>

      {/* KYC Status Banner */}
      <KYCStatusBanner
        status={status}
        rejectionReason={rejectionReason}
        submittedAt={submittedAt}
        hasPendingUpdate={hasPendingUpdate}
        updateSubmittedAt={updateSubmittedAt}
        userName={user?.name}
        tr={tr}
      />

      {/* Profile Card */}
      <div className="rounded-2xl border border-brand-200/80 bg-white shadow-xs overflow-hidden">
        {editable ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-6">
            {errors.submit && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                {errors.submit}
              </div>
            )}

            {/* Photo & NID Document */}
            <FormSection title={tr('kyc.sectionDocuments')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DocumentUploadField
                  label={tr('members.applicantPhoto')}
                  value={form.photo}
                  onChange={(v) => handleChange('photo', v)}
                  uploading={uploading.photo}
                  accept="image/*"
                  maxSizeMB={2}
                  hint={tr('members.photoHint')}
                  error={errors.photo}
                />
                <DocumentUploadField
                  label={tr('members.nidDocument')}
                  value={form.nidDocument}
                  onChange={(v) => handleChange('nidDocument', v)}
                  uploading={uploading.nidDocument}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxSizeMB={3}
                  hint={tr('members.nidDocumentHint')}
                  error={errors.nidDocument}
                />
              </div>
            </FormSection>

            {/* Personal Information */}
            <FormSection title={tr('members.section.personalInfo')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">{tr('members.fullName')}</label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    placeholder={tr('members.fullName.placeholder')}
                    error={errors.fullName}
                    required
                  />
                  {errors.fullName && <p className="field-error" role="alert">{errors.fullName}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="label">{tr('members.fullNameBn')}</label>
                  <Input
                    value={form.fullNameBn}
                    onChange={(e) => handleChange('fullNameBn', e.target.value)}
                    placeholder={tr('members.fullNameBn.placeholder')}
                    error={errors.fullNameBn}
                  />
                  {errors.fullNameBn && <p className="field-error" role="alert">{errors.fullNameBn}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.fatherHusbandName')}</label>
                  <Input
                    value={form.fatherHusbandName}
                    onChange={(e) => handleChange('fatherHusbandName', e.target.value)}
                    placeholder={tr('members.fatherHusbandName.placeholder')}
                    error={errors.fatherHusbandName}
                  />
                  {errors.fatherHusbandName && <p className="field-error" role="alert">{errors.fatherHusbandName}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.motherName')}</label>
                  <Input
                    value={form.motherName}
                    onChange={(e) => handleChange('motherName', e.target.value)}
                    placeholder={tr('members.motherName.placeholder')}
                    error={errors.motherName}
                  />
                  {errors.motherName && <p className="field-error" role="alert">{errors.motherName}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.dob')}</label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                    error={errors.dateOfBirth}
                  />
                  {errors.dateOfBirth && <p className="field-error" role="alert">{errors.dateOfBirth}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.nid')}</label>
                  <Input
                    value={form.nid}
                    onChange={(e) => handleChange('nid', e.target.value)}
                    placeholder={tr('members.nid.placeholder')}
                    error={errors.nid}
                    required
                  />
                  {errors.nid && <p className="field-error" role="alert">{errors.nid}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.occupation')}</label>
                  <Input
                    value={form.occupation}
                    onChange={(e) => handleChange('occupation', e.target.value)}
                    placeholder={tr('members.occupation.placeholder')}
                    error={errors.occupation}
                  />
                  {errors.occupation && <p className="field-error" role="alert">{errors.occupation}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.phone')}</label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder={tr('members.phone.placeholder')}
                    error={errors.phone}
                    required
                  />
                  {errors.phone && <p className="field-error" role="alert">{errors.phone}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.email')}</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder={tr('members.email.placeholder')}
                    error={errors.email}
                  />
                  {errors.email && <p className="field-error" role="alert">{errors.email}</p>}
                </div>
              </div>
            </FormSection>

            {/* Address */}
            <FormSection title={tr('members.section.contactAddress')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">{tr('members.presentAddress')}</label>
                  <Textarea
                    value={form.presentAddress}
                    onChange={(e) => handleChange('presentAddress', e.target.value)}
                    placeholder={tr('members.presentAddress.placeholder')}
                    rows={3}
                    error={errors.presentAddress}
                    required
                  />
                  {errors.presentAddress && <p className="field-error" role="alert">{errors.presentAddress}</p>}
                </div>
                <div>
                  <label className="label">{tr('members.permanentAddress')}</label>
                  <Textarea
                    value={form.permanentAddress}
                    onChange={(e) => handleChange('permanentAddress', e.target.value)}
                    placeholder={tr('members.permanentAddress.placeholder')}
                    rows={3}
                    error={errors.permanentAddress}
                  />
                  {errors.permanentAddress && <p className="field-error" role="alert">{errors.permanentAddress}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sameAsPresent"
                    checked={form.sameAsPresent}
                    onChange={(e) => {
                      handleChange('sameAsPresent', e.target.checked);
                      if (e.target.checked) handleChange('permanentAddress', form.presentAddress);
                    }}
                    className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="sameAsPresent" className="text-sm text-brand-700 cursor-pointer">
                    {tr('members.sameAsPresent')}
                  </label>
                </div>
              </div>
            </FormSection>

            {/* Nominees */}
            <FormSection title={tr('members.section.nomineeInfo')}>
              <p className="text-sm text-brand-500 mb-4">{tr('members.nomineeHint')}</p>
              <div className="space-y-4">
                {form.nominees.map((nominee, idx) => (
                  <div key={idx} className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-brand-900">{tr('members.nominee', { idx: idx + 1 })}</h4>
                      {form.nominees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeNominee(idx)}
                          className="text-sm text-rose-600 hover:text-rose-800"
                        >
                          {tr('members.removeNominee')}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="label">{tr('members.nomineeName')}</label>
                        <Input
                          value={nominee.name}
                          onChange={(e) => handleNomineeChange(idx, 'name', e.target.value)}
                          placeholder={tr('members.nomineeName.placeholder')}
                          error={errors[`nominees.${idx}.name`]}
                          required
                        />
                        {errors[`nominees.${idx}.name`] && <p className="field-error" role="alert">{errors[`nominees.${idx}.name`]}</p>}
                      </div>
                      <div>
                        <label className="label">{tr('members.nomineeRelation')}</label>
                        <Select
                          value={nominee.relation}
                          onChange={(e) => handleNomineeChange(idx, 'relation', e.target.value)}
                          options={relationOptions}
                          placeholder={tr('relationship.select')}
                          error={errors[`nominees.${idx}.relation`]}
                          required
                        />
                        {errors[`nominees.${idx}.relation`] && <p className="field-error" role="alert">{errors[`nominees.${idx}.relation`]}</p>}
                      </div>
                      <div>
                        <label className="label">{tr('members.nomineeShare')}</label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={nominee.percentage}
                          onChange={(e) => handleNomineeChange(idx, 'percentage', Number(e.target.value) || 0)}
                          placeholder={tr('members.nomineeShare.placeholder')}
                          error={errors[`nominees.${idx}.percentage`]}
                          required
                        />
                        {errors[`nominees.${idx}.percentage`] && <p className="field-error" role="alert">{errors[`nominees.${idx}.percentage`]}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">{tr('members.nomineeNid')}</label>
                        <Input
                          value={nominee.nid}
                          onChange={(e) => handleNomineeChange(idx, 'nid', e.target.value)}
                          placeholder={tr('members.nomineeNid.placeholder')}
                          error={errors[`nominees.${idx}.nid`]}
                          required
                        />
                        {errors[`nominees.${idx}.nid`] && <p className="field-error" role="alert">{errors[`nominees.${idx}.nid`]}</p>}
                      </div>
                      <div>
                        <label className="label">{tr('members.nomineePhone')}</label>
                        <Input
                          type="tel"
                          value={nominee.phone}
                          onChange={(e) => handleNomineeChange(idx, 'phone', e.target.value)}
                          placeholder={tr('members.nomineePhone.placeholder')}
                          error={errors[`nominees.${idx}.phone`]}
                        />
                        {errors[`nominees.${idx}.phone`] && <p className="field-error" role="alert">{errors[`nominees.${idx}.phone`]}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">{tr('members.nomineeAddress')}</label>
                        <Input
                          value={nominee.address}
                          onChange={(e) => handleNomineeChange(idx, 'address', e.target.value)}
                          placeholder={tr('members.nomineeAddress.placeholder')}
                          as="textarea"
                          rows={2}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <DocumentUploadField
                          label={tr('members.nomineePhoto')}
                          value={nominee.photo}
                          onChange={(v) => handleNomineeChange(idx, 'photo', v)}
                          uploading={uploading[`nominee_${idx}_photo`]}
                          accept="image/*"
                          maxSizeMB={2}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <DocumentUploadField
                          label={tr('members.nomineeNidDocument')}
                          value={nominee.nidDocument}
                          onChange={(v) => handleNomineeChange(idx, 'nidDocument', v)}
                          uploading={uploading[`nominee_${idx}_nid`]}
                          accept=".pdf,.jpg,.jpeg,.png"
                          maxSizeMB={3}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.nomineesTotal && (
                <p className="mt-2 text-sm text-rose-600">{errors.nomineesTotal}</p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-brand-500">
                  {tr('members.nomineeTotal', { percentage: nomineeTotal })}
                </div>
                {form.nominees.length < 3 && (
                  <Button type="button" variant="outline" onClick={addNominee} className="w-full sm:w-auto">
                    <Icon name="plus" className="h-4 w-4 mr-1.5" />
                    {tr('members.addNominee')}
                  </Button>
                )}
              </div>
            </FormSection>

            {/* Additional Notes */}
            <FormSection title={tr('kyc.sectionAdditional')}>
              <Textarea
                label={tr('kyc.notes')}
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder={tr('kyc.notesPlaceholder')}
                rows={3}
              />
            </FormSection>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => router.back()} disabled={submitting || isUploading}>
                {tr('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={submitting || isUploading} loadingLabel={tr('common.saving')}>
                {status === 'pending_kyc' ? tr('kyc.submit') : tr('kyc.submitUpdateRequest')}
              </Button>
            </FormActions>
          </form>
        ) : (
          <MemberProfileView
            member={member}
            memberUser={profile}
            showPortalAccess={false}
            tr={tr}
          />
        )}
      </div>
    </AppShell>
  );
}