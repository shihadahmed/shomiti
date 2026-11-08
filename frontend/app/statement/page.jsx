'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, Card, Badge, Icon, Input, Button, EmptyState, Pagination, Alert, formatMoney } from '@/components/ui/common';

export default function StatementPage() {
  const { tr } = useLang();
  const user = useAuthStore((state) => state.user);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filter, setFilter] = useState({ 
    from: '', 
    to: '', 
    type: 'all',
    account: 'all',
  });
  const [summary, setSummary] = useState({ totalCredit: 0, totalDebit: 0, balance: 0 });
  const [accounts, setAccounts] = useState([]);

  const fetchStatement = async () => {
    if (!user?.memberId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        memberId: user.memberId,
      });
      
      if (filter.from) params.append('from', filter.from);
      if (filter.to) params.append('to', filter.to);
      if (filter.type !== 'all') params.append('type', filter.type);
      if (filter.account !== 'all') params.append('account', filter.account);

      const res = await fetch(`/api/savings/statement?${params.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setTransactions(data.data.items);
        setPagination(prev => ({ ...prev, ...data.data.meta }));
        setSummary(data.data.summary || { totalCredit: 0, totalDebit: 0, balance: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch statement:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    if (!user?.memberId) return;
    
    try {
      const res = await fetch(`/api/savings/accounts?memberId=${user.memberId}`);
      const data = await res.json();
      if (data.success) {
        setAccounts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  useEffect(() => {
    fetchStatement();
    fetchAccounts();
  }, [pagination.page, filter.from, filter.to, filter.type, filter.account, user?.memberId]);

  const handleExport = async (format = 'pdf') => {
    if (!user?.memberId) return;
    
    try {
      const params = new URLSearchParams({
        memberId: user.memberId,
        format,
      });
      
      if (filter.from) params.append('from', filter.from);
      if (filter.to) params.append('to', filter.to);
      if (filter.type !== 'all') params.append('type', filter.type);
      if (filter.account !== 'all') params.append('account', filter.account);

      const res = await fetch(`/api/savings/statement/export?${params.toString()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${filter.from || 'all'}-to-${filter.to || 'now'}.${format === 'pdf' ? 'pdf' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert(tr('toast.fileUploadFailed') || 'Export failed');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getTypeBadge = (type) => {
    const badges = {
      deposit: { variant: 'success', label: tr('txn.deposit') || 'Deposit' },
      withdrawal: { variant: 'danger', label: tr('txn.withdrawal') || 'Withdrawal' },
      adjustment: { variant: 'info', label: tr('txn.adjustment') || 'Adjustment' },
      interest: { variant: 'warning', label: tr('txn.interest') || 'Interest' },
      fee: { variant: 'default', label: tr('txn.fee') || 'Fee' },
    };
    return badges[type] || { variant: 'default', label: type };
  };

  const getStatusBadge = (status) => {
    const badges = {
      posted: { variant: 'success', label: 'Posted' },
      pending_approval: { variant: 'warning', label: 'Pending Approval' },
      rejected: { variant: 'danger', label: 'Rejected' },
      cancelled: { variant: 'default', label: 'Cancelled' },
    };
    return badges[status] || { variant: 'default', label: status };
  };

  if (!user?.memberId) {
    return (
      <AppShell>
        <PageHeader title={tr('statement.title')} subtitle={tr('statement.credit')} />
        <Alert variant="warning">
          <Icon name="alertTriangle" className="h-5 w-5" />
          <div>
            <p className="font-medium">{tr('profile.noMember') || 'No member profile linked'}</p>
            <p className="text-sm mt-1">{tr('profile.noMemberDesc') || 'Please contact the administrator to link your account to a member profile.'}</p>
          </div>
        </Alert>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader 
        title={tr('statement.title') || 'Transaction Statement'}
        subtitle={`${tr('statement.credit') || 'Credit'} / ${tr('statement.debit') || 'Debit'}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')} icon="download">
              {tr('statement.downloadCsv') || 'Download CSV'}
            </Button>
            <Button onClick={() => handleExport('pdf')} icon="file">
              {tr('statement.downloadPdf') || 'Download PDF'}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 border-l-4 border-green-500">
          <p className="text-sm text-brand-500">{tr('statement.credit') || 'Total Credit'}</p>
          <p className="text-2xl font-bold text-green-600">{formatMoney(summary.totalCredit || 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <p className="text-sm text-brand-500">{tr('statement.debit') || 'Total Debit'}</p>
          <p className="text-2xl font-bold text-red-600">{formatMoney(summary.totalDebit || 0)}</p>
        </Card>
        <Card className="p-4 border-l-4 border-brand-500">
          <p className="text-sm text-brand-500">{tr('savings.balanceAfter') || 'Net Balance'}</p>
          <p className="text-2xl font-bold text-brand-900">{formatMoney(summary.balance || 0)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="label">{tr('statement.dateFrom') || 'From Date'}</label>
            <Input
              type="date"
              value={filter.from}
              onChange={(e) => { setFilter({...filter, from: e.target.value}); setPagination(p => ({...p, page: 1})); }}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('statement.dateTo') || 'To Date'}</label>
            <Input
              type="date"
              value={filter.to}
              onChange={(e) => { setFilter({...filter, to: e.target.value}); setPagination(p => ({...p, page: 1})); }}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('savings.type') || 'Transaction Type'}</label>
            <Select
              value={filter.type}
              onChange={(e) => { setFilter({...filter, type: e.target.value}); setPagination(p => ({...p, page: 1})); }}
              options={[
                { value: 'all', label: tr('common.all') },
                { value: 'deposit', label: tr('txn.deposit') },
                { value: 'withdrawal', label: tr('txn.withdrawal') },
                { value: 'adjustment', label: tr('txn.adjustment') },
                { value: 'interest', label: tr('txn.interest') },
                { value: 'fee', label: tr('txn.fee') },
              ]}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('savings.account') || 'Account'}</label>
            <Select
              value={filter.account}
              onChange={(e) => { setFilter({...filter, account: e.target.value}); setPagination(p => ({...p, page: 1})); }}
              options={[
                { value: 'all', label: tr('common.all') },
                ...accounts.map(acc => ({ value: acc._id, label: `${acc.accountNo} (${acc.type})` })),
              ]}
              className="mt-1"
            />
          </div>
          <div>
            <Button onClick={fetchStatement} disabled={loading}>
              <Icon name="search" className="mr-2 h-4 w-4" />
              {tr('common.search') || 'Filter'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      <Card className="p-4">
        {loading && transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-brand-500">{tr('common.loading')}</p>
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('statement.noTransactions') || 'No transactions found'}
            description={filter.from || filter.to 
              ? tr('statement.noTransactions') || 'No transactions found for the selected period.'
              : 'Your transaction history will appear here.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="w-1/6">{tr('savings.date') || 'Date'}</th>
                    <th className="w-1/6">{tr('savings.type') || 'Type'}</th>
                    <th className="w-1/6">{tr('savings.account') || 'Account'}</th>
                    <th className="w-1/6">{tr('statement.credit') || 'Credit'}</th>
                    <th className="w-1/6">{tr('statement.debit') || 'Debit'}</th>
                    <th className="w-1/6">{tr('savings.balanceAfter') || 'Balance'}</th>
                    <th className="w-1/6">{tr('savings.status') || 'Status'}</th>
                    <th className="w-1/6">{tr('savings.receipt') || 'Receipt'}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn._id}>
                      <td className="text-sm text-brand-600">{formatDate(txn.createdAt)}</td>
                      <td>
                        {(() => {
                          const badge = getTypeBadge(txn.type);
                          return <Badge variant={badge.variant}>{badge.label}</Badge>;
                        })()}
                      </td>
                      <td className="text-sm text-brand-600">
                        {txn.account?.accountNo || '—'}
                        <span className="text-brand-400 ml-1 text-xs">({txn.account?.type || ''})</span>
                      </td>
                      <td className="text-green-600 font-medium">
                        {txn.type === 'deposit' || txn.type === 'interest' || txn.type === 'adjustment' 
                          ? formatMoney(txn.amountPaisa || 0) 
                          : '—'}
                      </td>
                      <td className="text-red-600 font-medium">
                        {txn.type === 'withdrawal' || txn.type === 'fee' || (txn.type === 'adjustment' && txn.amountPaisa < 0)
                          ? formatMoney(Math.abs(txn.amountPaisa || 0))
                          : '—'}
                      </td>
                      <td className="text-sm font-medium text-brand-900">
                        {formatMoney(txn.balanceAfterPaisa || 0)}
                      </td>
                      <td>
                        {(() => {
                          const badge = getStatusBadge(txn.status);
                          return <Badge variant={badge.variant}>{badge.label}</Badge>;
                        })()}
                      </td>
                      <td className="text-sm text-brand-500 font-mono">{txn.receiptNo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <Pagination
                current={pagination.page}
                total={pagination.pages}
                onChange={(page) => setPagination(p => ({...p, page}))}
              />
            )}
          </>
        )}
      </Card>
    </AppShell>
  );
}