'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import MemberAccessModal from '@/components/members/MemberAccessModal';
import MemberProfileView from '@/components/members/MemberProfileView';
import {
  Icon,
  Badge,
  Button,
  StatusBadge,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  formatMoney,
  formatDate,
} from '@/components/ui/common';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'user' },
  { id: 'savings', label: 'Savings Accounts', icon: 'wallet' },
  { id: 'payments', label: 'Payment History', icon: 'creditCard' },
  { id: 'documents', label: 'Documents & NID', icon: 'fileText' },
  { id: 'ledger', label: 'Account Ledger', icon: 'bookOpen' },
];

export default function MemberProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { tr, lang } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const canManageMembers = useAuthStore((state) => state.canManageMembers);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isSuperAdmin = hasRole('super_admin');

  const memberId = params?.id;
  const [activeTab, setActiveTab] = useState('overview');
  const [mounted, setMounted] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);

  const { data: memberResponse, loading, error, reload } = useApi(
    `/members/${memberId}`,
    undefined,
    { enabled: isAuthenticated && !!memberId }
  );

  const member = useMemo(() => {
    if (!memberResponse) return null;
    return memberResponse.member || memberResponse.data || memberResponse;
  }, [memberResponse]);

  // The API returns the linked login account next to the member record.
  const memberUser = memberResponse?.user || member?.user || null;

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

  if (!mounted || loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  if (error || !member || !member._id) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12">
          <EmptyState
            icon="alert"
            title="Member Not Found"
            description="The requested member record could not be loaded."
            actionLabel="Return to Member List"
            onAction={() => router.push('/members')}
          />
        </div>
      </AppShell>
    );
  }

  const renderSavings = () => {
    const accounts = savingsData?.items || savingsData?.accounts || [];
    const account = accounts[0];
    if (!account) {
      return (
        <EmptyState
          icon="wallet"
          title={tr('members.noSavingsAccount')}
          description={tr('members.noSavingsAccountDesc')}
        />
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.accountNumber')}</p>
            <p className="mt-1 font-mono text-lg font-bold text-brand-900">{account.accountNo || '—'}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.schemeType')}</p>
            <p className="mt-1 font-medium text-brand-900">{account.scheme?.name || account.type || 'Standard'}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.currentBalance')}</p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-700">{formatMoney(account.currentBalance || 0)}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{tr('members.totalDeposited')}</p>
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
          title={tr('members.noPaymentHistory')}
          description={tr('members.noPaymentHistoryDesc')}
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">{tr('common.date')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('members.transactionType')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('common.amount')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('members.method')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('common.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-100/80 bg-white">
            {payments.map((payment) => (
              <tr key={payment._id} className="hover:bg-brand-50/40">
                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-brand-600">{formatDate(payment.date)}</td>
                <td className="px-4 py-3.5 text-sm font-medium text-brand-900">{payment.type}</td>
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
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Member Photo Card */}
        <div className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-3">
            {tr('members.applicantPhoto')}
          </span>
          <div className="h-48 w-full rounded-xl border border-brand-100 bg-brand-50 overflow-hidden flex items-center justify-center">
            {member.photo ? (
              <img src={member.photo} alt={member.fullName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-brand-400">{tr('members.noPhotoUploaded')}</span>
            )}
          </div>
        </div>

        {/* Member NID Card */}
        <div className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-3">
            {tr('members.nidDocument')}
          </span>
          <div className="h-48 w-full rounded-xl border border-brand-100 bg-brand-50 overflow-hidden flex items-center justify-center">
            {member.nidDocument ? (
              <img src={member.nidDocument} alt="NID Card" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-brand-400">{tr('members.noNidDocumentUploaded')}</span>
            )}
          </div>
        </div>

        {/* Nominee Documents */}
        {member.nominees?.map((nom, idx) => (
          <div key={nom._id || idx} className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-3">
              {tr('members.nomineeDocument', { idx: idx + 1, name: nom.name })}
            </span>
            <div className="h-48 w-full rounded-xl border border-brand-100 bg-brand-50 overflow-hidden flex items-center justify-center">
              {nom.nidDocument || nom.photo ? (
                <img src={nom.nidDocument || nom.photo} alt={nom.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-brand-400">{tr('members.noDocumentAttached')}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLedger = () => {
    const entries = ledgerData?.items || [];
    if (!entries.length) {
      return (
        <EmptyState
          icon="fileText"
          title={tr('members.noLedgerRecords')}
          description={tr('members.noLedgerRecordsDesc')}
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">{tr('common.date')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('common.description')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('common.debit')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('common.credit')}</th>
              <th scope="col" className="px-4 py-3.5">{tr('common.balance')}</th>
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
        return (
          <MemberProfileView
            member={member}
            memberUser={memberUser}
            showPortalAccess={true}
            onEdit={() => setShowAccessModal(true)}
            tr={tr}
          />
        );
      case 'savings':
        return renderSavings();
      case 'payments':
        return renderPayments();
      case 'documents':
        return renderDocuments();
      case 'ledger':
        return renderLedger();
      default:
        return (
          <MemberProfileView
            member={member}
            memberUser={memberUser}
            showPortalAccess={true}
            onEdit={() => setShowAccessModal(true)}
            tr={tr}
          />
        );
    }
  };

  return (
    <AppShell>
      {/* Top Action Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title={tr('members.memberProfile')}
            subtitle={tr('members.memberProfileSubtitle')}
          />
        </div>
        {canManageMembers?.() && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/members/${memberId}/edit`)}>
              <Icon name="pencilLine" className="h-4 w-4 mr-1.5" />
              {tr('common.edit')}
            </Button>
          </div>
        )}
      </div>

      {/* Modern Tabs Navigation */}
      <div className="mb-6 border-b border-brand-200/70">
        <nav className="flex gap-2 overflow-x-auto pb-1 -mb-px" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 shrink-0 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-brand-900 border-b-2 border-brand-800 shadow-xs'
                  : 'text-brand-500 hover:text-brand-800 hover:bg-brand-50/60'
              }`}
            >
              <Icon name={tab.icon} className="h-4 w-4" />
              {tr(`members.tabs.${tab.id}`) || tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Container */}
      <div className="rounded-b-2xl border border-brand-200/80 bg-white p-6 shadow-xs">
        {renderTabContent()}
      </div>

      <MemberAccessModal
        isOpen={showAccessModal}
        member={{ ...member, user: memberUser }}
        onClose={() => setShowAccessModal(false)}
        onUpdated={() => {
          setShowAccessModal(false);
          reload();
        }}
      />
    </AppShell>
  );
}