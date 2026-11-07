'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import { useApi } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import MemberAccessModal from '@/components/members/MemberAccessModal';
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

  const renderAddress = (addressData) => {
    if (!addressData) return '—';
    if (typeof addressData === 'string') return addressData;
    if (addressData.fullAddress) return addressData.fullAddress;
    const parts = [
      addressData.village,
      addressData.postOffice,
      addressData.upazila,
      addressData.district,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  };

  const memberName = lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName;
  const memberRole = memberUser?.role || member.role || 'member';

  const renderOverview = () => (
    <div className="space-y-6">
      {/* 1. TOP HERO PROFILE SPOTLIGHT */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-200/80 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-950 p-6 text-white shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Member Profile Photo */}
            <div className="relative h-24 w-24 shrink-0 rounded-2xl border-2 border-white/30 bg-white/10 p-1 shadow-lg backdrop-blur-sm">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={memberName}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-brand-800 text-brand-300">
                  <Icon name="user" className="h-10 w-10" />
                </div>
              )}
              <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-white">
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Member Info & Designation */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-white">{memberName}</h2>
                <span className="rounded-full bg-brand-700/80 px-3 py-0.5 text-xs font-bold tracking-wide uppercase text-brand-100 border border-white/10">
                  {memberRole.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-1 font-mono text-sm text-brand-200">
                Member ID: <span className="font-bold text-white">{member.code || 'PENDING'}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-brand-200">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="phone" className="h-3.5 w-3.5 text-brand-300" />
                  {member.phone || '—'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="mail" className="h-3.5 w-3.5 text-brand-300" />
                  {member.email || 'No email attached'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 gap-2">
            <span className="text-xs uppercase tracking-wider text-brand-300">Total Savings</span>
            <span className="font-mono text-2xl font-black text-emerald-400">
              {formatMoney(member.savingsBalance || 0)}
            </span>
            <span className="text-[11px] text-brand-300">
              Joined: {member.createdAt || member.joinDate ? formatDate(member.createdAt || member.joinDate) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. PERSONAL DETAILS & ADDRESS GRID */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Information */}
        <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-brand-100 pb-3 mb-4">
            <Icon name="user" className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              Personal Information & KYC
            </h4>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">Full Name (English)</dt>
              <dd className="font-semibold text-brand-900">{member.fullName || '—'}</dd>
            </div>
            {member.fullNameBn && (
              <div className="flex justify-between py-1 border-b border-brand-50">
                <dt className="text-brand-500">বাংলা নাম</dt>
                <dd className="font-medium text-brand-900">{member.fullNameBn}</dd>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">Father's / Husband's Name</dt>
              <dd className="text-brand-800">{member.fatherHusbandName || '—'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">Mother's Name</dt>
              <dd className="text-brand-800">{member.motherName || '—'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">National ID (NID)</dt>
              <dd className="font-mono font-semibold text-brand-900">{member.nid || '—'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b border-brand-50">
              <dt className="text-brand-500">Date of Birth</dt>
              <dd className="text-brand-800">{member.dob || member.dateOfBirth ? formatDate(member.dob || member.dateOfBirth) : '—'}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-brand-500">Occupation</dt>
              <dd className="text-brand-800">{member.occupation || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Address & NID Attachment View */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-brand-100 pb-3 mb-4">
              <Icon name="mapPin" className="h-4 w-4 text-brand-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
                Address Details
              </h4>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-brand-500 block mb-1">Present Address</span>
                <p className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 text-brand-800">
                  {renderAddress(member.presentAddress)}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-brand-500 block mb-1">Permanent Address</span>
                <p className="rounded-xl border border-brand-100 bg-brand-50/40 p-3 text-brand-800">
                  {renderAddress(member.permanentAddress || member.presentAddress)}
                </p>
              </div>
            </div>
          </div>

          {/* Member NID Attachment Preview */}
          <div className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-2">
              Applicant NID Document
            </span>
            {member.nidDocument ? (
              <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-16 overflow-hidden rounded-lg border border-brand-200 bg-white">
                    <img src={member.nidDocument} alt="NID Document" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-900">NID Card Document Scan</p>
                    <p className="text-[11px] text-brand-500">Verified Identity File</p>
                  </div>
                </div>
                <a
                  href={member.nidDocument}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition"
                >
                  <Icon name="externalLink" className="h-3.5 w-3.5" /> View Full
                </a>
              </div>
            ) : (
              <p className="text-xs text-brand-400 italic">No document image uploaded.</p>
            )}
          </div>
        </div>
      </div>

      {/* 3. PORTAL ACCOUNT & ACCESS CONTROL */}
      <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-100 pb-3 mb-4 gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              {tr('members.access.securityTitle')}
            </h4>
            <p className="text-xs text-brand-500">{tr('members.access.securitySubtitle')}</p>
          </div>

          {isSuperAdmin && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAccessModal(true)}
              className="text-xs font-semibold shrink-0"
            >
              <Icon name="userCog" className="h-3.5 w-3.5 mr-1.5" />
              {tr('members.access.manage')}
            </Button>
          )}
        </div>

        {!memberUser && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mb-4">
            {tr('members.access.accountMissingNotice')}
          </p>
        )}

        <dl className="space-y-3 text-sm grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.access.accountStatus')}</dt>
            <dd className="mt-1 font-medium text-brand-900">
              <StatusBadge status={memberUser?.status || (memberUser ? 'active' : 'invited')} />
            </dd>
          </div>
          <div>
            <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.access.role')}</dt>
            <dd className="mt-1 font-bold text-brand-800 uppercase tracking-wide">
              {memberRole.replace(/_/g, ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.access.portalAccess')}</dt>
            <dd className="mt-1">
              <Badge variant={memberUser?.isActive === false ? 'badge-red' : 'badge-green'}>
                {memberUser?.isActive === false
                  ? tr('members.access.disabled')
                  : tr('members.access.enabled')}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-brand-500 text-xs font-semibold uppercase">{tr('members.lastLogin')}</dt>
            <dd className="mt-1 text-brand-700">
              {memberUser?.lastLoginAt ? formatDate(memberUser.lastLoginAt) : tr('members.access.neverLoggedIn')}
            </dd>
          </div>
        </dl>
      </div>

      {/* 4. NOMINEE SHOWCASE CARDS */}
      <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-brand-100 pb-3 mb-5">
          <div className="flex items-center gap-2">
            <Icon name="users" className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-900">
              Nominee Information & Documents
            </h4>
          </div>
          <span className="rounded-md bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-800">
            Total Nominees: {member.nominees?.length || 0}
          </span>
        </div>

        {member.nominees?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {member.nominees.map((nom, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden rounded-2xl border border-brand-200/90 bg-gradient-to-b from-white to-brand-50/30 p-4 shadow-xs hover:shadow-md transition"
              >
                {/* Header Share Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-brand-200 bg-white shadow-xs">
                      {nom.photo ? (
                        <img src={nom.photo} alt={nom.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-brand-100 text-brand-400">
                          <Icon name="user" className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-brand-900 leading-tight">{nom.name}</h5>
                      <span className="text-xs font-medium text-brand-600 capitalize">
                        {nom.relation || 'Nominee'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-800 border border-emerald-200">
                    {nom.percentage || 100}%
                  </span>
                </div>

                {/* Nominee Details */}
                <div className="space-y-1.5 border-t border-brand-100 pt-3 text-xs text-brand-700">
                  <p className="flex justify-between">
                    <span className="text-brand-500">NID / Reg No:</span>
                    <span className="font-mono font-medium text-brand-900">{nom.nid || '—'}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-brand-500">Mobile Phone:</span>
                    <span className="font-mono font-medium text-brand-900">{nom.phone || '—'}</span>
                  </p>
                  {nom.address && (
                    <p className="flex justify-between">
                      <span className="text-brand-500">Address:</span>
                      <span className="text-right text-brand-800 line-clamp-1">{renderAddress(nom.address)}</span>
                    </p>
                  )}
                </div>

                {/* Nominee Document link if exists */}
                {nom.nidDocument && (
                  <div className="mt-3 border-t border-brand-100 pt-2 flex items-center justify-between text-xs">
                    <span className="text-brand-500 flex items-center gap-1">
                      <Icon name="fileText" className="h-3.5 w-3.5 text-brand-600" /> Document attached
                    </span>
                    <a
                      href={nom.nidDocument}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-700 hover:text-brand-900 underline"
                    >
                      View NID
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-brand-500 italic py-2">No nominees recorded for this member.</p>
        )}
      </div>
    </div>
  );

  const renderSavings = () => {
    const accounts = savingsData?.items || savingsData?.accounts || [];
    const account = accounts[0];
    if (!account) {
      return (
        <EmptyState
          icon="wallet"
          title="No Savings Account"
          description="This member does not have an active savings account ledger."
        />
      );
    }
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Account Number</p>
            <p className="mt-1 font-mono text-lg font-bold text-brand-900">{account.accountNo || '—'}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Scheme Type</p>
            <p className="mt-1 font-medium text-brand-900">{account.scheme?.name || account.type || 'Standard'}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Current Balance</p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-700">{formatMoney(account.currentBalance || 0)}</p>
          </div>
          <div className="rounded-2xl border border-brand-200/80 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Total Deposited</p>
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
          title="No Payment History"
          description="No billing or transaction records found for this member."
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">Date</th>
              <th scope="col" className="px-4 py-3.5">Transaction Type</th>
              <th scope="col" className="px-4 py-3.5">Amount</th>
              <th scope="col" className="px-4 py-3.5">Method</th>
              <th scope="col" className="px-4 py-3.5">Status</th>
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
            Member Photograph
          </span>
          <div className="h-48 w-full rounded-xl border border-brand-100 bg-brand-50 overflow-hidden flex items-center justify-center">
            {member.photo ? (
              <img src={member.photo} alt={memberName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-brand-400">No photo uploaded</span>
            )}
          </div>
        </div>

        {/* Member NID Card */}
        <div className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-3">
            Member NID Card Document
          </span>
          <div className="h-48 w-full rounded-xl border border-brand-100 bg-brand-50 overflow-hidden flex items-center justify-center">
            {member.nidDocument ? (
              <img src={member.nidDocument} alt="NID Card" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-brand-400">No NID document uploaded</span>
            )}
          </div>
        </div>

        {/* Nominee Documents */}
        {member.nominees?.map((nom, idx) => (
          <div key={idx} className="rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 block mb-3">
              Nominee #{idx + 1} Document ({nom.name})
            </span>
            <div className="h-48 w-full rounded-xl border border-brand-100 bg-brand-50 overflow-hidden flex items-center justify-center">
              {nom.nidDocument || nom.photo ? (
                <img src={nom.nidDocument || nom.photo} alt={nom.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-brand-400">No document attached</span>
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
          title="No Ledger Records"
          description="There are currently no ledger accounting entries for this member."
        />
      );
    }
    return (
      <div className="overflow-x-auto rounded-2xl border border-brand-200/80 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
          <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">Date</th>
              <th scope="col" className="px-4 py-3.5">Description</th>
              <th scope="col" className="px-4 py-3.5">Debit</th>
              <th scope="col" className="px-4 py-3.5">Credit</th>
              <th scope="col" className="px-4 py-3.5">Balance</th>
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
      {/* Top Action Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title="Member Profile"
            subtitle="View full membership records, documentation, and savings ledger"
          />
        </div>
        {canManageMembers?.() && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => router.push(`/members/${memberId}/edit`)}>
              <Icon name="pencilLine" className="h-4 w-4 mr-1.5" />
              Edit Profile
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
              {tab.label}
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