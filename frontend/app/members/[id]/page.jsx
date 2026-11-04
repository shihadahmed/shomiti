'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import {
  Icon,
  Button,
  StatusBadge,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  formatMoney,
  formatDate,
} from '@/components/ui/common';
import { toast } from 'react-toastify';

const TABS = [
  { id: 'overview', label: 'Overview', i18n: 'members.tabs.overview' },
  { id: 'savings', label: 'Savings', i18n: 'members.tabs.savings' },
  { id: 'payments', label: 'Payments', i18n: 'members.tabs.payments' },
  { id: 'documents', label: 'Documents', i18n: 'members.tabs.documents' },
  { id: 'ledger', label: 'Ledger', i18n: 'members.tabs.ledger' },
];

export default function MemberProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const canManageMembers = useAuthStore((state) => state.canManageMembers);

  const memberId = params.id;
  const [activeTab, setActiveTab] = useState('overview');
  const [mounted, setMounted] = useState(false);

  const { data: memberResponse, loading, error, reload } = useApi(
    `/members/${memberId}`,
    undefined,
    { enabled: isAuthenticated && !!memberId }
  );

  // Extract member from response: { member, accounts, transactions }
  const member = useMemo(() => memberResponse?.member, [memberResponse]);

  const { data: savingsData } = useApi(
    `/members/${memberId}/savings`,
    undefined,
    { enabled: isAuthenticated && activeTab === 'savings' }
  );

  const { data: paymentsData } = useApi(
    `/members/${memberId}/payments`,
    { limit: 20 },
    { enabled: isAuthenticated && activeTab === 'payments' }
  );

  const { data: documentsData } = useApi(
    `/members/${memberId}/documents`,
    { limit: 20 },
    { enabled: isAuthenticated && activeTab === 'documents' }
  );

  const { data: ledgerData } = useApi(
    `/ledger/member/${memberId}`,
    { limit: 20 },
    { enabled: isAuthenticated && activeTab === 'ledger' }
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !member) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12">
          <EmptyState
            icon="alert"
            title={tr('common.notFound') || 'Not Found'}
            description={tr('members.notFound') || 'Member not found'}
            actionLabel={tr('common.back')}
            onAction={() => router.back()}
          />
        </div>
      </AppShell>
    );
  }

  // Helper to get address field from presentAddress object
  const getAddressField = (field) => member.presentAddress?.[field] || member.permanentAddress?.[field] || '—';

  // Helper to get first nominee
  const nominee = member.nominees?.[0];

  const memberName = lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName;
  const memberStatus = member.status || 'active';

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.code') || 'Member Code'}</p>
          <p className="mt-1 font-mono text-lg font-bold text-brand-900">{member.code || '—'}</p>
        </div>
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.joinDate') || 'Joined'}</p>
          <p className="mt-1 font-medium text-brand-900">{member.joinDate ? formatDate(member.joinDate) : '—'}</p>
        </div>
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.status') || 'Status'}</p>
          <p className="mt-1"><StatusBadge status={memberStatus} /></p>
        </div>
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.savingsBalance') || 'Savings Balance'}</p>
          <p className="mt-1 font-mono text-lg font-bold text-emerald-700">{formatMoney(member.savingsBalance || 0)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <h4 className="text-sm font-semibold text-brand-900">{tr('members.personalInfo') || 'Personal Information'}</h4>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.fullName') || 'Full Name'}</dt>
              <dd className="font-medium text-brand-900">{memberName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.nid') || 'National ID'}</dt>
              <dd className="font-mono text-brand-700">{member.nid || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.phone') || 'Phone'}</dt>
              <dd className="font-mono text-brand-700">{member.phone || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.email') || 'Email'}</dt>
              <dd className="text-brand-700">{member.email || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.dob') || 'Date of Birth'}</dt>
              <dd className="text-brand-700">{member.dateOfBirth ? formatDate(member.dateOfBirth) : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.occupation') || 'Occupation'}</dt>
              <dd className="text-brand-700">{member.occupation || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <h4 className="text-sm font-semibold text-brand-900">{tr('members.addressInfo') || 'Address Details'}</h4>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.village') || 'Village'}</dt>
              <dd className="text-brand-700">{getAddressField('village')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.postOffice') || 'Post Office'}</dt>
              <dd className="text-brand-700">{getAddressField('postOffice')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.upazila') || 'Upazila'}</dt>
              <dd className="text-brand-700">{getAddressField('upazila')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.district') || 'District'}</dt>
              <dd className="text-brand-700">{getAddressField('district')}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs lg:col-span-2">
          <h4 className="text-sm font-semibold text-brand-900">{tr('members.nomineeInfo') || 'Nominee Information'}</h4>
          <dl className="mt-4 space-y-3 text-sm grid grid-cols-2 gap-3">
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.nomineeName') || 'Nominee Name'}</dt>
              <dd className="font-medium text-brand-900">{nominee?.name || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.nomineeRelation') || 'Relationship'}</dt>
              <dd className="text-brand-700">{nominee?.relation || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.nomineePhone') || 'Nominee Phone'}</dt>
              <dd className="font-mono text-brand-700">{nominee?.phone || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.nomineeShare') || 'Share Percentage'}</dt>
              <dd className="font-medium text-brand-900">{nominee?.percentage ? `${nominee.percentage}%` : '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {member.userId && (
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <h4 className="text-sm font-semibold text-brand-900">{tr('members.portalAccess') || 'Portal Access'}</h4>
          <dl className="mt-4 space-y-3 text-sm grid grid-cols-2 gap-3">
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.userStatus') || 'User Status'}</dt>
              <dd className="font-medium text-brand-900"><StatusBadge status={member.user?.status || 'invited'} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.userRole') || 'User Role'}</dt>
              <dd className="text-brand-700 capitalize">{member.user?.role || 'member'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-brand-500">{tr('members.lastLogin') || 'Last Login'}</dt>
              <dd className="text-brand-700">{member.user?.lastLoginAt ? formatDate(member.user.lastLoginAt) : (tr('common.never') || 'Never')}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );

  const renderSavings = () => {
    const accounts = savingsData?.items || savingsData?.accounts || [];
    const account = accounts[0];
    if (!account) {
      return (
        <EmptyState
          icon="wallet"
          title={tr('members.noSavingsAccount') || 'No Savings Account'}
          description={tr('members.noSavingsDesc') || 'This member does not have a savings account yet.'}
        />
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.accountNo') || 'Account No.'}</p>
            <p className="mt-1 font-mono text-lg font-bold text-brand-900">{account.accountNo || '—'}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.scheme') || 'Scheme'}</p>
            <p className="mt-1 font-medium text-brand-900">{account.scheme?.name || account.type || '—'}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.currentBalance') || 'Current Balance'}</p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-700">{formatMoney(account.currentBalance || account.balancePaisa ? account.balancePaisa / 100 : 0)}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.totalDeposited') || 'Total Deposited'}</p>
            <p className="mt-1 font-mono text-lg font-bold text-brand-900">{formatMoney(account.totalDeposited || 0)}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderPayments = () => {
    const payments = paymentsData?.items || [];
    if (!payments.length) {
      return (
        <EmptyState
          icon="creditCard"
          title={tr('members.noPayments') || 'No Payments'}
          description={tr('members.noPaymentsDesc') || 'No payment records found for this member.'}
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">{tr('payments.date') || 'Date'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('payments.type') || 'Type'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('payments.amount') || 'Amount'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('payments.method') || 'Method'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('payments.status') || 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100/80 bg-white">
            {payments.map((payment) => (
              <tr key={payment._id} className="hover:bg-brand-50/40">
                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-brand-600">{formatDate(payment.date)}</td>
                <td className="px-4 py-3.5 text-sm text-brand-900">{tr(`paymentType.${payment.type}`) || payment.type}</td>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-emerald-700">{formatMoney(payment.amount)}</td>
                <td className="px-4 py-3.5 text-xs text-brand-700">{payment.method}</td>
                <td className="px-4 py-3.5"><StatusBadge status={payment.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDocuments = () => {
    const docs = documentsData?.items || [];
    if (!docs.length) {
      return (
        <EmptyState
          icon="file"
          title={tr('members.noDocuments') || 'No Documents'}
          description={tr('members.noDocumentsDesc') || 'No documents uploaded for this member.'}
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">{tr('documents.name') || 'Name'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('documents.type') || 'Type'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('documents.uploadedAt') || 'Uploaded'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('documents.status') || 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100/80 bg-white">
            {docs.map((doc) => (
              <tr key={doc._id} className="hover:bg-brand-50/40">
                <td className="px-5 py-3.5 font-medium text-brand-900">{doc.name}</td>
                <td className="px-4 py-3.5 text-xs text-brand-700">{tr(`documentType.${doc.type}`) || doc.type}</td>
                <td className="px-4 py-3.5 text-xs text-brand-600">{formatDate(doc.uploadedAt)}</td>
                <td className="px-4 py-3.5"><StatusBadge status={doc.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLedger = () => {
    const entries = ledgerData?.items || [];
    if (!entries.length) {
      return (
        <EmptyState
          icon="fileText"
          title={tr('members.noLedger') || 'No Ledger Entries'}
          description={tr('members.noLedgerDesc') || 'No ledger entries found for this member.'}
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">{tr('ledger.date') || 'Date'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('ledger.description') || 'Description'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('ledger.debit') || 'Debit'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('ledger.credit') || 'Credit'}</th>
              <th scope="col" className="px-4 py-3.5">{tr('ledger.balance') || 'Balance'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100/80 bg-white">
            {entries.map((entry) => (
              <tr key={entry._id} className="hover:bg-brand-50/40">
                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-brand-600">{formatDate(entry.date)}</td>
                <td className="px-4 py-3.5 text-sm text-brand-900">{entry.description}</td>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-rose-600">{entry.debit ? formatMoney(entry.debit) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-emerald-600">{entry.credit ? formatMoney(entry.credit) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-brand-900">{formatMoney(entry.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'savings':
        return renderSavings();
      case 'payments':
        return renderPayments();
      case 'documents':
        return renderDocuments();
      case 'ledger':
        return renderLedger();
      default:
        return renderOverview();
    }
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title={memberName}
            subtitle={member.code}
          />
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={memberStatus} />
            {member.userId && member.user && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                <Icon name="shield" className="h-3 w-3" />
                {tr(`role.${member.user.role}`) || member.user.role}
              </span>
            )}
          </div>
        </div>
        {canManageMembers?.() && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/members/${memberId}/edit`)}>
              <Icon name="pencilLine" className="h-4 w-4 mr-1.5" />
              {tr('common.edit') || 'Edit'}
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6 border-b border-brand-200/70">
        <nav className="flex gap-1 overflow-x-auto pb-1 -mb-px" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 whitespace-nowrap rounded-t-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-brand-900 border-b-2 border-brand-700 shadow-sm'
                  : 'text-brand-500 hover:text-brand-700 hover:bg-brand-50/50'
              }`}
            >
              {tr(tab.i18n) || tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-b-2xl border border-brand-200/80 bg-white shadow-xs">
        <div className="p-6">{renderTabContent()}</div>
      </div>
    </AppShell>
  );
}