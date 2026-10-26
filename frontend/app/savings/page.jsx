'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatMoney, formatDate, StatusBadge, Pagination, SearchInput, FilterBar, Modal } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const TRANSACTION_TYPES = [
  { value: '', label: 'All' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'adjustment', label: 'Adjustment' },
];

const METHODS = [
  { value: '', label: 'All' },
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'posted', label: 'Posted' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'pending_verification', label: 'Pending Verification' },
];

export default function SavingsPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const queryParams = {
    page,
    limit: 15,
    search: search || undefined,
    type: typeFilter,
    method: methodFilter,
    status: statusFilter,
    from: fromDate,
    to: toDate,
  };

  const { data, loading, error, reload } = useApi('/savings/transactions', queryParams, {
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

  const openAdd = () => {
    setEditingTxn(null);
    setForm(initialForm());
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (txn) => {
    setEditingTxn(txn);
    setForm({
      memberId: txn.member?._id || '',
      accountId: txn.account?._id || '',
      type: txn.type,
      amount: txn.amount || '',
      method: txn.method,
      providerRef: txn.providerRef || '',
      senderNumber: txn.senderNumber || '',
      bankName: txn.bankName || '',
      note: txn.note || '',
      savingsDueId: txn.savingsDue?._id || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTxn(null);
    setForm(initialForm());
    setFormErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!form.memberId || !form.accountId) {
      setFormErrors({ submit: 'Member and account are required.' });
      return;
    }

    const amountPaisa = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) {
      setFormErrors({ amount: 'Enter a valid positive amount.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        memberId: form.memberId,
        accountId: form.accountId,
        type: form.type,
        amount: form.amount,
        method: form.method,
        providerRef: form.providerRef,
        senderNumber: form.senderNumber,
        bankName: form.bankName,
        note: form.note,
        savingsDueId: form.savingsDueId || undefined,
      };

      if (editingTxn) {
        await apiPatch(`/savings/transactions/${editingTxn._id}`, payload);
      } else {
        await apiPost('/savings/transactions', payload);
      }

      toast.success(editingTxn ? tr('toast.updated') : tr('toast.created'));
      closeModal();
      reload();
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      setFormErrors({ submit: message });
    } finally {
      setSubmitting(false);
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

  const transactions = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />
      <PageHeader
        title={tr('savings.transactions')}
        subtitle={tr('savings.subtitle')}
        actions={
          <Button variant="primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" />
            {tr('savings.new')}
          </Button>
        }
      />

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
            options={TRANSACTION_TYPES}
            className="w-[160px]"
          />
          <Select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            options={METHODS}
            className="w-[160px]"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUSES}
            className="w-[180px]"
          />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder={tr('savings.from')}
            className="w-[160px]"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder={tr('savings.to')}
            className="w-[160px]"
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
        ) : transactions.length === 0 ? (
          <EmptyState icon="file" title={tr('savings.empty')} description={tr('common.noData')} className="p-12" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('savings.receipt')}</th>
                    <th className="th">{tr('savings.date')}</th>
                    <th className="th">{tr('members.name')}</th>
                    <th className="th">{tr('savings.type')}</th>
                    <th className="th">{tr('savings.amount')}</th>
                    <th className="th">{tr('savings.method')}</th>
                    <th className="th">{tr('savings.status')}</th>
                    <th className="th">{tr('savings.by')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {transactions.map((txn) => (
                    <tr key={txn._id} className="tr-hover">
                      <td className="td font-mono text-brand-900">{txn.receiptNo || '-'}</td>
                      <td className="td text-brand-700">{formatDate(txn.createdAt)}</td>
                      <td className="td font-medium text-brand-900">
                        {lang === 'bn' && txn.member?.fullNameBn ? txn.member.fullNameBn : txn.member?.fullName || '-'}
                        <br />
                        <span className="text-xs text-brand-500 font-mono">{txn.member?.code}</span>
                      </td>
                      <td className="td capitalize">{tr(`txn.${txn.type}`)}</td>
                      <td className="td font-mono font-semibold text-brand-900">{formatMoney(txn.amountPaisa || 0)}</td>
                      <td className="td capitalize">{tr(`method.${txn.method}`)}</td>
                      <td className="td"><StatusBadge status={txn.status} /></td>
                      <td className="td text-brand-700">{txn.createdBy?.name || '-'}</td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          {txn.status === 'pending_verification' && (
                            <Link
                              href={`/approvals/slips/${txn.payment?._id}`}
                              className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                              aria-label={tr('approvals.verify')}
                            >
                              <Icon name="shield" className="h-4 w-4" />
                            </Link>
                          )}
                          <button
                            type="button"
                            className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                            onClick={() => openEdit(txn)}
                            aria-label={tr('common.edit')}
                          >
                            <Icon name="edit" className="h-4 w-4" />
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

      <TransactionModal
        open={showModal}
        onClose={closeModal}
        title={editingTxn ? tr('savings.editTitle') : tr('savings.newTitle')}
        form={form}
        errors={formErrors}
        onChange={setForm}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}

function initialForm() {
  return {
    memberId: '',
    accountId: '',
    type: 'deposit',
    amount: '',
    method: 'cash',
    providerRef: '',
    senderNumber: '',
    bankName: '',
    note: '',
    savingsDueId: '',
  };
}

function TransactionModal({ open, onClose, title, form, errors, onChange, submitting, onSubmit }) {
  const { tr } = useLang();

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('savings.transactionDetails')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={tr('savings.member')}
              value={form.memberId}
              onChange={(e) => onChange({ ...form, memberId: e.target.value })}
              error={errors.memberId}
              required
              options={[]}
              placeholder={tr('savings.selectMember')}
            />
            <Select
              label={tr('savings.account')}
              value={form.accountId}
              onChange={(e) => onChange({ ...form, accountId: e.target.value })}
              error={errors.accountId}
              required
              options={[]}
              placeholder={tr('savings.selectAccount')}
            />
            <Select
              label={tr('savings.type')}
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value })}
              required
              options={[
                { value: 'deposit', label: tr('txn.deposit') },
                { value: 'withdrawal', label: tr('txn.withdrawal') },
                { value: 'adjustment', label: tr('txn.adjustment') },
              ]}
            />
            <Input
              label={tr('savings.amount')}
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => onChange({ ...form, amount: e.target.value })}
              error={errors.amount}
              required
            />
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
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {editingTxn ? tr('common.save') : tr('savings.submit')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}