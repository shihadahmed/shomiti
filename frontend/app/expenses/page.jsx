'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import { Icon, Button, Input, Select, PageHeader, EmptyState, LoadingSpinner, formatMoney, formatDate, StatusBadge, Pagination, SearchInput, FilterBar, Modal } from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const EXPENSE_STATUSES = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_treasurer', label: 'Pending Treasurer' },
  { value: 'pending_gs', label: 'Pending General Secretary' },
  { value: 'pending_president', label: 'Pending President' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ExpensesPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  const queryParams = {
    page,
    limit: 15,
    search: search || undefined,
    status: statusFilter,
    category: categoryFilter || undefined,
  };

  const { data, loading, error, reload } = useApi('/expenses', queryParams, {
    enabled: isAuthenticated,
  });

  const { data: catData } = useApi('/expenses/categories', {}, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (catData?.items) setCategories(catData.items);
  }, [catData]);

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

  const openAdd = () => {
    setEditingExpense(null);
    setForm(initialForm());
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setForm({
      title: expense.title || '',
      category: expense.category || '',
      amount: expense.amount || '',
      paymentMethod: expense.paymentMethod || 'cash',
      payee: expense.payee || '',
      description: expense.description || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingExpense(null);
    setForm(initialForm());
    setFormErrors({});
  };

  const submitExpense = async (expenseId) => {
    try {
      await useApi().then(({ apiPost }) => apiPost(`/expenses/${expenseId}/submit`, {}));
      toast.success(tr('expenses.submitted'));
      reload();
    } catch (requestError) {
      alert(requestError?.message || tr('error.generic'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    if (!form.title || !form.category || !form.amount) {
      setFormErrors({ submit: tr('error.validation') });
      return;
    }

    const amountPaisa = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountPaisa) || amountPaisa <= 0) {
      setFormErrors({ amount: tr('validation.amount') });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        category: form.category,
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        payee: form.payee,
        description: form.description,
      };

      if (editingExpense) {
        await useApi().then(({ apiPatch }) => apiPatch(`/expenses/${editingExpense._id}`, payload));
      } else {
        await useApi().then(({ apiPost }) => apiPost('/expenses', payload));
      }

      toast.success(editingExpense ? tr('toast.updated') : tr('toast.created'));
      closeModal();
      reload();
    } catch (requestError) {
      setFormErrors({ submit: requestError?.message || tr('error.generic') });
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

  const expenses = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <PageHeader
        title={tr('expenses.title')}
        subtitle={tr('expenses.subtitle')}
        actions={
          <Button variant="primary" onClick={openAdd}>
            <Icon name="plus" className="h-4 w-4" />
            {tr('expenses.create')}
          </Button>
        }
      />

      <form onSubmit={handleSearch} className="mb-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('expenses.searchPlaceholder')}
            className="flex-1 min-w-[280px] max-w-md"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={EXPENSE_STATUSES}
            className="w-[200px]"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={categories.map(c => ({ value: c.category, label: c.category }))}
            className="w-[200px]"
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
        ) : expenses.length === 0 ? (
          <EmptyState icon="calendar" title={tr('expenses.noExpenses')} description={tr('common.noData')} className="p-12" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('expenses.expenseNo')}</th>
                    <th className="th">{tr('expenses.title')}</th>
                    <th className="th">{tr('expenses.category')}</th>
                    <th className="th">{tr('expenses.amount')}</th>
                    <th className="th">{tr('expenses.payee')}</th>
                    <th className="th">{tr('expenses.status')}</th>
                    <th className="th">{tr('expenses.stage')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {expenses.map((expense) => (
                    <tr key={expense._id} className="tr-hover">
                      <td className="td font-mono text-brand-900">{expense.expenseNo}</td>
                      <td className="td font-medium text-brand-900">{expense.title}</td>
                      <td className="td text-brand-700">{expense.category}</td>
                      <td className="td font-mono font-semibold text-brand-900">{formatMoney(expense.amountPaisa || 0)}</td>
                      <td className="td text-brand-700">{expense.payee || '-'}</td>
                      <td className="td"><StatusBadge status={expense.status} /></td>
                      <td className="td">
                        {expense.currentApproverRole && (
                          <span className="badge badge-blue">{tr(`role.${expense.currentApproverRole.toLowerCase()}`)}</span>
                        )}
                        {expense.status === 'approved' && <StatusBadge status="approved" />}
                        {expense.status === 'rejected' && <StatusBadge status="rejected" />}
                        {expense.status === 'draft' && <StatusBadge status="draft" />}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                            onClick={() => openEdit(expense)}
                            aria-label={tr('common.edit')}
                          >
                            <Icon name="edit" className="h-4 w-4" />
                          </button>
                          {expense.status === 'draft' && (
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={() => submitExpense(expense._id)}
                              aria-label={tr('expenses.submit')}
                            >
                              {tr('expenses.submit')}
                            </button>
                          )}
                          {['pending_treasurer', 'pending_gs', 'pending_president'].includes(expense.status) && (
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={() => openEdit(expense)}
                              aria-label={tr('approvals.review')}
                            >
                              {tr('approvals.review')}
                            </button>
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

      <ExpenseModal
        open={showModal}
        onClose={closeModal}
        title={editingExpense ? tr('expenses.editTitle') : tr('expenses.create')}
        form={form}
        errors={formErrors}
        onChange={setForm}
        categories={categories.map(c => c.category)}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}

function initialForm() {
  return {
    title: '',
    category: '',
    amount: '',
    paymentMethod: 'cash',
    payee: '',
    description: '',
  };
}

function ExpenseModal({ open, onClose, title, form, errors, onChange, categories, submitting, onSubmit }) {
  const { tr } = useLang();

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        {errors.submit && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errors.submit}</div>
        )}

        <FormSection title={tr('expenses.details')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={tr('expenses.titleField')}
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              error={errors.title}
              required
            />
            <Select
              label={tr('expenses.category')}
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              error={errors.category}
              required
              options={categories.map(c => ({ value: c, label: c }))}
              placeholder={tr('expenses.selectCategory')}
            />
            <Input
              label={tr('expenses.amount')}
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => onChange({ ...form, amount: e.target.value })}
              error={errors.amount}
              required
            />
            <Select
              label={tr('expenses.paymentMethod')}
              value={form.paymentMethod}
              onChange={(e) => onChange({ ...form, paymentMethod: e.target.value })}
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
              label={tr('expenses.payee')}
              value={form.payee}
              onChange={(e) => onChange({ ...form, payee: e.target.value })}
            />
            <Input
              label={tr('expenses.description')}
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              className="sm:col-span-2"
              multiline
              rows={3}
            />
          </div>
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel={tr('common.saving')}>
            {editingExpense ? tr('common.save') : tr('expenses.create')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}