'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { toast } from 'react-toastify';
import {
  Icon,
  Button,
  Input,
  Select,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  formatMoney,
  formatDate,
  StatCard,
  Modal,
} from '@/components/ui/common';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function PaymentsPage() {
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingDue, setPayingDue] = useState(null);
  const [payForm, setPayForm] = useState({ method: 'cash', providerRef: '', senderNumber: '', bankName: '', note: '' });
  const [payErrors, setPayErrors] = useState({});
  const [paySubmitting, setPaySubmitting] = useState(false);

  const queryParams = { page, limit: 15, search: search.trim() || undefined, status: 'due,overdue' };

  const { data, loading, error, reload } = useApi('/savings/my/dues', queryParams, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) window.location.href = '/login';
  }, [mounted, checking, isAuthenticated]);

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
      setPayErrors({ amount: tr('payments.amountRequired') });
      return;
    }
    if (paid !== required) {
      setPayErrors({ amount: tr('payments.fullPaymentRequired', { amount: formatMoney(required) }) });
      return;
    }
    if (!payForm.method) {
      setPayErrors({ method: tr('payments.methodRequired') });
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

      toast.success(tr('payments.paymentSubmitted'));
      closePayModal();
      reload();
    } catch (requestError) {
      const message = requestError?.details?.requiredAmount
        ? tr('payments.fullPaymentRequired', { amount: formatMoney(requestError.details.requiredAmount) })
        : requestError?.message || tr('error.generic');
      setPayErrors({ amount: message });
    } finally {
      setPaySubmitting(false);
    }
  };

  if (!mounted || checking) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }
  if (!isAuthenticated) return null;

  const dues = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };
  const totalDue = dues.reduce((sum, d) => sum + (d.totalDuePaisa || 0), 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('payments.title')}
          subtitle={tr('payments.subtitle')}
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={tr('payments.pendingDues')}
          value={dues.length.toString()}
          icon="target"
          tone="amber"
        />
        <StatCard
          label={tr('payments.totalAmountDue')}
          value={formatMoney(totalDue)}
          icon="wallet"
          tone="rose"
        />
        <StatCard
          label={tr('payments.overdueCount')}
          value={dues.filter(d => d.status === 'overdue').length.toString()}
          icon="alert"
          tone="rose"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-medium text-brand-500">{tr('common.loading')}</p>
        </div>
      ) : error ? (
        <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-12" />
      ) : dues.length === 0 ? (
        <EmptyState icon="target" title={tr('payments.noDues')} description={tr('payments.noDuesDesc')} className="p-16" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th className="px-5 py-3">{tr('payments.dueNo')}</th>
                    <th className="px-4 py-3">{tr('payments.period')}</th>
                    <th className="px-4 py-3">{tr('payments.type')}</th>
                    <th className="px-5 py-3 text-right">{tr('payments.principal')}</th>
                    <th className="px-5 py-3 text-right">{tr('payments.lateFee')}</th>
                    <th className="px-5 py-3 text-right">{tr('payments.totalDue')}</th>
                    <th className="px-4 py-3">{tr('payments.dueDate')}</th>
                    <th className="px-4 py-3">{tr('payments.status')}</th>
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
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          due.status === 'due' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {tr(`savings.${due.status}`)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <button
                          type="button"
                          className="btn-primary text-xs px-3 py-1.5"
                          onClick={() => openPay(due)}
                          aria-label={tr('payments.pay')}
                        >
                          {tr('payments.pay')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Modal isOpen={showPayModal} onClose={closePayModal} title={tr('payments.payTitle')} size="md">
            <form onSubmit={handlePay} className="space-y-4">
              {payErrors.submit && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {payErrors.submit}
                </div>
              )}

              <p className="text-sm text-brand-600">
                {tr('payments.payDueDetails', { dueNo: payingDue?.dueNo, amount: payingDue ? formatMoney(payingDue.totalDuePaisa) : '' })}
              </p>

              <div className="space-y-3">
                <label className="label">{tr('payments.method')}</label>
                <Select
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                  error={payErrors.method}
                  required
                  options={METHODS}
                />

                <label className="label">{tr('payments.amount')}</label>
                <Input
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

                <label className="label">{tr('payments.reference')}</label>
                <Input
                  value={payForm.providerRef}
                  placeholder="e.g. TR998234"
                  onChange={(e) => setPayForm({ ...payForm, providerRef: e.target.value })}
                />

                {['bkash', 'nagad', 'rocket'].includes(payForm.method) && (
                  <div>
                    <label className="label">{tr('payments.sender')}</label>
                    <Input
                      value={payForm.senderNumber}
                      placeholder="017XXXXXXXX"
                      onChange={(e) => setPayForm({ ...payForm, senderNumber: e.target.value })}
                    />
                  </div>
                )}

                {payForm.method === 'bank_transfer' && (
                  <div>
                    <label className="label">{tr('payments.bank')}</label>
                    <Input
                      value={payForm.bankName}
                      placeholder="e.g. Sonali Bank, Dhaka Branch"
                      onChange={(e) => setPayForm({ ...payForm, bankName: e.target.value })}
                    />
                  </div>
                )}

                <label className="label">{tr('payments.note')}</label>
                <Input
                  value={payForm.note}
                  placeholder="Optional remarks..."
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-100">
                <Button type="button" variant="secondary" onClick={closePayModal}>
                  {tr('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" loading={paySubmitting} loadingLabel={tr('common.submitting')}>
                  {tr('payments.pay')}
                </Button>
              </div>
            </form>
          </Modal>
        </>
      )}
    </AppShell>
  );
}