'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useLang } from '@/lib/useLang';
import { apiPost, apiPatch, apiUpload } from '@/lib/useApi';
import { Icon, Button, Input, Select } from '@/components/ui/common';

const RELATIONSHIPS = [
  { value: '', label: 'Select Relationship' },
  { value: 'spouse', label: 'Wife / Husband (স্ত্রী / স্বামী)' },
  { value: 'child', label: 'Son / Daughter (ছেলে / মেয়ে)' },
  { value: 'parent', label: 'Father / Mother (পিতা / মাতা)' },
  { value: 'sibling', label: 'Brother / Sister (ভাই / বোন)' },
  { value: 'other', label: 'Other (অন্যান্য)' },
];

export default function MemberRegistrationForm({
  initialData = null,
  onSuccess,
  onCancel,
}) {
  const { tr, lang } = useLang();
  const [submitting, setSubmitting] = useState(false);

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
    photo: null,       // Base64 / URL for Member Photo
    nidDocument: null, // Base64 / URL for Member NID
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
        photo: null,       // Base64 / URL for Nominee Photo
        nidDocument: null, // Base64 / URL for Nominee NID
      },
    ],
  });

  const [errors, setErrors] = useState({});

  // Upload loading states
  const [uploading, setUploading] = useState({
    photo: false,
    nidDocument: false,
    nominees: {},
  });

  // Upload file to Cloudinary
  const uploadFile = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await apiUpload('/upload', formData);
      return result.url;
    } catch (error) {
      toast.error(error?.message || 'File upload failed');
      throw error;
    }
  }, []);

  // Handle file upload with Cloudinary
  const handleFileUpload = useCallback(async (e, callback, maxSizeMB = 3, uploadKey) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size must be within ${maxSizeMB}MB`);
      return;
    }

    // Set loading state
    if (uploadKey) {
      setUploading(prev => {
        if (uploadKey.startsWith('nominee_')) {
          const [_, index, field] = uploadKey.split('_');
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
      toast.success('File uploaded successfully');
    } catch (err) {
      // Error already handled in uploadFile
    } finally {
      // Clear loading state
      if (uploadKey) {
        setUploading(prev => {
          if (uploadKey.startsWith('nominee_')) {
            const [_, index, field] = uploadKey.split('_');
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
  }, [uploadFile]);

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

  // Nominee Operations
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
      toast.warning('Maximum 3 nominees allowed.');
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
      toast.warning('At least 1 nominee is required.');
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

    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required';

    if (!formData.nid.trim()) {
      newErrors.nid = 'NID number is required';
    } else if (!isValidNid(formData.nid.trim())) {
      newErrors.nid = 'NID must be 10, 13 or 17 digits';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Mobile number is required';
    } else if (!isValidBdPhone(formData.phone.trim())) {
      newErrors.phone = 'Enter a valid Bangladeshi mobile number';
    }

    if (!formData.presentAddress.trim()) newErrors.presentAddress = 'Present address is required';

    if (totalNomineePercentage !== 100) {
      newErrors.nomineePercentage = `Total nominee share must equal 100%. Currently: ${totalNomineePercentage}%`;
    }

    formData.nominees.forEach((n, idx) => {
      if (!n.name.trim()) newErrors[`nominee_${idx}_name`] = 'Nominee name required';
      if (!n.relation) newErrors[`nominee_${idx}_rel`] = 'Relationship required';

      if (!n.nid.trim()) {
        newErrors[`nominee_${idx}_nid`] = 'Nominee NID is required';
      } else if (!isValidNid(n.nid.trim())) {
        newErrors[`nominee_${idx}_nid`] = 'NID must be 10, 13 or 17 digits';
      }

      if (n.phone.trim() && !isValidBdPhone(n.phone.trim())) {
        newErrors[`nominee_${idx}_phone`] = 'Enter a valid mobile number';
      }
    });

    const nomineeNids = formData.nominees.map((n) => n.nid.trim()).filter(Boolean);
    if (new Set(nomineeNids).size !== nomineeNids.length) {
      newErrors.nomineeDuplicateNid = 'Duplicate nominee NIDs are not allowed';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please resolve validation errors before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      if (initialData?._id) {
        await apiPatch(`/members/${initialData._id}`, formData);
        toast.success(tr('toast.updated') || 'Member profile updated successfully');
      } else {
        await apiPost('/members', formData);
        toast.success(tr('toast.created') || 'Member registered successfully');
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.message || tr('error.generic') || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[78vh] overflow-y-auto px-1 pr-2">
      {/* SECTION 1: PERSONAL INFORMATION & APPLICANT DOCUMENTS */}
      <div className="rounded-xl border border-brand-200/80 p-4 bg-brand-50/20">
        <div className="flex items-center gap-2 border-b border-brand-100 pb-2 mb-4">
          <Icon name="user" className="h-4 w-4 text-brand-700" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
            1. Personal Information & Documents (ব্যক্তিগত তথ্য ও সংযুক্তি)[cite: 8]
          </h4>
        </div>

        {/* Member Photo & NID Document Upload Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3.5 rounded-xl border border-dashed border-brand-200 bg-white">
          {/* Applicant Photo */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 mb-1.5">
              আবেদনকারীর ছবি (Member Photo)[cite: 8]
            </label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl border border-brand-200 bg-brand-50 flex items-center justify-center overflow-hidden shrink-0">
                {formData.photo ? (
                  <img src={formData.photo} alt="Member" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="camera" className="h-6 w-6 text-brand-400" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition">
                  <Icon name="upload" className="h-3.5 w-3.5 mr-1" />
                  {formData.photo ? 'Change Photo' : 'Upload Photo'}
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
                    Remove
                  </button>
                )}
                <span className="text-[10px] text-brand-500">JPG, PNG (Max 2MB)[cite: 38]</span>
              </div>
            </div>
          </div>

          {/* Applicant NID Card Scan */}
          <div>
            <label className="block text-xs font-semibold text-brand-800 mb-1.5">
              আবেদনকারীর NID ডকুমেন্ট (Member NID Card/Slip)[cite: 16]
            </label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-20 rounded-xl border border-brand-200 bg-brand-50 flex items-center justify-center overflow-hidden shrink-0">
                {formData.nidDocument ? (
                  <img src={formData.nidDocument} alt="NID Doc" className="h-full w-full object-cover" />
                ) : (
                  <Icon name="fileText" className="h-6 w-6 text-brand-400" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition">
                  <Icon name="upload" className="h-3.5 w-3.5 mr-1" />
                  {formData.nidDocument ? 'Change Document' : 'Upload NID'}
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
                    Remove
                  </button>
                )}
                <span className="text-[10px] text-brand-500">JPG, PNG or PDF (Max 3MB)[cite: 38]</span>
              </div>
            </div>
          </div>
        </div>

        {/* Text Fields */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Input
            label="Full Name (English) *"
            placeholder="e.g. Shihad Bin Ahmed"
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            error={errors.fullName}
            required
          />
          <Input
            label="পূর্ণ নাম (বাংলা)"
            placeholder="যেমন: শিহাদ বিন আহমেদ"
            value={formData.fullNameBn}
            onChange={(e) => handleInputChange('fullNameBn', e.target.value)}
          />
          <Input
            label="Father's / Husband's Name"
            placeholder="Enter father or husband's name"
            value={formData.fatherHusbandName}
            onChange={(e) => handleInputChange('fatherHusbandName', e.target.value)}
          />
          <Input
            label="Mother's Name"
            placeholder="Enter mother's name"
            value={formData.motherName}
            onChange={(e) => handleInputChange('motherName', e.target.value)}
          />
          <Input
            label="Date of Birth"
            type="date"
            value={formData.dob}
            onChange={(e) => handleInputChange('dob', e.target.value)}
          />
          <Input
            label="National ID (NID) / Birth Cert *"
            placeholder="10, 13 or 17 digits"
            value={formData.nid}
            onChange={(e) => handleInputChange('nid', e.target.value)}
            error={errors.nid}
            required
          />
          <Input
            label="Mobile Number *"
            placeholder="017XXXXXXXX"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            error={errors.phone}
            required
          />
          <Input
            label="Occupation"
            placeholder="e.g. Service, Business"
            value={formData.occupation}
            onChange={(e) => handleInputChange('occupation', e.target.value)}
          />
        </div>
      </div>

      {/* SECTION 2: CONTACT & ADDRESS */}
      <div className="rounded-xl border border-brand-200/80 p-4 bg-brand-50/20">
        <div className="flex items-center gap-2 border-b border-brand-100 pb-2 mb-3">
          <Icon name="mapPin" className="h-4 w-4 text-brand-700" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
            2. Contact & Address (যোগাযোগ ও ঠিকানা)[cite: 8]
          </h4>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Email Address"
              type="email"
              placeholder="member@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Present Address (বর্তমান ঠিকানা) *"
              placeholder="House, Road, Thana, District"
              value={formData.presentAddress}
              onChange={(e) => handleInputChange('presentAddress', e.target.value)}
              error={errors.presentAddress}
              required
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              id="sameAsPresent"
              checked={formData.sameAsPresent}
              onChange={handleCheckboxChange}
              className="h-4 w-4 rounded border-brand-300 text-brand-900 focus:ring-brand-500 cursor-pointer"
            />
            <label htmlFor="sameAsPresent" className="text-xs font-medium text-brand-700 cursor-pointer">
              স্থায়ী ঠিকানা বর্তমান ঠিকানার অনুরূপ (Same as present address)
            </label>
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Permanent Address (স্থায়ী ঠিকানা)"
              placeholder="House, Road, Thana, District"
              value={formData.permanentAddress}
              disabled={formData.sameAsPresent}
              onChange={(e) => handleInputChange('permanentAddress', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: NOMINEE INFORMATION, NOMINEE PHOTO & NID */}
      <div className="rounded-xl border border-brand-200/80 p-4 bg-brand-50/20 space-y-4">
        <div className="flex items-center justify-between border-b border-brand-100 pb-2">
          <div className="flex items-center gap-2">
            <Icon name="users" className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              3. Nominee Details & Documents (নমিনী তথ্য ও সংযুক্তি)[cite: 9]
            </h4>
          </div>
          <span
            className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
              totalNomineePercentage === 100
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            মোট অংশ: {totalNomineePercentage}%
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
            className="rounded-xl border border-brand-200/80 p-4 bg-white shadow-xs space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-brand-100 pb-2">
              <span className="text-xs font-bold text-brand-900">নমিনী #{idx + 1}</span>
              {formData.nominees.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeNominee(idx)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium inline-flex items-center gap-1"
                >
                  <Icon name="trash" className="h-3 w-3" /> Remove
                </button>
              )}
            </div>

            {/* Nominee Photo & NID Attachment mini-strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-lg border border-dashed border-brand-200 bg-brand-50/40">
              {/* Nominee Photo */}
              <div className="flex items-center gap-2.5">
                <div className="h-12 w-12 rounded-lg border border-brand-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {nominee.photo ? (
                    <img src={nominee.photo} alt={`Nominee ${idx + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="camera" className="h-4 w-4 text-brand-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-brand-800">নমিনীর ছবি (Photo)[cite: 9]</span>
                  <label className="cursor-pointer text-[11px] text-brand-700 hover:text-brand-900 font-medium underline inline-flex items-center gap-1 mt-0.5">
                    <Icon name="upload" className="h-3 w-3" />
                    {nominee.photo ? 'Change' : 'Upload'}
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
                      className="text-[10px] text-rose-600 hover:underline self-start"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Nominee NID Document */}
              <div className="flex items-center gap-2.5">
                <div className="h-12 w-14 rounded-lg border border-brand-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {nominee.nidDocument ? (
                    <img src={nominee.nidDocument} alt={`Nominee NID ${idx + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="fileText" className="h-4 w-4 text-brand-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-brand-800">নমিনীর NID/ডকুমেন্ট[cite: 9]</span>
                  <label className="cursor-pointer text-[11px] text-brand-700 hover:text-brand-900 font-medium underline inline-flex items-center gap-1 mt-0.5">
                    <Icon name="upload" className="h-3 w-3" />
                    {nominee.nidDocument ? 'Change' : 'Upload'}
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
                      className="text-[10px] text-rose-600 hover:underline self-start"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nominee Text Information */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Nominee Name *"
                placeholder="Full Name"
                value={nominee.name}
                onChange={(e) => handleNomineeChange(idx, 'name', e.target.value)}
                error={errors[`nominee_${idx}_name`]}
                required
              />
              <Select
                label="Relationship *"
                options={RELATIONSHIPS}
                value={nominee.relation}
                onChange={(e) => handleNomineeChange(idx, 'relation', e.target.value)}
                error={errors[`nominee_${idx}_rel`]}
                required
              />
              <Input
                label="Share Percentage (%) *"
                type="number"
                min="1"
                max="100"
                value={nominee.percentage}
                onChange={(e) => handleNomineeChange(idx, 'percentage', e.target.value)}
                required
              />
              <Input
                label="NID / Birth Registration *"
                placeholder="10, 13 or 17 digits"
                value={nominee.nid}
                onChange={(e) => handleNomineeChange(idx, 'nid', e.target.value)}
                error={errors[`nominee_${idx}_nid`]}
                required
              />
              <Input
                label="Mobile Number"
                placeholder="017XXXXXXXX"
                value={nominee.phone}
                onChange={(e) => handleNomineeChange(idx, 'phone', e.target.value)}
                error={errors[`nominee_${idx}_phone`]}
              />
              <Input
                label="Address"
                placeholder="Address"
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
            className="w-full border-dashed border-2 py-2 text-xs"
          >
            <Icon name="plus" className="h-3.5 w-3.5 mr-1" />
            + Add Another Nominee (আরেকজন নমিনী যুক্ত করুন)
          </Button>
        )}
      </div>

      {/* STICKY FOOTER ACTIONS */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs pt-3 pb-1 border-t border-brand-200/80 flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {tr('common.cancel') || 'Cancel (বাতিল)'}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={totalNomineePercentage !== 100}
          className="shadow-xs"
        >
          {initialData?._id ? 'Update Member Profile' : 'Save Member Information'}
        </Button>
      </div>
    </form>
  );
}