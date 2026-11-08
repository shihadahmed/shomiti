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
  StatusBadge,
  Modal,
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function OfflinePaymentPage() {
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ method: 'cash', providerRef: '', senderNumber: '', bankName: '', note: '' });
  const [formErrors, setFormErrors] = useState({});

  const queryParams = { page, limit: 15, search: search.trim() || undefined };

  const { data, loading, error, reload } = useApi('/savings/payments', queryParams, {
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

  const openSubmit = () => {
    setForm({ method: 'cash', providerRef: '', senderNumber: '', bankName: '', note: '' });
    setFormErrors({});
    setShowSubmitModal(true);
  };

  const closeSubmitModal = () => {
    setShowSubmitModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!form.method) {
      setFormErrors({ method: tr('payments.methodRequired') });
      return;
    }
    if (!form.providerRef?.trim()) {
      setFormErrors({ providerRef: tr('payments.referenceRequired') });
      return;
    }

    setSubmitting(true);
    try {
      // Create offline payment slip
      await apiPost('/savings/payments/offline', {
        method: form.method,
        providerRef: form.providerRef,
        bankName: form.bankName || undefined,
        note: form.note || undefined,
      });

      toast.success(tr('payments.slipSubmitted'));
      closeSubmitModal();
      reload();
    } catch (requestError) {
      setFormErrors({ submit: requestError?.message || tr('error.generic') });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || checking) {
    return <AppShell><div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div></AppShell>;
  }
  if (!isAuthenticated) return null;

  const slips = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('payments.offlineTitle')}
          subtitle={tr('payments.offlineSubtitle')}
        />
        <Button variant="primary" onClick={openSubmit} className="shadow-sm">
          <Icon name="plus" className="h-4 w-4 mr-1.5" />
          {tr('payments.submitSlip')}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-medium text-brand-500">{tr('common.loading')}</p>
        </div>
      ) : error ? (
        <EmptyState icon="alert" title={tr('common.error')} description={error} className="p-12" />
      ) : slips.length === 0 ? (
        <EmptyState icon="upload" title={tr('payments.noSlips')} description={tr('payments.noSlipsDesc')} className="p-16" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th className="px-5 py-3">{tr('payments.slipNo')}</th>
                    <th className="px-4 py-3">{tr('payments.due')}</th>
                    <th className="px-4 py-3">{tr('payments.method')}</th>
                    <th className="px-5 py-3 text-right">{tr('payments.amount')}</th>
                    <th className="px-4 py-3">{tr('payments.reference')}</th>
                    <th className="px-4 py-3">{tr('payments.status')}</th>
                    <th className="px-4 py-3">{tr('payments.submittedAt')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/80 bg-white">
                  {slips.map((slip) => (
                    <tr key={slip._id} className="transition-colors hover:bg-brand-50/40">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-brand-900 bg-brand-50 px-2 py-1 rounded-md border border-brand-200/50">
                        {slip.paymentNo || slip.slipNo || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-700">
                        {slip.savingsDue ? `${slip.savingsDue.dueNo} (${slip.savingsDue.period})` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                          slip.method === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {tr(`method.${slip.method}`)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-sm">{formatMoney(slip.amountPaisa)}</td>
                      <td className="px-4 py-3 text-xs text-brand-600 font-mono">{slip.providerRef || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={slip.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-700">{formatDate(slip.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Modal isOpen={showSubmitModal} onClose={closeSubmitModal} title={tr('payments.submitSlip')} size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formErrors.submit && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {formErrors.submit}
                </div>
              )}

              <FormSection title={tr('payments.slipDetails')}>
                <div className="space-y-3">
                  <label className="label">{tr('payments.method')}</label>
                  <Select
                    value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}
                    error={formErrors.method}
                    required
                    options={METHODS}
                  />

                  <label className="label">{tr('payments.reference')}</label>
                  <Input
                    value={form.providerRef}
                    placeholder="e.g. Deposit slip number, bank reference"
                    onChange={(e) => setForm({ ...form, providerRef: e.target.value })}
                    error={formErrors.providerRef}
                    required
                  />

                  {form.method === 'bank_transfer' && (
                    <div>
                      <label className="label">{tr('payments.bank')}</label>
                      <Input
                        value={form.bankName}
                        placeholder="e.g. Sonali Bank, Dhaka Branch"
                        onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                      />
                    </div>
                  )}

                  <label className="label">{tr('payments.note')}</label>
                  <Input
                    value={form.note}
                    placeholder="Optional remarks..."
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    as="textarea"
                    rows={3}
                  />
                </div>
              </FormSection>

              <FormActions>
                <Button type="button" variant="secondary" onClick={closeSubmitModal}>
                  {tr('common.cancel')}
                </Button>
                <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.submitting')}>
                  {tr('payments.submitSlip')}
                </Button>
              </FormActions>
            </form>
          </Modal>
        </>
      )}
    </AppShell>
  );
}