'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
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
  Pagination,
  SearchInput,
  Modal,
} from '@/components/ui/common';

const TRANSACTION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'deposit', label: 'Deposit (জমা)' },
  { value: 'withdrawal', label: 'Withdrawal (উত্তোলন)' },
  { value: 'adjustment', label: 'Adjustment (সমন্বয়)' },
];

const METHODS = [
  { value: '', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const STATUSES = [
  { value: '', label: 'All Status' },
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

  // Memoize query params to prevent unnecessary re-fetches
  const queryParams = useMemo(() => ({
    page,
    limit: 15,
    search: search.trim() || undefined,
    type: typeFilter || undefined,
    method: methodFilter || undefined,
    status: statusFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
  }), [page, search, typeFilter, methodFilter, statusFilter, fromDate, toDate]);

  const { data, loading, error, reload } = useApi('/savings/transactions', queryParams, {
    enabled: isAuthenticated,
  });

  // Load members dynamically for the creation modal
  const { data: membersData } = useApi('/members', { limit: 100 }, {
    enabled: isAuthenticated && showModal,
  });

  useEffect(() => {
    setMounted(true);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mounted && !checking && !isAuthenticated) {
      router.replace('/login');
    }
  }, [mounted, checking, isAuthenticated, router]);

  const handleSearch = useCallback((e) => {
    e?.preventDefault();
    setPage(1);
    reload();
  }, [reload]);

  const applyUrlSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('');
    setMethodFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || typeFilter || methodFilter || statusFilter || fromDate || toDate);

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
      type: txn.type || 'deposit',
      amount: txn.amountPaisa ? (txn.amountPaisa / 100).toString() : txn.amount || '',
      method: txn.method || 'cash',
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

    if (!form.memberId) {
      setFormErrors({ memberId: 'Member selection is required.' });
      return;
    }

    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormErrors({ amount: 'Enter a valid positive amount.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        memberId: form.memberId,
        accountId: form.accountId || undefined,
        type: form.type,
        amount: amountNum,
        method: form.method,
        providerRef: form.providerRef?.trim() || undefined,
        senderNumber: form.senderNumber?.trim() || undefined,
        bankName: form.bankName?.trim() || undefined,
        note: form.note?.trim() || undefined,
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

      {/* Header Area */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('savings.transactions')}
          subtitle={tr('savings.subtitle') || 'সঞ্চয় হিসাবের সকল লেনদেন ও স্টেটমেন্ট হিস্ট্রি'}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="primary" onClick={openAdd} className="shadow-sm">
            <Icon name="plus" className="h-4 w-4 mr-1.5" />
            {tr('savings.new')}
          </Button>
        </div>
      </div>

      {/* Comprehensive Filter Control Panel */}
      <div className="mb-6 rounded-2xl border border-brand-200/80 bg-white p-4 sm:p-5 shadow-xs">
        <form onSubmit={handleSearch} className="space-y-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 max-w-xl">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('savings.searchPlaceholder') || 'Search by receipt, member code, phone...'}
                className="w-full"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 transition"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 pt-1 border-t border-brand-100">
            <Select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              options={TRANSACTION_TYPES}
              className="text-xs"
            />
            <Select
              value={methodFilter}
              onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
              options={METHODS}
              className="text-xs"
            />
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={STATUSES}
              className="text-xs"
            />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              title="From Date"
              className="text-xs"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              title="To Date"
              className="text-xs"
            />
          </div>
        </form>
      </div>

      {/* Transactions Data Table */}
      <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16">
            <LoadingSpinner size="lg" />
            <p className="mt-3 text-xs font-medium text-brand-500">{tr('common.loading')}</p>
          </div>
        ) : error ? (
          <EmptyState
            icon="alert"
            title={tr('common.error')}
            description={error}
            className="p-12"
          />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('savings.empty')}
            description={tr('common.noData')}
            className="p-16"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">{tr('savings.receipt')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('savings.date')}</th>
                    <th scope="col" className="px-5 py-3.5">{tr('members.name')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('savings.type')}</th>
                    <th scope="col" className="px-5 py-3.5 text-right">{tr('savings.amount')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('savings.method')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('savings.status')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('savings.by')}</th>
                    <th scope="col" className="px-5 py-3.5 text-right">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/80 bg-white">
                  {transactions.map((txn) => {
                    const isCredit = txn.type === 'deposit';
                    const memberName = lang === 'bn' && txn.member?.fullNameBn ? txn.member.fullNameBn : txn.member?.fullName || '-';

                    return (
                      <tr key={txn._id} className="transition-colors hover:bg-brand-50/40">
                        {/* Receipt */}
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className="font-mono text-xs font-semibold text-brand-900 bg-brand-50 px-2 py-1 rounded-md border border-brand-200/50">
                            {txn.receiptNo || '—'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-brand-700">
                          {formatDate(txn.createdAt)}
                        </td>

                        {/* Member Information */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-medium text-brand-900 line-clamp-1">{memberName}</span>
                            <span className="font-mono text-[11px] font-semibold text-brand-500">
                              #{txn.member?.code || 'N/A'}
                            </span>
                          </div>
                        </td>

                        {/* Transaction Type */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                            isCredit
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isCredit ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {tr(`txn.${txn.type}`)}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-sm font-bold">
                          <span className={isCredit ? 'text-emerald-700' : 'text-rose-700'}>
                            {isCredit ? '+' : '-'}{formatMoney(txn.amountPaisa || 0)}
                          </span>
                        </td>

                        {/* Payment Method */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <MethodBadge method={txn.method} />
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <StatusBadge status={txn.status} />
                        </td>

                        {/* Created By */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-brand-600">
                          {txn.createdBy?.name || 'System'}
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {txn.status === 'pending_verification' && txn.payment?._id && (
                              <Link
                                href={`/approvals/slips/${txn.payment._id}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                                title={tr('approvals.verify')}
                              >
                                <Icon name="shield" className="h-4 w-4" />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(txn)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-white text-brand-600 transition hover:bg-brand-50 hover:text-brand-900"
                              title={tr('common.edit')}
                            >
                              <Icon name="pencilLine" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="border-t border-brand-200/70 p-4">
              <Pagination meta={meta} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Transaction Create / Edit Modal */}
      <TransactionModal
        open={showModal}
        onClose={closeModal}
        title={editingTxn ? tr('savings.editTitle') : tr('savings.newTitle')}
        form={form}
        errors={formErrors}
        onChange={setForm}
        submitting={submitting}
        onSubmit={handleSubmit}
        members={membersData?.items || []}
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

function MethodBadge({ method }) {
  const metaMap = {
    bkash: { label: 'bKash', bg: 'bg-pink-50 text-pink-700 border-pink-200' },
    nagad: { label: 'Nagad', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
    rocket: { label: 'Rocket', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
    bank_transfer: { label: 'Bank', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    cash: { label: 'Cash', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  };

  const current = metaMap[method] || { label: method || 'Unknown', bg: 'bg-brand-50 text-brand-700 border-brand-200' };

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${current.bg}`}>
      {current.label}
    </span>
  );
}

function TransactionModal({ open, onClose, title, form, errors, onChange, submitting, onSubmit, members }) {
  const { tr, lang } = useLang();

  if (!open) return null;

  const memberOptions = [
    { value: '', label: tr('savings.selectMember') || 'Select Member' },
    ...members.map((m) => ({
      value: m._id,
      label: `${m.code} - ${lang === 'bn' && m.fullNameBn ? m.fullNameBn : m.fullName}`,
    })),
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {errors.submit}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Member Selection */}
          <div className="sm:col-span-2">
            <Select
              label={tr('savings.member')}
              value={form.memberId}
              onChange={(e) => onChange({ ...form, memberId: e.target.value })}
              error={errors.memberId}
              required
              options={memberOptions}
            />
          </div>

          {/* Type */}
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

          {/* Amount */}
          <Input
            label={tr('savings.amount')}
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => onChange({ ...form, amount: e.target.value })}
            error={errors.amount}
            placeholder="0.00"
            required
          />

          {/* Method */}
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

          {/* Provider / TrxID Reference */}
          <Input
            label={tr('savings.reference') || 'TrxID / Receipt Ref'}
            value={form.providerRef}
            placeholder="e.g. TR998234"
            onChange={(e) => onChange({ ...form, providerRef: e.target.value })}
          />

          {/* Digital Method extra fields */}
          {['bkash', 'nagad', 'rocket'].includes(form.method) && (
            <Input
              label={tr('savings.sender') || 'Sender Mobile Number'}
              value={form.senderNumber}
              placeholder="017XXXXXXXX"
              onChange={(e) => onChange({ ...form, senderNumber: e.target.value })}
            />
          )}

          {form.method === 'bank_transfer' && (
            <Input
              label={tr('savings.bank') || 'Bank & Branch Name'}
              value={form.bankName}
              placeholder="e.g. Sonali Bank, Dhaka Branch"
              onChange={(e) => onChange({ ...form, bankName: e.target.value })}
            />
          )}

          {/* Note */}
          <div className="sm:col-span-2">
            <Input
              label={tr('savings.note')}
              value={form.note}
              placeholder="Optional remarks..."
              onChange={(e) => onChange({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {title}
          </Button>
        </div>
      </form>
    </Modal>
  );
}