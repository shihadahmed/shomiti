'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useLang } from '@/lib/useLang';
import { apiPost, apiPatch } from '@/lib/useApi';
import {
  Icon,
  Button,
  Input,
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const MAX_NOMINEES = 5;

function initialForm() {
  return {
    fullName: '',
    fullNameBn: '',
    fatherName: '',
    motherName: '',
    spouseName: '',
    nid: '',
    dateOfBirth: '',
    phone: '',
    email: '',
    occupation: '',
    village: '',
    postOffice: '',
    upazila: '',
    district: '',
    shareCount: 1,
    nominees: [{ name: '', relation: '', nid: '', phone: '', percentage: 100 }],
  };
}

export function MemberRegistrationForm({
  initialData = null,
  onSuccess,
  onCancel,
  mode = 'page',
}) {
  const router = useRouter();
  const { tr, lang } = useLang();
  const isEditMode = Boolean(initialData);

  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        fullName: initialData.fullName || '',
        fullNameBn: initialData.fullNameBn || '',
        fatherName: initialData.fatherName || '',
        motherName: initialData.motherName || '',
        spouseName: initialData.spouseName || '',
        nid: initialData.nid || '',
        dateOfBirth: initialData.dateOfBirth ? initialData.dateOfBirth.split('T')[0] : '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        occupation: initialData.occupation || '',
        village: initialData.address?.village || '',
        postOffice: initialData.address?.postOffice || '',
        upazila: initialData.address?.upazila || '',
        district: initialData.address?.district || '',
        shareCount: initialData.shareCount || 1,
        nominees: initialData.nominees?.length
          ? initialData.nominees.map((n) => ({
              name: n.name || '',
              relation: n.relation || '',
              nid: n.nid || '',
              phone: n.phone || '',
              percentage: n.percentage || 0,
            }))
          : [{ name: '', relation: '', nid: '', phone: '', percentage: 100 }],
      };
    }
    return initialForm();
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validateNominees = useCallback(
    (nominees) => {
      const errs = {};
      const total = nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        errs.nomineesPercentage = tr('validation.nomineesPercentageSum');
      }
      const nids = nominees.map((n) => n.nid);
      if (new Set(nids).size !== nids.length) {
        errs.nomineesDuplicateNid = tr('validation.nomineesDuplicateNid');
      }
      return errs;
    },
    [tr]
  );

  const handleNomineeChange = useCallback((index, field, value) => {
    setForm((prev) => ({
      ...prev,
      nominees: prev.nominees.map((n, i) => (i === index ? { ...n, [field]: value } : n)),
    }));
  }, []);

  const addNominee = useCallback(() => {
    setForm((prev) => {
      if (prev.nominees.length >= MAX_NOMINEES) return prev;
      return {
        ...prev,
        nominees: [...prev.nominees, { name: '', relation: '', nid: '', phone: '', percentage: 0 }],
      };
    });
  }, []);

  const removeNominee = useCallback((index) => {
    setForm((prev) => {
      if (prev.nominees.length <= 1) return prev;
      return {
        ...prev,
        nominees: prev.nominees.filter((_, i) => i !== index),
      };
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const nomineeErrors = validateNominees(form.nominees);
    if (Object.keys(nomineeErrors).length > 0) {
      setErrors(nomineeErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        address: {
          village: form.village,
          postOffice: form.postOffice,
          upazila: form.upazila,
          district: form.district,
        },
        nominees: form.nominees.filter((n) => n.name && n.relation && n.nid),
      };

      if (isEditMode) {
        await apiPatch(`/members/${initialData._id}`, payload);
        toast.success(tr('toast.updated'));
      } else {
        const res = await apiPost('/members', payload);
        toast.success(tr('toast.created'));
        if (res?._id && mode === 'page') {
          router.push(`/members/${res._id}`);
          return;
        }
      }

      onSuccess?.(isEditMode ? { ...initialData, ...payload } : null);
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      if (requestError?.details) {
        const errs = {};
        requestError.details.forEach((d) => {
          errs[d.field] = d.message;
        });
        setErrors(errs);
      } else {
        setErrors({ submit: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    if (mode === 'page') {
      router.back();
    }
  };

  const nomineeTotal = form.nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {errors.submit && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {errors.submit}
        </div>
      )}

      <FormSection title={tr('members.personal')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr('members.fullName')}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            error={errors.fullName}
            required
          />
          <Input
            label={tr('members.fullNameBn')}
            value={form.fullNameBn}
            onChange={(e) => setForm({ ...form, fullNameBn: e.target.value })}
            error={errors.fullNameBn}
          />
          <Input
            label={tr('members.fatherName')}
            value={form.fatherName}
            onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
            error={errors.fatherName}
          />
          <Input
            label={tr('members.motherName')}
            value={form.motherName}
            onChange={(e) => setForm({ ...form, motherName: e.target.value })}
            error={errors.motherName}
          />
          <Input
            label={tr('members.spouseName')}
            value={form.spouseName}
            onChange={(e) => setForm({ ...form, spouseName: e.target.value })}
            error={errors.spouseName}
          />
          <Input
            label={tr('members.nid')}
            value={form.nid}
            onChange={(e) => setForm({ ...form, nid: e.target.value })}
            error={errors.nid}
            required
          />
          <Input
            label={tr('members.dob')}
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            error={errors.dateOfBirth}
          />
          <Input
            label={tr('members.email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={errors.email}
          />
        </div>
      </FormSection>

      <FormSection title={tr('members.contact')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr('members.phone')}
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            error={errors.phone}
            required
          />
          <Input
            label={tr('members.occupation')}
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            error={errors.occupation}
          />
        </div>
      </FormSection>

      <FormSection title={tr('members.address')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr('members.village')}
            value={form.village}
            onChange={(e) => setForm({ ...form, village: e.target.value })}
            error={errors.village}
          />
          <Input
            label={tr('members.postOffice')}
            value={form.postOffice}
            onChange={(e) => setForm({ ...form, postOffice: e.target.value })}
            error={errors.postOffice}
          />
          <Input
            label={tr('members.upazila')}
            value={form.upazila}
            onChange={(e) => setForm({ ...form, upazila: e.target.value })}
            error={errors.upazila}
          />
          <Input
            label={tr('members.district')}
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
            error={errors.district}
          />
        </div>
      </FormSection>

      <FormSection title={tr('members.nominee')}>
        <p className="mb-3 text-xs text-brand-500">{tr('members.nomineeHint')}</p>
        <div className="space-y-3">
          {form.nominees.map((nominee, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-5 border border-brand-200 rounded-xl p-3">
              <Input
                label={index === 0 ? tr('members.nomineeName') : ''}
                placeholder={tr('members.nomineeName')}
                value={nominee.name}
                onChange={(e) => handleNomineeChange(index, 'name', e.target.value)}
                error={errors.nomineesPercentage ? (index === 0 ? tr('validation.nomineesPercentageSum') : undefined) : undefined}
                className="sm:col-span-2"
              />
              <Input
                label={index === 0 ? tr('members.relation') : ''}
                placeholder={tr('members.relation')}
                value={nominee.relation}
                onChange={(e) => handleNomineeChange(index, 'relation', e.target.value)}
                className="sm:col-span-1"
              />
              <Input
                label={index === 0 ? tr('members.nid') : ''}
                placeholder={tr('members.nid')}
                value={nominee.nid}
                onChange={(e) => handleNomineeChange(index, 'nid', e.target.value)}
                error={errors.nomineesDuplicateNid ? (index > 0 ? tr('validation.nomineesDuplicateNid') : undefined) : undefined}
                className="sm:col-span-1"
              />
              <Input
                label={index === 0 ? tr('members.nomineePhone') : ''}
                placeholder={tr('members.nomineePhone')}
                value={nominee.phone}
                onChange={(e) => handleNomineeChange(index, 'phone', e.target.value)}
                className="sm:col-span-1"
              />
              <Input
                label={index === 0 ? tr('members.nomineePercentage') : ''}
                type="number"
                min="0"
                max="100"
                value={nominee.percentage}
                onChange={(e) => handleNomineeChange(index, 'percentage', Number(e.target.value) || 0)}
                className="sm:col-span-1"
              />
              {form.nominees.length > 1 && (
                <button
                  type="button"
                  className="btn-icon h-8 w-8 text-red-500 hover:bg-red-100 self-end mb-5"
                  onClick={() => removeNominee(index)}
                  aria-label={tr('common.delete')}
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {form.nominees.length < MAX_NOMINEES && (
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={addNominee}
            >
              <Icon name="plus" className="h-4 w-4" />
              {tr('members.addNominee')}
            </button>
          )}
          <div className="mt-2 text-sm font-mono text-brand-700">
            {tr('members.nomineeTotal')} {nomineeTotal}%
          </div>
        </div>
      </FormSection>

      <FormSection title={tr('members.account')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr('members.shareCount')}
            type="number"
            min="1"
            value={form.shareCount}
            onChange={(e) => setForm({ ...form, shareCount: Number(e.target.value) || 1 })}
            required
          />
        </div>
      </FormSection>

      <FormActions>
        <Button type="button" variant="secondary" onClick={handleCancel}>
          {tr('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
          {isEditMode ? tr('common.save') : tr('members.add')}
        </Button>
      </FormActions>
    </form>
  );

  if (mode === 'modal') {
    return formContent;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card card-pad">{formContent}</div>
    </div>
  );
}

export default MemberRegistrationForm;