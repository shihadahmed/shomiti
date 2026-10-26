'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatMoney, formatDate, StatusBadge, Pagination, SearchInput, FilterBar, Modal } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const SAVINGS_TYPES = [
  { value: '', label: 'All' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'one_time', label: 'One-Time' },
];

const DUE_STATUSES = [
  { value: '', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function DuesPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingDue, setPayingDue] = useState(null);
  const [payForm, setPayForm] = useState({ method: 'cash', providerRef: '', senderNumber: '', bankName: '', note: '' });
  const [payErrors, setPayErrors] = useState({});
  const [paySubmitting, setPaySubmitting] = useState(false);

  const queryParams = {
    page,
    limit: 15,
    search: search || undefined,
    savingsType: typeFilter,
    status: statusFilter,
    period: periodFilter || undefined,
  };

  const { data, loading, error, reload } = useApi('/savings/dues', queryParams, {
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

  const openPay = (due) => {
    setPayingDue(due);
    setPayForm({ method: 'cash', providerRef: '', senderNumber: '', bankName: '', note: '' });
    setPayErrors({});
    setShowPayModal(true);
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPayingDue(null);
    setPayForm({ method: 'cash', providerRef: '', senderNumber: '', bankName: '', note: '' });
    setPayErrors({});
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setPayErrors({});

    if (!payingDue) return;

    const required = payingDue.totalDue;
    setPayErrors({ amount: tr('savings.fullPaymentRequired', { amount: formatMoney(required) }) });

    setPaySubmitting(true);
    try {
      const idempotencyKey = `pay-${payingDue._id}-${Date.now()}`;
      await apiPost(
        `/savings/dues/${payingDue._id}/pay`,
        {
          amount: required,
          method: payForm.method,
          providerRef: payForm.providerRef,
          senderNumber: payForm.senderNumber,
          bankName: payForm.bankName,
          note: payForm.note,
        },
        { headers: { 'idempotency-key': idempotencyKey } }
      );
      toast.success(tr('toast.created'));
      closePayModal();
      reload();
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      if (requestError?.details?.requiredAmount) {
        setPayErrors({ amount: tr('savings.fullPaymentRequired', { amount: formatMoney(requestError.details.requiredAmount) }) });
      } else {
        setPayErrors({ submit: message });
      }
    } finally {
      setPaySubmitting(false);
    }
  };

  const generateDues = async () => {
    const type = window.prompt(tr('savings.generateDuesPromptType'));
    if (!type) return;
    const period = window.prompt(tr('savings.generateDuesPromptPeriod'));
    if (!period) return;

    try {
      await apiPost('/savings/dues/generate', { savingsType: type, period });
      toast.success(tr('toast.created'));
      reload();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
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

  const dues = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  const totals = dues.reduce(
    (acc, due) => {
      if (due.status === 'due' || due.status === 'overdue') {
        acc.due += due.totalDue || 0;
        if (due.status === 'overdue') acc.overdue += due.totalDue || 0;
      }
      return acc;
    },
    { due: 0, overdue: 0 }
  );

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />
      <PageHeader
        title={tr('savings.dueTitle')}
        subtitle={tr('savings.dueSubtitle')}
        actions={
          <>
            <Button variant="secondary" onClick={generateDues}>
              <Icon name="refresh" className="h-4 w-4" />
              {tr('savings.generateDues')}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={tr('savings.totalDue')} value={formatMoney(totals.due)} icon="target" tone="rose" />
        <StatCard label={tr('savings.totalOverdue')} value={formatMoney(totals.overdue)} icon="alert" tone="rose" />
        <StatCard label={tr('savings.pendingDues')} value={dues.filter(d => d.status === 'due' || d.status === 'overdue').length.toString()} icon="target" tone="amber" />
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('savings.searchPlaceholder')}
            className="flex-1 min-w-[280px] max-w-md"
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={SAVINGS_TYPES}
            className="w-[160px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={DUE_STATUSES}
            className="w-[160px]"
          />
          <Input
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            placeholder={tr('savings.period')}
            className="w-[140px]"
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
        ) : dues.length === 0 ? (
          <EmptyState icon="target" title={tr('savings.dueEmpty')} description={tr('common.noData')} className="p-12" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('savings.dueNo')}</th>
                    <th className="th">{tr('savings.period')}</th>
                    <th className="th">{tr('members.name')}</th>
                    <th className="th">{tr('savings.type')}</th>
                    <th className="th">{tr('savings.principal')}</th>
                    <th className="th">{tr('savings.lateFee')}</th>
                    <th className="th">{tr('savings.totalDue')}</th>
                    <th className="th">{tr('savings.dueDate')}</th>
                    <th className="th">{tr('savings.status')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {dues.map((due) => (
                    <tr key={due._id} className={`tr-hover ${due.status === 'overdue' ? 'bg-red-50/30' : ''}`}>
                      <td className="td font-mono text-brand-900">{due.dueNo}</td>
                      <td className="td text-brand-700">{due.period}</td>
                      <td className="td font-medium text-brand-900">
                        {lang === 'bn' && due.member?.fullNameBn ? due.member.fullNameBn : due.member?.fullName || '-'}
                        <br />
                        <span className="text-xs text-brand-500 font-mono">{due.member?.code}</span>
                      </td>
                      <td className="td capitalize">{tr(`savings.${due.savingsType}`)}</td>
                      <td className="td font-mono text-brand-900">{formatMoney(due.principalPaisa || 0)}</td>
                      <td className="td font-mono text-amber-700">{formatMoney(due.lateFeePaisa || 0)}</td>
                      <td className="td font-mono font-semibold text-brand-900">{formatMoney(due.totalDuePaisa || 0)}</td>
                      <td className="td text-brand-700">{formatDate(due.dueDate)}</td>
                      <td className="td"><StatusBadge status={due.status} /></td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          {(due.status === 'due' || due.status === 'overdue') && (
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={() => openPay(due)}
                              aria-label={tr('savings.pay')}
                            >
                              {tr('savings.pay')}
                            </button>
                          )}
                          {due.payment && (
                            <Link
                              href={`/approvals/slips/${due.payment._id}`}
                              className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                              aria-label={tr('approvals.verify')}
                            >
                              <Icon name="shield" className="h-4 w-4" />
                            </Link>
                          )}
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

      <PayModal
        open={showPayModal}
        onClose={closePayModal}
        due={payingDue}
        form={payForm}
        errors={payErrors}
        onChange={setPayForm}
        submitting={paySubmitting}
        onSubmit={handlePay}
      />
    </AppShell>
  );
}

function StatCard({ label, value, icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-700',
    gold: 'bg-brand-100 text-brand-900',
    sky: 'bg-sky-50 text-sky-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-brand-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.brand}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function PayModal({ open, onClose, due, form, errors, onChange, submitting, onSubmit }) {
  const { tr } = useLang();
  const { formatMoney } = require('@/lib/i18n');

  if (!open || !due) return null;

  const required = due.totalDue || 0;

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('savings.verifyTitle')} size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-brand-500">{tr('savings.dueNo')}</p>
              <p className="font-mono font-semibold text-brand-900">{due.dueNo}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('savings.period')}</p>
              <p className="font-semibold text-brand-900">{due.period}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('members.name')}</p>
              <p className="font-semibold text-brand-900">{due.member?.fullName || '-'}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('savings.type')}</p>
              <p className="font-semibold text-brand-900 capitalize">{tr(`savings.${due.savingsType}`)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('savings.principal')}</p>
              <p className="font-mono font-semibold text-brand-900">{formatMoney(due.principalPaisa || 0)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('savings.lateFee')}</p>
              <p className="font-mono font-semibold text-amber-700">{formatMoney(due.lateFeePaisa || 0)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('savings.totalDue')}</p>
              <p className="font-mono text-2xl font-bold text-brand-900">{formatMoney(required)}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200">
          {tr('savings.fullPaymentRequired')} {tr('savings.partialNotAllowed')}
        </p>

        <FormSection title={tr('savings.paymentDetails')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={tr('savings.method')}
              value={form.method}
              onChange={(e) => onChange({ ...form, method: e.target.value })}
              required
              options={[
                { value: 'cash', label: tr('method.cash') },
                { value: 'bkash', label: tr('method.bkash') },
                { value: 'nagad', label: tr('method.nagad') },
                { value: 'rocket', label: tr('method.rocket') },
                { value: 'bank_transfer', label: tr('method.bank_transfer') },
              ]}
            />
            <Input
              label={tr('savings.reference')}
              value={form.providerRef}
              onChange={(e) => onChange({ ...form, providerRef: e.target.value })}
            />
            <Input
              label={tr('savings.sender')}
              value={form.senderNumber}
              onChange={(e) => onChange({ ...form, senderNumber: e.target.value })}
            />
            <Input
              label={tr('savings.bank')}
              value={form.bankName}
              onChange={(e) => onChange({ ...form, bankName: e.target.value })}
            />
            <Input
              label={tr('savings.note')}
              value={form.note}
              onChange={(e) => onChange({ ...form, note: e.target.value })}
              className="sm:col-span-2"
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={paySubmitting} loadingLabel={tr('common.saving')}>
            {tr('savings.pay')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}