'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { toast } from 'react-toastify';
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

export default function MyDuesPage() {
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

  const { data, loading, error, reload } = useApi('/savings/my/dues', queryParams, {
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

    const required = payingDue.totalDuePaisa;
    const paid = Number(payForm.amount);
    if (!Number.isFinite(paid) || paid <= 0) {
      setPayErrors({ amount: tr('savings.amountRequired') });
      return;
    }
    if (paid !== required) {
      setPayErrors({ amount: tr('savings.fullPaymentRequired', { amount: formatMoney(required) }) });
      return;
    }
    if (!payForm.method) {
      setPayErrors({ method: tr('savings.methodRequired') });
      return;
    }

    setPaySubmitting(true);
    try {
      const idempotencyKey = `pay-${payingDue._id}-${Date.now()}`;
      await apiPost(`/savings/dues/${payingDue._id}/pay`, {
        method: payForm.method,
        amount: paid / 100,
        providerRef: payForm.providerRef || undefined,
        senderNumber: payForm.senderNumber || undefined,
        bankName: payForm.bankName || undefined,
        note: payForm.note || undefined,
      }, { headers: { 'idempotency-key': idempotencyKey } });

      toast.success(tr('savings.paymentSubmitted'));
      closePayModal();
      reload();
    } catch (requestError) {
      const message = requestError?.details?.requiredAmount
        ? tr('savings.fullPaymentRequired', { amount: formatMoney(requestError.details.requiredAmount) })
        : requestError?.message || tr('error.generic');
      setPayErrors({ amount: message });
    } finally {
      setPaySubmitting(false);
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

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('savings.myDuesTitle')}
          subtitle={tr('savings.myDuesSubtitle')}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('savings.searchPlaceholder')}
                className="w-full"
              />
            </div>
          </div>

          <FilterBar
            filters={[
              { key: 'savingsType', label: tr('savings.type'), options: SAVINGS_TYPES, value: typeFilter, onChange: (v) => { setTypeFilter(v); setPage(1); } },
              { key: 'status', label: tr('savings.status'), options: DUE_STATUSES, value: statusFilter, onChange: (v) => { setStatusFilter(v); setPage(1); } },
              { key: 'period', label: tr('savings.period'), placeholder: 'YYYY-MM', value: periodFilter, onChange: (v) => { setPeriodFilter(v); setPage(1); } },
            ]}
          />
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-medium text-brand-500">{tr('common.loading')}</p>
        </div>
      ) : error ? (
        <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-12" />
      ) : dues.length === 0 ? (
        <EmptyState icon="target" title={tr('savings.dueEmpty')} description={tr('common.noData')} className="p-12" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th className="px-5 py-3">{tr('savings.dueNo')}</th>
                    <th className="px-4 py-3">{tr('savings.period')}</th>
                    <th className="px-4 py-3">{tr('savings.type')}</th>
                    <th className="px-5 py-3 text-right">{tr('savings.principal')}</th>
                    <th className="px-5 py-3 text-right">{tr('savings.lateFee')}</th>
                    <th className="px-5 py-3 text-right">{tr('savings.totalDue')}</th>
                    <th className="px-4 py-3">{tr('savings.dueDate')}</th>
                    <th className="px-4 py-3">{tr('savings.status')}</th>
                    <th className="px-5 py-3 text-right">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/80 bg-white">
                  {dues.map((due) => (
                    <tr key={due._id} className="transition-colors hover:bg-brand-50/40">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-brand-900 bg-brand-50 px-2 py-1 rounded-md border border-brand-200/50">
                        {due.dueNo || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-brand-700">{due.period}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          due.savingsType === 'monthly' ? 'bg-blue-50 text-blue-700' :
                          due.savingsType === 'half_yearly' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {tr(`savings.${due.savingsType}`)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-sm">{formatMoney(due.principalPaisa)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-sm text-rose-600">{formatMoney(due.lateFeePaisa)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-sm font-bold text-brand-900">{formatMoney(due.totalDuePaisa)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-brand-700">{formatDate(due.dueDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={due.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
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
                              href="/approvals"
                              className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                              aria-label={tr('approvals.verify')}
                              title={tr('approvals.verify')}
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
          </div>

          <Modal isOpen={showPayModal} onClose={closePayModal} title={tr('savings.payTitle')} size="md">
            <form onSubmit={handlePay} className="space-y-4">
              {payErrors.submit && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {payErrors.submit}
                </div>
              )}

              <p className="text-sm text-brand-600">
                {tr('savings.payDueDetails', { dueNo: payingDue?.dueNo, amount: payingDue ? formatMoney(payingDue.totalDuePaisa) : '' })}
              </p>

              <FormSection title={tr('savings.paymentDetails')}>
                <div className="space-y-3">
                  <Select
                    label={tr('savings.method')}
                    value={payForm.method}
                    onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                    error={payErrors.method}
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
                    label={tr('savings.amount')}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payingDue ? (payingDue.totalDuePaisa / 100).toFixed(2) : ''}
                    onChange={(e) => setPayForm({ ...payForm, amount: Math.round(Number(e.target.value) * 100) })}
                    error={payErrors.amount}
                    placeholder="0.00"
                    required
                    readOnly
                  />

                  <Input
                    label={tr('savings.reference')}
                    value={payForm.providerRef}
                    placeholder="e.g. TR998234"
                    onChange={(e) => setPayForm({ ...payForm, providerRef: e.target.value })}
                  />

                  {['bkash', 'nagad', 'rocket'].includes(payForm.method) && (
                    <Input
                      label={tr('savings.sender')}
                      value={payForm.senderNumber}
                      placeholder="017XXXXXXXX"
                      onChange={(e) => setPayForm({ ...payForm, senderNumber: e.target.value })}
                    />
                  )}

                  {payForm.method === 'bank_transfer' && (
                    <Input
                      label={tr('savings.bank')}
                      value={payForm.bankName}
                      placeholder="e.g. Sonali Bank, Dhaka Branch"
                      onChange={(e) => setPayForm({ ...payForm, bankName: e.target.value })}
                    />
                  )}

                  <Input
                    label={tr('savings.note')}
                    value={payForm.note}
                    placeholder="Optional remarks..."
                    onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                  />
                </div>
              </FormSection>

              <FormActions>
                <Button type="button" variant="secondary" onClick={closePayModal}>
                  {tr('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" loading={paySubmitting} loadingLabel={tr('common.submitting')}>
                  {tr('savings.pay')}
                </Button>
              </FormActions>
            </form>
          </Modal>
        </>
      )}
    </AppShell>
  );
}