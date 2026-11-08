'use client';

import React, { useState, useEffect } from 'react';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import AppShell from '@/components/layout/AppShell';
import { PageHeader, Card, Badge, Icon, Select, Button, Alert, Input, EmptyState, formatMoney } from '@/components/ui/common';

export default function ReportsPage() {
  const { tr } = useLang();
  const user = useAuthStore((state) => state.user);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [reportType, setReportType] = useState('collection');
  const [reportData, setReportData] = useState([]);

  const reportTypes = [
    { value: 'collection', label: tr('admin.collectionReports') || 'Collection Report' },
    { value: 'dues', label: tr('admin.overdueReports') || 'Dues Report' },
    { value: 'late-fee', label: tr('admin.lateFeeReports') || 'Late Fee Report' },
    { value: 'income-expense', label: tr('admin.incomeExpense') || 'Income vs Expense' },
    { value: 'member', label: tr('admin.memberList') || 'Member Report' },
  ];

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        type: reportType,
      });
      
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      
      if (data.success) {
        setReportData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    if (!dateRange.from || !dateRange.to) {
      alert(tr('validation.date') || 'Please select a date range');
      return;
    }

    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        type: reportType,
        format,
      });
      
      const res = await fetch(`/api/reports/export?${params.toString()}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}-report-${dateRange.from}-to-${dateRange.to}.${format === 'csv' ? 'csv' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert(tr('toast.fileUploadFailed') || 'Export failed');
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const badges = {
      due: { variant: 'warning', label: 'Due' },
      overdue: { variant: 'danger', label: 'Overdue' },
      paid: { variant: 'success', label: 'Paid' },
      cancelled: { variant: 'default', label: 'Cancelled' },
      draft: { variant: 'default', label: 'Draft' },
      pending: { variant: 'warning', label: 'Pending' },
      approved: { variant: 'success', label: 'Approved' },
      rejected: { variant: 'danger', label: 'Rejected' },
    };
    return badges[status] || { variant: 'default', label: status };
  };

  if (loading && !metrics) {
    return (
      <AppShell>
        <PageHeader title={tr('nav.reports')} subtitle={tr('admin.collectionReports')} />
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
          <p className="mt-2 text-brand-500">{tr('common.loading')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader 
        title={tr('nav.reports')} 
        subtitle={tr('admin.collectionReports') || 'Financial reports and analytics'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')} icon="download">
              {tr('admin.exportExcel') || 'Export CSV'}
            </Button>
            <Button variant="outline" onClick={() => handleExport('pdf')} icon="file">
              {tr('admin.exportPdf') || 'Export PDF'}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-brand-500">{tr('dashboard.totalMembers') || 'Total Members'}</p>
            <p className="text-2xl font-bold text-brand-900">{metrics.totalMembers || 0}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-brand-500">{tr('dashboard.totalCollection') || 'Total Collection'}</p>
            <p className="text-2xl font-bold text-brand-900">{formatMoney(metrics.totalCollection || 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-brand-500">{tr('dashboard.totalExpenses') || 'Total Expenses'}</p>
            <p className="text-2xl font-bold text-brand-900">{formatMoney(metrics.totalExpenses || 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-brand-500">{tr('dashboard.availableFund') || 'Available Fund'}</p>
            <p className="text-2xl font-bold text-brand-900">{formatMoney(metrics.availableFund || 0)}</p>
          </Card>
        </div>
      )}

      {/* Report Type Selector & Date Range */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="label">{tr('reports.type') || 'Report Type'}</label>
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              options={reportTypes}
              className="w-full mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('statement.dateFrom') || 'From Date'}</label>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <label className="label">{tr('statement.dateTo') || 'To Date'}</label>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
              className="mt-1"
            />
          </div>
          <div>
            <Button onClick={fetchReport} disabled={loading || !dateRange.from || !dateRange.to}>
              <Icon name="search" className="mr-2 h-4 w-4" />
              {tr('common.search') || 'Generate Report'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Results */}
      <Card className="p-4">
        {loading && reportData.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-brand-500 border-t-transparent" />
            <p className="mt-2 text-brand-500">{tr('common.loading')}</p>
          </div>
        ) : reportData.length === 0 ? (
          <EmptyState
            icon="file"
            title={tr('common.noData') || 'No data found'}
            description={dateRange.from && dateRange.to 
              ? tr('common.noData') || 'No records found for the selected period.'
              : 'Select a date range and click Generate Report to view data.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    {reportType === 'collection' && (
                      <>
                        <th>{tr('savings.date') || 'Date'}</th>
                        <th>{tr('savings.member') || 'Member'}</th>
                        <th>{tr('savings.type') || 'Type'}</th>
                        <th>{tr('savings.method') || 'Method'}</th>
                        <th>{tr('savings.amount') || 'Amount'}</th>
                        <th>{tr('savings.receipt') || 'Receipt'}</th>
                      </>
                    )}
                    {reportType === 'dues' && (
                      <>
                        <th>{tr('savings.dueNo') || 'Due No.'}</th>
                        <th>{tr('savings.member') || 'Member'}</th>
                        <th>{tr('savings.period') || 'Period'}</th>
                        <th>{tr('savings.type') || 'Type'}</th>
                        <th>{tr('savings.principal') || 'Principal'}</th>
                        <th>{tr('savings.lateFee') || 'Late Fee'}</th>
                        <th>{tr('savings.totalDue') || 'Total Due'}</th>
                        <th>{tr('savings.status') || 'Status'}</th>
                        <th>{tr('savings.dueDate') || 'Due Date'}</th>
                      </>
                    )}
                    {reportType === 'late-fee' && (
                      <>
                        <th>{tr('savings.dueNo') || 'Due No.'}</th>
                        <th>{tr('savings.member') || 'Member'}</th>
                        <th>{tr('savings.period') || 'Period'}</th>
                        <th>{tr('savings.lateFee') || 'Late Fee'}</th>
                        <th>{tr('savings.status') || 'Status'}</th>
                        <th>{tr('savings.dueDate') || 'Due Date'}</th>
                      </>
                    )}
                    {reportType === 'income-expense' && (
                      <>
                        <th>{tr('savings.date') || 'Date'}</th>
                        <th>{tr('expenses.category') || 'Category'}</th>
                        <th>{tr('expenses.titleField') || 'Title'}</th>
                        <th>{tr('savings.type') || 'Type'}</th>
                        <th>{tr('savings.amount') || 'Amount'}</th>
                        <th>{tr('expenses.status') || 'Status'}</th>
                      </>
                    )}
                    {reportType === 'member' && (
                      <>
                        <th>{tr('members.code') || 'Code'}</th>
                        <th>{tr('members.name') || 'Name'}</th>
                        <th>{tr('members.phone') || 'Phone'}</th>
                        <th>{tr('members.joinDate') || 'Joined'}</th>
                        <th>{tr('members.savings') || 'Savings'}</th>
                        <th>{tr('members.status') || 'Status'}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((item, index) => (
                    <tr key={item._id || index}>
                      {reportType === 'collection' && (
                        <>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>{item.member?.fullName || item.member?.fullNameBn || '—'}</td>
                          <td>{item.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</td>
                          <td>{item.method || '—'}</td>
                          <td>{formatMoney(item.amountPaisa || 0)}</td>
                          <td>{item.receiptNo || '—'}</td>
                        </>
                      )}
                      {reportType === 'dues' && (
                        <>
                          <td>{item.dueNo || '—'}</td>
                          <td>{item.member?.fullName || item.member?.fullNameBn || '—'}</td>
                          <td>{item.period || '—'}</td>
                          <td>{item.type || '—'}</td>
                          <td>{formatMoney(item.principalPaisa || 0)}</td>
                          <td>{formatMoney(item.lateFeePaisa || 0)}</td>
                          <td>{formatMoney(item.totalDuePaisa || 0)}</td>
                          <td>
                            {(() => {
                              const badge = getStatusBadge(item.status);
                              return <Badge variant={badge.variant}>{badge.label}</Badge>;
                            })()}
                          </td>
                          <td>{formatDate(item.dueDate)}</td>
                        </>
                      )}
                      {reportType === 'late-fee' && (
                        <>
                          <td>{item.dueNo || '—'}</td>
                          <td>{item.member?.fullName || item.member?.fullNameBn || '—'}</td>
                          <td>{item.period || '—'}</td>
                          <td>{formatMoney(item.lateFeePaisa || 0)}</td>
                          <td>
                            {(() => {
                              const badge = getStatusBadge(item.status);
                              return <Badge variant={badge.variant}>{badge.label}</Badge>;
                            })()}
                          </td>
                          <td>{formatDate(item.dueDate)}</td>
                        </>
                      )}
                      {reportType === 'income-expense' && (
                        <>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>{item.category || '—'}</td>
                          <td>{item.title || item.description || '—'}</td>
                          <td>{item.type === 'deposit' || item.type === 'expense' ? 
                            (item.type === 'deposit' ? 'Income' : 'Expense') : '—'}</td>
                          <td className={item.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                            {item.type === 'expense' ? '-' : '+'}{formatMoney(item.amountPaisa || 0)}
                          </td>
                          <td>
                            {(() => {
                              const badge = getStatusBadge(item.status);
                              return <Badge variant={badge.variant}>{badge.label}</Badge>;
                            })()}
                          </td>
                        </>
                      )}
                      {reportType === 'member' && (
                        <>
                          <td>{item.code || '—'}</td>
                          <td>{item.fullName || item.fullNameBn || '—'}</td>
                          <td>{item.phone || '—'}</td>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>{formatMoney(item.totalBalancePaisa || 0)}</td>
                          <td>
                            {(() => {
                              const badge = getStatusBadge(item.status);
                              return <Badge variant={badge.variant}>{badge.label}</Badge>;
                            })()}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}