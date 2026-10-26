'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatMoney, formatDate, StatusBadge, Pagination, SearchInput, FilterBar, Modal, Tabs, Tab } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const SCHEME_TYPES = [
  { value: '', label: 'All' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'one_time', label: 'One-Time' },
];

const ENROLLMENT_STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'defaulted', label: 'Defaulted' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function SchemesPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('schemes');
  const [schemePage, setSchemePage] = useState(1);
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [enrollingMember, setEnrollingMember] = useState(null);
  const [schemeForm, setSchemeForm] = useState(initialSchemeForm());
  const [enrollForm, setEnrollForm] = useState(initialEnrollForm());
  const [schemeErrors, setSchemeErrors] = useState({});
  const [enrollErrors, setEnrollErrors] = useState({});
  const [schemeSubmitting, setSchemeSubmitting] = useState(false);
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);

  const schemeParams = { page: schemePage, limit: 15, active: 'true' };
  const enrollmentParams = { page: enrollmentPage, limit: 15 };

  const { data: schemeData, loading: schemeLoading, error: schemeError, reload: reloadSchemes } = useApi('/schemes', schemeParams, {
    enabled: isAuthenticated && activeTab === 'schemes',
  });

  const { data: enrollmentData, loading: enrollmentLoading, error: enrollmentError, reload: reloadEnrollments } = useApi('/schemes/enrollments', enrollmentParams, {
    enabled: isAuthenticated && activeTab === 'enrollments',
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

  const handleSchemeSearch = useCallback(() => {
    setSchemePage(1);
    reloadSchemes();
  }, [reloadSchemes]);

  const handleEnrollmentSearch = useCallback(() => {
    setEnrollmentPage(1);
    reloadEnrollments();
  }, [reloadEnrollments]);

  const openAddScheme = () => {
    setEditingScheme(null);
    setSchemeForm(initialSchemeForm());
    setSchemeErrors({});
    setShowSchemeModal(true);
  };

  const openEditScheme = (scheme) => {
    setEditingScheme(scheme);
    setSchemeForm({
      savingsType: scheme.savingsType,
      name: scheme.name || '',
      nameBn: scheme.nameBn || '',
      description: scheme.description || '',
      lateFeePercent: scheme.lateFeePercent || 5,
      isActive: scheme.isActive !== false,
    });
    setSchemeErrors({});
    setShowSchemeModal(true);
  };

  const openEnroll = (memberId) => {
    setEnrollingMember(memberId);
    setEnrollForm({ schemeId: '', startDate: new Date().toISOString().split('T')[0] });
    setEnrollErrors({});
    setShowEnrollModal(true);
  };

  const closeSchemeModal = () => {
    setShowSchemeModal(false);
    setEditingScheme(null);
    setSchemeForm(initialSchemeForm());
    setSchemeErrors({});
  };

  const closeEnrollModal = () => {
    setShowEnrollModal(false);
    setEnrollingMember(null);
    setEnrollForm(initialEnrollForm());
    setEnrollErrors({});
  };

  const handleSchemeSubmit = async (e) => {
    e.preventDefault();
    setSchemeErrors({});

    if (!schemeForm.savingsType || !schemeForm.name) {
      setSchemeErrors({ submit: tr('error.validation') });
      return;
    }

    setSchemeSubmitting(true);
    try {
      if (editingScheme) {
        await apiPatch(`/schemes/${editingScheme._id}`, schemeForm);
      } else {
        await apiPost('/schemes', schemeForm);
      }
      toast.success(editingScheme ? tr('toast.updated') : tr('toast.created'));
      closeSchemeModal();
      reloadSchemes();
    } catch (requestError) {
      setSchemeErrors({ submit: requestError?.message || tr('error.generic') });
    } finally {
      setSchemeSubmitting(false);
    }
  };

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    setEnrollErrors({});

    if (!enrollForm.schemeId || !enrollForm.startDate) {
      setEnrollErrors({ submit: tr('error.validation') });
      return;
    }

    setEnrollSubmitting(true);
    try {
      await apiPost('/schemes/enroll', {
        memberId: enrollingMember,
        schemeId: enrollForm.schemeId,
        startDate: enrollForm.startDate,
      });
      toast.success(tr('toast.created'));
      closeEnrollModal();
      reloadEnrollments();
    } catch (requestError) {
      setEnrollErrors({ submit: requestError?.message || tr('error.generic') });
    } finally {
      setEnrollSubmitting(false);
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

  if (!isAuthenticated) return null;

  const schemes = schemeData?.items || [];
  const schemeMeta = schemeData?.meta || { total: 0, pages: 1 };
  const enrollments = enrollmentData?.items || [];
  const enrollmentMeta = enrollmentData?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <PageHeader
        title={tr('schemes.title')}
        subtitle={tr('schemes.subtitle')}
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="schemes">{tr('schemes.planTitle')}</Tab>
        <Tab value="enrollments">{tr('schemes.enrollmentTitle')}</Tab>
      </Tabs>

      {activeTab === 'schemes' && (
        <SchemeListView
          schemes={schemes}
          meta={schemeMeta}
          loading={schemeLoading}
          error={schemeError}
          onAdd={openAddScheme}
          onEdit={openEditScheme}
        />
      )}

      {activeTab === 'enrollments' && (
        <EnrollmentListView
          enrollments={enrollments}
          meta={enrollmentMeta}
          loading={enrollmentLoading}
          error={enrollmentError}
          onEnroll={openEnroll}
          page={enrollmentPage}
          setPage={setEnrollmentPage}
        />
      )}

      <SchemeModal
        open={showSchemeModal}
        onClose={closeSchemeModal}
        title={editingScheme ? tr('schemes.editTitle') : tr('schemes.create')}
        form={schemeForm}
        errors={schemeErrors}
        onChange={setSchemeForm}
        submitting={schemeSubmitting}
        onSubmit={handleSchemeSubmit}
      />

      <EnrollModal
        open={showEnrollModal}
        onClose={closeEnrollModal}
        schemeOptions={schemes.filter(s => s.isActive)}
        form={enrollForm}
        errors={enrollErrors}
        onChange={setEnrollForm}
        submitting={enrollSubmitting}
        onSubmit={handleEnrollSubmit}
      />
    </AppShell>
  );
}

function initialSchemeForm() {
  return {
    savingsType: 'monthly',
    name: '',
    nameBn: '',
    description: '',
    lateFeePercent: 5,
    isActive: true,
  };
}

function initialEnrollForm() {
  return {
    schemeId: '',
    startDate: new Date().toISOString().split('T')[0],
  };
}

function SchemeListView({ schemes, meta, loading, error, onAdd, onEdit }) {
  const { tr, formatMoney } = useLang();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />;
  }

  if (schemes.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="target" title={tr('schemes.empty')} description={tr('common.noData')} className="p-12" />
        <div className="border-t border-brand-200 p-4">
          <Button variant="primary" onClick={onAdd}>
            <Icon name="plus" className="h-4 w-4" />
            {tr('schemes.create')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {schemes.map((scheme) => (
        <div key={scheme._id} className="card card-pad">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-brand-900">
                  {lang === 'bn' && scheme.nameBn ? scheme.nameBn : scheme.name}
                </h3>
                <span className={`badge ${scheme.isActive ? 'badge-green' : 'badge-slate'}`}>
                  {tr(`status.${scheme.isActive ? 'active' : 'inactive'}`)}
                </span>
              </div>
              <p className="mt-1 text-sm text-brand-500">{scheme.description || '-'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5 text-brand-700">
                  <Icon name="target" className="h-4 w-4" />
                  {tr(`savings.${scheme.savingsType}`)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-brand-700 font-mono">
                  <Icon name="wallet" className="h-4 w-4" />
                  {formatMoney(scheme.principalPaisa || 0)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-mono">
                  <Icon name="alert" className="h-4 w-4" />
                  {scheme.lateFeePercent}% {tr('savings.lateFee')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => onEdit(scheme)}>
                <Icon name="edit" className="h-4 w-4" />
                {tr('common.edit')}
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Pagination meta={meta} onPage={setSchemePage} />
    </div>
  );
}

function EnrollmentListView({ enrollments, meta, loading, error, onEnroll, page, setPage }) {
  const { tr, formatMoney, formatDate } = useLang();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-8" />;
  }

  if (enrollments.length === 0) {
    return <EmptyState icon="target" title={tr('schemes.noEnrollments')} description={tr('common.noData')} className="p-12" />;
  }

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-200 text-sm">
          <thead className="bg-brand-50/80">
            <tr>
              <th className="th">{tr('schemes.enrollmentNo')}</th>
              <th className="th">{tr('members.name')}</th>
              <th className="th">{tr('schemes.scheme')}</th>
              <th className="th">{tr('schemes.startDate')}</th>
              <th className="th">{tr('schemes.nextDue')}</th>
              <th className="th">{tr('schemes.maturity')}</th>
              <th className="th">{tr('schemes.progress')}</th>
              <th className="th">{tr('schemes.status')}</th>
              <th className="th">{tr('members.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-200">
            {enrollments.map((enrollment) => (
              <tr key={enrollment._id} className={`tr-hover ${enrollment.isOverdue ? 'bg-red-50/30' : ''}`}>
                <td className="td font-mono text-brand-900">{enrollment.enrollmentNo}</td>
                <td className="td font-medium text-brand-900">
                  {lang === 'bn' && enrollment.member?.fullNameBn ? enrollment.member.fullNameBn : enrollment.member?.fullName || '-'}
                  <br />
                  <span className="text-xs text-brand-500 font-mono">{enrollment.member?.code}</span>
                </td>
                <td className="td text-brand-700">{enrollment.scheme?.name || '-'}</td>
                <td className="td text-brand-700">{formatDate(enrollment.startDate)}</td>
                <td className="td text-brand-700">{formatDate(enrollment.nextDueDate)}</td>
                <td className="td text-brand-700">{enrollment.maturityDate ? formatDate(enrollment.maturityDate) : '-'}</td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-brand-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-700 transition-all duration-300"
                        style={{ width: `${enrollment.scheme?.durationInstallments ? (enrollment.paidInstallments / enrollment.scheme.durationInstallments) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-brand-500 w-16 text-right">
                      {enrollment.paidInstallments}/{enrollment.scheme?.durationInstallments || 0}
                    </span>
                  </div>
                </td>
                <td className="td">
                  <StatusBadge status={enrollment.status} />
                  {enrollment.isOverdue && <span className="ml-1 badge badge-red">{tr('status.overdue')}</span>}
                </td>
                <td className="td">
                  <button
                    type="button"
                    className="btn-primary text-xs px-3 py-1.5"
                    onClick={() => onEnroll(enrollment.member?._id)}
                    aria-label={tr('schemes.enroll')}
                  >
                    {tr('schemes.enroll')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination meta={meta} onPage={setPage} />
    </div>
  );
}

function SchemeModal({ open, onClose, title, form, errors, onChange, submitting, onSubmit }) {
  const { tr } = useLang();

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('schemes.details')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={tr('schemes.savingsType')}
              value={form.savingsType}
              onChange={(e) => onChange({ ...form, savingsType: e.target.value })}
              required
              options={[
                { value: 'monthly', label: tr('savings.monthly') },
                { value: 'half_yearly', label: tr('savings.half_yearly') },
                { value: 'one_time', label: tr('savings.one_time') },
              ]}
            />
            <Input
              label={tr('schemes.name')}
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              error={errors.name}
              required
            />
            <Input
              label={tr('schemes.nameBn')}
              value={form.nameBn}
              onChange={(e) => onChange({ ...form, nameBn: e.target.value })}
              error={errors.nameBn}
            />
            <Input
              label={tr('schemes.lateFeePercent')}
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.lateFeePercent}
              onChange={(e) => onChange({ ...form, lateFeePercent: Number(e.target.value) || 5 })}
            />
            <Input
              label={tr('schemes.description')}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              className="sm:col-span-2"
              multiline
              rows={3}
            />
            <label className="sm:col-span-2 inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-brand-200 text-brand-700"
              />
              <span className="text-sm text-brand-700">{tr('schemes.isActive')}</span>
            </label>
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {editingScheme ? tr('common.save') : tr('schemes.create')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

function EnrollModal({ open, onClose, schemeOptions, form, errors, onChange, submitting, onSubmit }) {
  const { tr } = useLang();

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('schemes.enroll')} size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('schemes.enrollDetails')}>
          <div className="grid grid-cols-1 gap-4">
            <Select
              label={tr('schemes.scheme')}
              value={form.schemeId}
              onChange={(e) => onChange({ ...form, schemeId: e.target.value })}
              required
              options={schemeOptions.map(s => ({ value: s._id, label: `${s.name} (${tr(`savings.${s.savingsType}`)})` }))}
              placeholder={tr('schemes.chooseScheme')}
            />
            <Input
              label={tr('schemes.startDate')}
              type="date"
              value={form.startDate}
              onChange={(e) => onChange({ ...form, startDate: e.target.value })}
              required
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {tr('schemes.enroll')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}