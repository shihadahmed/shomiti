'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatMoney, formatDate, Modal, StatusBadge, Pagination, SearchInput, FilterBar } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const STATUSES = ['all', 'active', 'inactive', 'suspended', 'resigned'];

export default function MembersPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const queryParams = { page, limit: 10, search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined };

  const { data, loading, error, reload } = useApi('/members', queryParams, {
    enabled: isAuthenticated,
  });

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

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setPage(1);
    reload();
  }, [reload]);

  const applyUrlSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
    reload();
  };

  const openAdd = () => {
    setEditingMember(null);
    setForm(initialForm());
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setForm({
      fullName: member.fullName || '',
      fullNameBn: member.fullNameBn || '',
      fatherName: member.fatherName || '',
      motherName: member.motherName || '',
      spouseName: member.spouseName || '',
      nid: member.nid || '',
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
      phone: member.phone || '',
      email: member.email || '',
      occupation: member.occupation || '',
      village: member.address?.village || '',
      postOffice: member.address?.postOffice || '',
      upazila: member.address?.upazila || '',
      district: member.address?.district || '',
      shareCount: member.shareCount || 1,
      nominees: member.nominees?.length ? member.nominees.map(n => ({
        name: n.name || '',
        relation: n.relation || '',
        nid: n.nid || '',
        phone: n.phone || '',
        percentage: n.percentage || 0,
      })) : [{ name: '', relation: '', nid: '', phone: '', percentage: 100 }],
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMember(null);
    setForm(initialForm());
    setFormErrors({});
  };

  const validateNominees = (nominees) => {
    const errors = {};
    const total = nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      errors.nomineesPercentage = tr('validation.nomineesPercentageSum');
    }
    const nids = nominees.map(n => n.nid);
    if (new Set(nids).size !== nids.length) {
      errors.nomineesDuplicateNid = tr('validation.nomineesDuplicateNid');
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const nomineeErrors = validateNominees(form.nominees);
    if (Object.keys(nomineeErrors).length > 0) {
      setFormErrors(nomineeErrors);
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
        nominees: form.nominees.filter(n => n.name && n.relation && n.nid),
      };

      if (editingMember) {
        await useApi().then(({ apiPatch }) => apiPatch(`/members/${editingMember._id}`, payload));
      } else {
        await useApi().then(({ apiPost }) => apiPost('/members', payload));
      }

      toast.success(editingMember ? tr('toast.updated') : tr('toast.created'));
      closeModal();
      reload();
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      if (requestError?.details) {
        const errors = {};
        requestError.details.forEach(d => {
          errors[d.field] = d.message;
        });
        setFormErrors(errors);
      } else {
        setFormErrors({ submit: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(tr('common.confirm'))) return;
    try {
      await useApi().then(({ apiDelete }) => apiDelete(`/members/${id}`));
      toast.success(tr('toast.deleted'));
      reload();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
    }
  };

  const handleNomineeChange = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      nominees: prev.nominees.map((n, i) => i === index ? { ...n, [field]: value } : n),
    }));
  };

  const addNominee = () => {
    if (form.nominees.length >= 5) return;
    setForm(prev => ({
      ...prev,
      nominees: [...prev.nominees, { name: '', relation: '', nid: '', phone: '', percentage: 0 }],
    }));
  };

  const removeNominee = (index) => {
    if (form.nominees.length <= 1) return;
    setForm(prev => ({
      ...prev,
      nominees: prev.nominees.filter((_, i) => i !== index),
    }));
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

  if (!isAuthenticated) return null;

  const members = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />
      <PageHeader
        title={tr('members.title')}
        subtitle={tr('members.subtitle')}
        actions={
          <Button variant="primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" />
            {tr('members.add')}
          </Button>
        }
      />

      <form onSubmit={handleSearch} className="mb-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('members.search')}
            className="flex-1 min-w-[280px] max-w-md"
          />
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={STATUSES.map(s => ({ value: s, label: s === 'all' ? tr('members.allStatus') : tr(`members.${s}`) }))}
            className="w-[180px]"
          />
        </FilterBar>
      </form>

      <div className="card">
        {loading ? (
          <div className="p-8 text-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />
        ) : members.length === 0 ? (
          <EmptyState icon="users" title={tr('members.empty')} description={tr('common.noData')} className="p-12" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('members.code')}</th>
                    <th className="th">{tr('members.name')}</th>
                    <th className="th">{tr('members.phone')}</th>
                    <th className="th">{tr('members.joinDate')}</th>
                    <th className="th">{tr('members.savings')}</th>
                    <th className="th">{tr('members.status')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {members.map((member) => (
                    <tr key={member._id} className="tr-hover">
                      <td className="td font-mono text-brand-900">{member.code}</td>
                      <td className="td font-semibold text-brand-900">
                        {lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName}
                      </td>
                      <td className="td font-mono text-brand-700">{member.phone}</td>
                      <td className="td text-brand-700">{member.joinedAt ? formatDate(member.joinedAt) : tr('common.na')}</td>
                      <td className="td font-mono font-semibold text-brand-900">{formatMoney(member.savingsBalance || 0)}</td>
                      <td className="td">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                            onClick={() => openEdit(member)}
                            aria-label={tr('common.edit')}
                          >
                            <Icon name="edit" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-icon h-8 w-8 text-red-500 hover:bg-red-100"
                            onClick={() => handleDelete(member._id)}
                            aria-label={tr('common.delete')}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={meta} onPage={setPage} />
          </>
        )}
      </div>

      <MemberModal
        open={showModal}
        onClose={closeModal}
        title={editingMember ? tr('members.editTitle') : tr('members.newTitle')}
        form={form}
        errors={formErrors}
        onChange={setForm}
        onNomineeChange={handleNomineeChange}
        nominees={form.nominees}
        onAddNominee={addNominee}
        onRemoveNominee={removeNominee}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}

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

function MemberModal({
  open,
  onClose,
  title,
  form,
  errors,
  onChange,
  nominees,
  onNomineeChange,
  onAddNominee,
  onRemoveNominee,
  submitting,
  onSubmit,
}) {
  const { tr } = useLang();

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="xl">
      <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('members.personal')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={tr('members.fullName')}
              value={form.fullName}
              onChange={(e) => onChange({ ...form, fullName: e.target.value })}
              error={errors.fullName}
              required
            />
            <Input
              label={tr('members.fullNameBn')}
              value={form.fullNameBn}
              onChange={(e) => onChange({ ...form, fullNameBn: e.target.value })}
              error={errors.fullNameBn}
            />
            <Input
              label={tr('members.fatherName')}
              value={form.fatherName}
              onChange={(e) => onChange({ ...form, fatherName: e.target.value })}
              error={errors.fatherName}
            />
            <Input
              label={tr('members.motherName')}
              value={form.motherName}
              onChange={(e) => onChange({ ...form, motherName: e.target.value })}
              error={errors.motherName}
            />
            <Input
              label={tr('members.spouseName')}
              value={form.spouseName}
              onChange={(e) => onChange({ ...form, spouseName: e.target.value })}
              error={errors.spouseName}
            />
            <Input
              label={tr('members.nid')}
              value={form.nid}
              onChange={(e) => onChange({ ...form, nid: e.target.value })}
              error={errors.nid}
              required
            />
            <Input
              label={tr('members.dob')}
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => onChange({ ...form, dateOfBirth: e.target.value })}
              error={errors.dateOfBirth}
            />
            <Input
              label={tr('members.email')}
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
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
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              error={errors.phone}
              required
            />
            <Input
              label={tr('members.occupation')}
              value={form.occupation}
              onChange={(e) => onChange({ ...form, occupation: e.target.value })}
              error={errors.occupation}
            />
          </div>
        </FormSection>

        <FormSection title={tr('members.address')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={tr('members.village')}
              value={form.village}
              onChange={(e) => onChange({ ...form, village: e.target.value })}
              error={errors.village}
            />
            <Input
              label={tr('members.postOffice')}
              value={form.postOffice}
              onChange={(e) => onChange({ ...form, postOffice: e.target.value })}
              error={errors.postOffice}
            />
            <Input
              label={tr('members.upazila')}
              value={form.upazila}
              onChange={(e) => onChange({ ...form, upazila: e.target.value })}
              error={errors.upazila}
            />
            <Input
              label={tr('members.district')}
              value={form.district}
              onChange={(e) => onChange({ ...form, district: e.target.value })}
              error={errors.district}
            />
          </div>
        </FormSection>

        <FormSection title={tr('members.nominee')}>
          <p className="mb-3 text-xs text-brand-500">{tr('members.nomineeHint')}</p>
          <div className="space-y-3">
            {nominees.map((nominee, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-5 border border-brand-200 rounded-xl p-3">
                <Input
                  label={index === 0 ? tr('members.nomineeName') : ''}
                  placeholder={tr('members.nomineeName')}
                  value={nominee.name}
                  onChange={(e) => onNomineeChange(index, 'name', e.target.value)}
                  error={errors.nomineesPercentage ? (index === 0 ? tr('validation.nomineesPercentageSum') : undefined) : undefined}
                  className="sm:col-span-2"
                />
                <Input
                  label={index === 0 ? tr('members.relation') : ''}
                  placeholder={tr('members.relation')}
                  value={nominee.relation}
                  onChange={(e) => onNomineeChange(index, 'relation', e.target.value)}
                  className="sm:col-span-1"
                />
                <Input
                  label={index === 0 ? tr('members.nid') : ''}
                  placeholder={tr('members.nid')}
                  value={nominee.nid}
                  onChange={(e) => onNomineeChange(index, 'nid', e.target.value)}
                  error={errors.nomineesDuplicateNid ? (index > 0 ? tr('validation.nomineesDuplicateNid') : undefined) : undefined}
                  className="sm:col-span-1"
                />
                <Input
                  label={index === 0 ? tr('members.nomineePhone') : ''}
                  placeholder={tr('members.nomineePhone')}
                  value={nominee.phone}
                  onChange={(e) => onNomineeChange(index, 'phone', e.target.value)}
                  className="sm:col-span-1"
                />
                <Input
                  label={index === 0 ? tr('members.nomineePercentage') : ''}
                  type="number"
                  min="0"
                  max="100"
                  value={nominee.percentage}
                  onChange={(e) => onNomineeChange(index, 'percentage', Number(e.target.value) || 0)}
                  className="sm:col-span-1"
                />
                {nominees.length > 1 && (
                  <button
                    type="button"
                    className="btn-icon h-8 w-8 text-red-500 hover:bg-red-100 self-end mb-5"
                    onClick={() => onRemoveNominee(index)}
                    aria-label={tr('common.delete')}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {nominees.length < 5 && (
              <button
                type="button"
                className="btn-secondary w-full sm:w-auto"
                onClick={onAddNominee}
              >
                <Icon name="plus" className="h-4 w-4" />
                {tr('members.addNominee')}
              </button>
            )}
            <div className="mt-2 text-sm font-mono text-brand-700">
              {tr('members.nomineeTotal')} {nominees.reduce((sum, n) => sum + (Number(n.percentage) || 0), 0)}%
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
              onChange={(e) => onChange({ ...form, shareCount: Number(e.target.value) || 1 })}
              required
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {editingMember ? tr('common.save') : tr('members.add')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}