'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost, apiPatch, apiUpload } from '@/lib/useApi';
import { Icon, Button, Input, Select } from '@/components/ui/common';

export default function MemberRegistrationForm({
  initialData = null,
  onSuccess,
  onCancel,
}) {
  const { tr } = useLang();
  const [submitting, setSubmitting] = useState(false);

  // Fetch dynamic system roles
  const { data: rolesApiData, loading: rolesLoading } = useApi(
    '/roles',
    { limit: 100 },
    { enabled: true }
  );

  const roleOptions = useMemo(() => {
    const dbRoles = rolesApiData?.items || [];
    const defaultRoles = [
      { name: 'member', description: 'General Member' },
      { name: 'treasurer', description: 'Treasurer' },
      { name: 'general_secretary', description: 'General Secretary' },
      { name: 'president', description: 'President' },
    ];

    const mergedRoles = [...dbRoles];
    for (const defRole of defaultRoles) {
      if (!mergedRoles.some((r) => r.name === defRole.name)) {
        mergedRoles.push(defRole);
      }
    }

    return mergedRoles.map((r) => ({
      value: r.name,
      label: r.name
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    }));
  }, [rolesApiData]);

  // Relationship options with translation keys
  const relationshipOptions = useMemo(() => [
    { value: '', label: tr('relationship.select') },
    { value: 'spouse', label: tr('relationship.spouse') },
    { value: 'child', label: tr('relationship.child') },
    { value: 'parent', label: tr('relationship.parent') },
    { value: 'sibling', label: tr('relationship.sibling') },
    { value: 'other', label: tr('relationship.other') },
  ], [tr]);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    fullName: '',
    fullNameBn: '',
    fatherHusbandName: '',
    motherName: '',
    dob: '',
    nid: '',
    phone: '',
    email: '',
    occupation: '',
    presentAddress: '',
    permanentAddress: '',
    sameAsPresent: false,
    photo: null,
    nidDocument: null,
    role: 'member',
    nominees: [
      {
        name: '',
        relation: '',
        fatherHusbandName: '',
        nid: '',
        dob: '',
        phone: '',
        address: '',
        percentage: 100,
        photo: null,
        nidDocument: null,
      },
    ],
  });

  const [errors, setErrors] = useState({});

  const [uploading, setUploading] = useState({
    photo: false,
    nidDocument: false,
    nominees: {},
  });

  const uploadFile = useCallback(async (file) => {
    const data = new FormData();
    data.append('file', file);

    try {
      const result = await apiUpload('/upload', data);
      return result.url;
    } catch (error) {
      toast.error(error?.message || tr('toast.fileUploadFailed'));
      throw error;
    }
  }, [tr]);

  const handleFileUpload = useCallback(
    async (e, callback, maxSizeMB = 3, uploadKey) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(tr('toast.fileSizeExceeded', { maxSizeMB }));
        return;
      }

      if (uploadKey) {
        setUploading((prev) => {
          if (uploadKey.startsWith('nominee_')) {
            const [, index, field] = uploadKey.split('_');
            return {
              ...prev,
              nominees: {
                ...prev.nominees,
                [index]: { ...prev.nominees[index], [field]: true },
              },
            };
          }
          return { ...prev, [uploadKey]: true };
        });
      }

      try {
        const url = await uploadFile(file);
        callback(url);
        toast.success(tr('toast.fileUploaded'));
      } catch (err) {
        // Error captured in uploadFile
      } finally {
        if (uploadKey) {
          setUploading((prev) => {
            if (uploadKey.startsWith('nominee_')) {
              const [, index, field] = uploadKey.split('_');
              return {
                ...prev,
                nominees: {
                  ...prev.nominees,
                  [index]: { ...prev.nominees[index], [field]: false },
                },
              };
            }
            return { ...prev, [uploadKey]: false };
          });
        }
      }
    },
    [uploadFile, tr]
  );

  useEffect(() => {
    if (initialData) {
      setFormData({
        code: initialData.code || '',
        fullName: initialData.fullName || '',
        fullNameBn: initialData.fullNameBn || '',
        fatherHusbandName: initialData.fatherHusbandName || '',
        motherName: initialData.motherName || '',
        dob: initialData.dob ? initialData.dob.split('T')[0] : '',
        nid: initialData.nid || '',
        phone: initialData.phone || '',
        email: initialData.email || '',
        occupation: initialData.occupation || '',
        presentAddress: initialData.presentAddress || '',
        permanentAddress: initialData.permanentAddress || '',
        sameAsPresent: initialData.presentAddress === initialData.permanentAddress,
        photo: initialData.photo || null,
        nidDocument: initialData.nidDocument || null,
        role: initialData.role || initialData.user?.role || 'member',
        nominees: initialData.nominees?.length
          ? initialData.nominees.map((n) => ({
              name: n.name || '',
              relation: n.relation || n.relationship || '',
              fatherHusbandName: n.fatherHusbandName || '',
              nid: n.nid || '',
              dob: n.dob ? n.dob.split('T')[0] : '',
              phone: n.phone || '',
              address: n.address || '',
              percentage: n.percentage || 0,
              photo: n.photo || null,
              nidDocument: n.nidDocument || null,
            }))
          : [
              {
                name: '',
                relation: '',
                fatherHusbandName: '',
                nid: '',
                dob: '',
                phone: '',
                address: '',
                percentage: 100,
                photo: null,
                nidDocument: null,
              },
            ],
      });
    }
  }, [initialData]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'presentAddress' && prev.sameAsPresent) {
        updated.permanentAddress = value;
      }
      return updated;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleCheckboxChange = (e) => {
    const checked = e.target.checked;
    setFormData((prev) => ({
      ...prev,
      sameAsPresent: checked,
      permanentAddress: checked ? prev.presentAddress : '',
    }));
  };

  const handleNomineeChange = (index, field, value) => {
    const updatedNominees = [...formData.nominees];
    updatedNominees[index] = {
      ...updatedNominees[index],
      [field]: field === 'percentage' ? Number(value) || 0 : value,
    };
    setFormData((prev) => ({ ...prev, nominees: updatedNominees }));
  };

  const addNominee = () => {
    if (formData.nominees.length >= 3) {
      toast.warning(tr('members.maxNominees'));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      nominees: [
        ...prev.nominees,
        {
          name: '',
          relation: '',
          fatherHusbandName: '',
          nid: '',
          dob: '',
          phone: '',
          address: '',
          percentage: 0,
          photo: null,
          nidDocument: null,
        },
      ],
    }));
  };

  const removeNominee = (index) => {
    if (formData.nominees.length === 1) {
      toast.warning(tr('members.minNominees'));
      return;
    }
    const updated = formData.nominees.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, nominees: updated }));
  };

  const totalNomineePercentage = formData.nominees.reduce(
    (sum, n) => sum + (Number(n.percentage) || 0),
    0
  );

  const isValidNid = (nid) => /^\d{10}$|^\d{13}$|^\d{17}$/.test(nid);
  const isValidBdPhone = (phone) => /^01[3-9]\d{8}$/.test(phone);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = tr('validation.fullNameRequired');

    if (!formData.nid.trim()) {
      newErrors.nid = tr('validation.nidRequired');
    } else if (!isValidNid(formData.nid.trim())) {
      newErrors.nid = tr('validation.nidInvalid');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = tr('validation.phoneRequired');
    } else if (!isValidBdPhone(formData.phone.trim())) {
      newErrors.phone = tr('validation.phoneInvalid');
    }

    if (!formData.presentAddress.trim()) {
      newErrors.presentAddress = tr('validation.presentAddressRequired');
    }

    if (totalNomineePercentage !== 100) {
      newErrors.nomineePercentage = tr('validation.nomineeTotal', { percentage: totalNomineePercentage });
    }

    formData.nominees.forEach((n, idx) => {
      if (!n.name.trim()) newErrors[`nominee_${idx}_name`] = tr('validation.nomineeNameRequired');
      if (!n.relation) newErrors[`nominee_${idx}_rel`] = tr('validation.nomineeRelationRequired');

      if (!n.nid.trim()) {
        newErrors[`nominee_${idx}_nid`] = tr('validation.nomineeNidRequired');
      } else if (!isValidNid(n.nid.trim())) {
        newErrors[`nominee_${idx}_nid`] = tr('validation.nomineeNidInvalid');
      }

      if (n.phone.trim() && !isValidBdPhone(n.phone.trim())) {
        newErrors[`nominee_${idx}_phone`] = tr('validation.nomineePhoneInvalid');
      }
    });

    const nomineeNids = formData.nominees.map((n) => n.nid.trim()).filter(Boolean);
    if (new Set(nomineeNids).size !== nomineeNids.length) {
      newErrors.nomineeDuplicateNid = tr('validation.nomineeDuplicateNid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error(tr('validation.resolveErrors'));
      return;
    }

    setSubmitting(true);
    try {
      let result;
      if (initialData?._id) {
        result = await apiPatch(`/members/${initialData._id}`, formData);
        toast.success(tr('toast.memberUpdated'));
      } else {
        result = await apiPost('/members', formData);
        toast.success(tr('toast.memberCreated'));
      }

      if (onSuccess) onSuccess(result?.member ?? result);
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[78vh] overflow-y-auto px-1 pr-2">
      {/* SECTION 1: PERSONAL INFORMATION & IDENTIFICATION */}
      <div className="rounded-xl border border-brand-200/80 p-5 bg-brand-50/20 shadow-xs">
        <div className="flex items-center gap-2 border-b border-brand-100 pb-3 mb-5">
          <Icon name="user" className="h-5 w-5 text-brand-700" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-900">
            {tr('members.section.personalInfo')}
          </h3>
        </div>

        {/* Member Photo & NID Document Upload Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 p-4 rounded-xl border border-dashed border-brand-200 bg-white">
          {/* Member Photo */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 mb-2">
              {tr('members.applicantPhoto')}
            </label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl border border-brand-200 bg-brand-50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {formData.photo ? (
                  <img src={formData.photo} alt="Applicant" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="camera" className="h-6 w-6 text-brand-400" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition">
                  <Icon name="upload" className="h-3.5 w-3.5 mr-1.5" />
                  {formData.photo ? tr('members.changePhoto') : tr('members.uploadPhoto')}
                  {uploading.photo && <span className="ml-2 text-[10px] text-brand-600">Uploading...</span>}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, (res) => handleInputChange('photo', res), 2, 'photo')}
                  />
                </label>
                {formData.photo && (
                  <button
                    type="button"
                    onClick={() => handleInputChange('photo', null)}
                    className="text-[11px] text-rose-600 hover:underline self-start"
                  >
                    {tr('members.removePhoto')}
                  </button>
                )}
                <span className="text-[10px] text-brand-500">{tr('members.photoHint')}</span>
              </div>
            </div>
          </div>

          {/* Member NID Card */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 mb-2">
              {tr('members.nidDocument')}
            </label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-20 rounded-xl border border-brand-200 bg-brand-50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {formData.nidDocument ? (
                  <img src={formData.nidDocument} alt="National ID" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="fileText" className="h-6 w-6 text-brand-400" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition">
                  <Icon name="upload" className="h-3.5 w-3.5 mr-1.5" />
                  {formData.nidDocument ? tr('members.changeNidDocument') : tr('members.uploadNidDocument')}
                  {uploading.nidDocument && <span className="ml-2 text-[10px] text-brand-600">Uploading...</span>}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, (res) => handleInputChange('nidDocument', res), 3, 'nidDocument')}
                  />
                </label>
                {formData.nidDocument && (
                  <button
                    type="button"
                    onClick={() => handleInputChange('nidDocument', null)}
                    className="text-[11px] text-rose-600 hover:underline self-start"
                  >
                    {tr('members.removeNidDocument')}
                  </button>
                )}
                <span className="text-[10px] text-brand-500">{tr('members.nidDocumentHint')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Text Fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr('members.fullName')}
            placeholder={tr('members.fullName.placeholder')}
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            error={errors.fullName}
            required
          />
          <Input
            label={tr('members.fullNameBn')}
            placeholder={tr('members.fullNameBn.placeholder')}
            value={formData.fullNameBn}
            onChange={(e) => handleInputChange('fullNameBn', e.target.value)}
          />
          <Input
            label={tr('members.fatherHusbandName')}
            placeholder={tr('members.fatherHusbandName.placeholder')}
            value={formData.fatherHusbandName}
            onChange={(e) => handleInputChange('fatherHusbandName', e.target.value)}
          />
          <Input
            label={tr('members.motherName')}
            placeholder={tr('members.motherName.placeholder')}
            value={formData.motherName}
            onChange={(e) => handleInputChange('motherName', e.target.value)}
          />
          <Input
            label={tr('members.dob')}
            type="date"
            value={formData.dob}
            onChange={(e) => handleInputChange('dob', e.target.value)}
          />
          <Input
            label={tr('members.nid')}
            placeholder={tr('members.nid.placeholder')}
            value={formData.nid}
            onChange={(e) => handleInputChange('nid', e.target.value)}
            error={errors.nid}
            required
          />
          <Input
            label={tr('members.phone')}
            placeholder={tr('members.phone.placeholder')}
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            error={errors.phone}
            required
          />
          <Input
            label={tr('members.occupation')}
            placeholder={tr('members.occupation.placeholder')}
            value={formData.occupation}
            onChange={(e) => handleInputChange('occupation', e.target.value)}
          />
          <Select
            label={tr('members.role')}
            options={roleOptions}
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            disabled={rolesLoading}
            required
          />
        </div>
      </div>

      {/* SECTION 2: CONTACT & RESIDENTIAL ADDRESS */}
      <div className="rounded-xl border border-brand-200/80 p-5 bg-brand-50/20 shadow-xs">
        <div className="flex items-center gap-2 border-b border-brand-100 pb-3 mb-4">
          <Icon name="mapPin" className="h-5 w-5 text-brand-700" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-brand-900">
            {tr('members.section.contactAddress')}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label={tr('members.email')}
              type="email"
              placeholder={tr('members.email.placeholder')}
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label={tr('members.presentAddress')}
              placeholder={tr('members.presentAddress.placeholder')}
              value={formData.presentAddress}
              onChange={(e) => handleInputChange('presentAddress', e.target.value)}
              error={errors.presentAddress}
              required
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2.5 py-1">
            <input
              type="checkbox"
              id="sameAsPresent"
              checked={formData.sameAsPresent}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-brand-300 text-brand-900 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="sameAsPresent" className="text-xs font-semibold text-brand-800 cursor-pointer">
              {tr('members.sameAsPresent')}
            </label>
          </div>

          <div className="sm:col-span-2">
            <Input
              label={tr('members.permanentAddress')}
              placeholder={tr('members.permanentAddress.placeholder')}
              value={formData.permanentAddress}
              disabled={formData.sameAsPresent}
              onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: NOMINEE INFORMATION & DOCUMENTS */}
      <div className="rounded-xl border border-brand-200/80 p-5 bg-brand-50/20 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-100 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="users" className="h-5 w-5 text-brand-700" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-brand-900">
              {tr('members.section.nomineeInfo')}
            </h3>
          </div>
          <span
            className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md ${
              totalNomineePercentage === 100
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {tr('members.nomineeTotal', { percentage: totalNomineePercentage })}
          </span>
        </div>

        {errors.nomineePercentage && (
          <p className="text-xs font-semibold text-rose-600">{errors.nomineePercentage}</p>
        )}

        {errors.nomineeDuplicateNid && (
          <p className="text-xs font-semibold text-rose-600">{errors.nomineeDuplicateNid}</p>
        )}

        {formData.nominees.map((nominee, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-brand-200/80 p-4 bg-white shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-brand-100 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-900">
                {tr('members.nominee', { idx: idx + 1 })}
              </span>
              {formData.nominees.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeNominee(idx)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" /> {tr('members.removeNominee')}
                </button>
              )}
            </div>

            {/* Nominee Uploads */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40">
              {/* Nominee Photo */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg border border-brand-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {nominee.photo ? (
                    <img src={nominee.photo} alt={`Nominee ${idx + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="camera" className="h-4 w-4 text-brand-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-brand-800">{tr('members.nomineePhoto')}</span>
                  <label className="cursor-pointer text-[11px] text-brand-700 hover:text-brand-900 font-semibold underline inline-flex items-center gap-1 mt-0.5">
                    <Icon name="upload" className="h-3 w-3" />
                    {nominee.photo ? tr('members.changeNomineePhoto') : tr('members.uploadNomineePhoto')}
                    {uploading.nominees[idx]?.photo && <span className="ml-1 text-[10px] text-brand-600">Uploading...</span>}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, (res) => handleNomineeChange(idx, 'photo', res), 2, `nominee_${idx}_photo`)
                      }
                    />
                  </label>
                  {nominee.photo && (
                    <button
                      type="button"
                      onClick={() => handleNomineeChange(idx, 'photo', null)}
                      className="text-[10px] text-rose-600 hover:underline self-start mt-0.5"
                    >
                      {tr('members.removeNomineePhoto')}
                    </button>
                  )}
                </div>
              </div>

              {/* Nominee NID */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-14 rounded-lg border border-brand-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {nominee.nidDocument ? (
                    <img src={nominee.nidDocument} alt={`Nominee Document ${idx + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="fileText" className="h-4 w-4 text-brand-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-brand-800">{tr('members.nomineeNidDocument')}</span>
                  <label className="cursor-pointer text-[11px] text-brand-700 hover:text-brand-900 font-semibold underline inline-flex items-center gap-1 mt-0.5">
                    <Icon name="upload" className="h-3 w-3" />
                    {nominee.nidDocument ? tr('members.changeNomineeNidDocument') : tr('members.uploadNomineeNidDocument')}
                    {uploading.nominees[idx]?.nidDocument && <span className="ml-1 text-[10px] text-brand-600">Uploading...</span>}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e, (res) => handleNomineeChange(idx, 'nidDocument', res), 3, `nominee_${idx}_nidDocument`)
                      }
                    />
                  </label>
                  {nominee.nidDocument && (
                    <button
                      type="button"
                      onClick={() => handleNomineeChange(idx, 'nidDocument', null)}
                      className="text-[10px] text-rose-600 hover:underline self-start mt-0.5"
                    >
                      {tr('members.removeNomineeNidDocument')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nominee Inputs */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Input
                label={tr('members.nomineeName')}
                placeholder={tr('members.nomineeName.placeholder')}
                value={nominee.name}
                onChange={(e) => handleNomineeChange(idx, 'name', e.target.value)}
                error={errors[`nominee_${idx}_name`]}
                required
              />
              <Select
                label={tr('members.nomineeRelation')}
                options={relationshipOptions}
                value={nominee.relation}
                onChange={(e) => handleNomineeChange(idx, 'relation', e.target.value)}
                error={errors[`nominee_${idx}_rel`]}
                required
              />
              <Input
                label={tr('members.nomineeShare')}
                type="number"
                min="1"
                max="100"
                placeholder={tr('members.nomineeShare.placeholder')}
                value={nominee.percentage}
                onChange={(e) => handleNomineeChange(idx, 'percentage', e.target.value)}
                required
              />
              <Input
                label={tr('members.nomineeNid')}
                placeholder={tr('members.nomineeNid.placeholder')}
                value={nominee.nid}
                onChange={(e) => handleNomineeChange(idx, 'nid', e.target.value)}
                error={errors[`nominee_${idx}_nid`]}
                required
              />
              <Input
                label={tr('members.nomineePhone')}
                placeholder={tr('members.nomineePhone.placeholder')}
                value={nominee.phone}
                onChange={(e) => handleNomineeChange(idx, 'phone', e.target.value)}
                error={errors[`nominee_${idx}_phone`]}
              />
              <Input
                label={tr('members.nomineeAddress')}
                placeholder={tr('members.nomineeAddress.placeholder')}
                value={nominee.address}
                onChange={(e) => handleNomineeChange(idx, 'address', e.target.value)}
              />
            </div>
          </div>
        ))}

        {formData.nominees.length < 3 && (
          <Button
            type="button"
            variant="secondary"
            onClick={addNominee}
            className="w-full border-dashed border-2 py-2.5 text-xs font-semibold"
          >
            <Icon name="plus" className="h-4 w-4 mr-1.5" />
            {tr('members.addNominee')}
          </Button>
        )}
      </div>

      {/* STICKY FOOTER ACTIONS */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs pt-3 pb-1 border-t border-brand-200/80 flex items-center justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tr('members.cancel')}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={totalNomineePercentage !== 100}
          className="shadow-xs"
        >
          {initialData?._id ? tr('members.update') : tr('members.save')}
        </Button>
      </div>
    </form>
  );
}