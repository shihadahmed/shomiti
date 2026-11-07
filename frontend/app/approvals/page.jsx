'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiPost } from '@/lib/useApi';
import AppShell, { decrementApprovalsTotal } from '@/components/layout/AppShell';
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
  FilterBar,
  Modal,
} from '@/components/ui/common';
import { FormSection, FormActions } from '@/components/ui/form';

const SLIP_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'failed', label: 'Failed' },
];

const METHODS = [
  { value: '', label: 'All' },
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const REQUEST_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ApprovalsPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('slips'); // 'slips', 'requests', or 'kyc'
  const [slipPage, setSlipPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [kycPage, setKycPage] = useState(1);
  const [slipSearch, setSlipSearch] = useState('');
  const [slipStatusFilter, setSlipStatusFilter] = useState('');
  const [slipMethodFilter, setSlipMethodFilter] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [kycSearch, setKycSearch] = useState('');
  const [kycStatusFilter, setKycStatusFilter] = useState('');
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [reviewingSlip, setReviewingSlip] = useState(null);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [reviewingKyc, setReviewingKyc] = useState(null);
  const [slipDecision, setSlipDecision] = useState({ approved: true, reason: '' });
  const [requestDecision, setRequestDecision] = useState({ decision: 'approved', note: '' });
  const [kycDecision, setKycDecision] = useState({ decision: 'approved', reason: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // useMemo prevents new object references on every render cycle
  const slipParams = useMemo(
    () => ({
      page: slipPage,
      limit: 15,
      search: slipSearch || undefined,
      status: slipStatusFilter || undefined,
      method: slipMethodFilter || undefined,
    }),
    [slipPage, slipSearch, slipStatusFilter, slipMethodFilter]
  );

  const requestParams = useMemo(
    () => ({
      page: requestPage,
      limit: 15,
      search: requestSearch || undefined,
      status: requestStatusFilter || undefined,
    }),
    [requestPage, requestSearch, requestStatusFilter]
  );

  const kycParams = useMemo(
    () => ({
      page: kycPage,
      limit: 15,
      search: kycSearch || undefined,
      status: kycStatusFilter || undefined,
    }),
    [kycPage, kycSearch, kycStatusFilter]
  );

  const {
    data: slipData,
    loading: slipLoading,
    error: slipError,
    reload: reloadSlips,
  } = useApi('/approvals/slips', slipParams, {
    enabled: Boolean(isAuthenticated && activeTab === 'slips'),
  });

  const {
    data: requestData,
    loading: requestLoading,
    error: requestError,
    reload: reloadRequests,
  } = useApi('/approvals', requestParams, {
    enabled: Boolean(isAuthenticated && activeTab === 'requests'),
  });

  const {
    data: kycData,
    loading: kycLoading,
    error: kycError,
    reload: reloadKyc,
  } = useApi('/auth/users/kyc-pending', kycParams, {
    enabled: Boolean(isAuthenticated && activeTab === 'kyc'),
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

  const handleSlipSearch = useCallback(
    (e) => {
      e.preventDefault();
      setSlipPage(1);
      reloadSlips?.();
    },
    [reloadSlips]
  );

  const handleRequestSearch = useCallback(
    (e) => {
      e.preventDefault();
      setRequestPage(1);
      reloadRequests?.();
    },
    [reloadRequests]
  );

  const openSlipReview = (slip) => {
    setReviewingSlip(slip);
    setSlipDecision({ approved: true, reason: '' });
    setShowSlipModal(true);
  };

  const openRequestReview = (request) => {
    setReviewingRequest(request);
    setRequestDecision({ decision: 'approved', note: '' });
    setShowRequestModal(true);
  };

  const closeSlipModal = () => {
    setShowSlipModal(false);
    setReviewingSlip(null);
    setSlipDecision({ approved: true, reason: '' });
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setReviewingRequest(null);
    setRequestDecision({ decision: 'approved', note: '' });
  };

  const openKycReview = (user) => {
    setReviewingKyc(user);
    setKycDecision({ decision: 'approved', reason: '' });
    setShowKycModal(true);
  };

  const closeKycModal = () => {
    setShowKycModal(false);
    setReviewingKyc(null);
    setKycDecision({ decision: 'approved', reason: '' });
  };

  const submitKycDecision = async (decision) => {
    if (!reviewingKyc) return;

    if (decision === 'rejected' && !kycDecision.reason.trim()) {
      alert(tr('approvals.rejectionReasonRequired'));
      return;
    }

    setReviewSubmitting(true);
    try {
      await apiPost(`/auth/users/${reviewingKyc._id}/kyc-decision`, {
        decision,
        reason: kycDecision.reason,
      });
      closeKycModal();
      reloadKyc?.();
    } catch (requestError) {
      alert(requestError?.message || tr('error.generic'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleKycDecision = async (e) => {
    e.preventDefault();
    await submitKycDecision(kycDecision.decision);
  };

  const handleSlipDecision = async (e) => {
    e.preventDefault();
    if (!reviewingSlip) return;

    if (!slipDecision.approved && !slipDecision.reason.trim()) {
      alert(tr('approvals.rejectionReasonRequired'));
      return;
    }

    setReviewSubmitting(true);
    try {
      await apiPost(`/approvals/slips/${reviewingSlip._id}/decision`, {
        decision: slipDecision.approved ? 'approved' : 'rejected',
        reason: slipDecision.reason,
      });
      if (reviewingSlip.status === 'pending') decrementApprovalsTotal();
      closeSlipModal();
      reloadSlips?.();
    } catch (requestError) {
      alert(requestError?.message || tr('error.generic'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRequestDecision = async (e) => {
    e.preventDefault();
    if (!reviewingRequest) return;

    setReviewSubmitting(true);
    try {
      await apiPost(`/approvals/${reviewingRequest._id}/decision`, requestDecision);
      const closesRequest = requestDecision.decision === 'rejected'
        || (reviewingRequest.approvalCount || 0) + 1 >= (reviewingRequest.requiredApprovals || 1);
      if (reviewingRequest.status === 'pending' && closesRequest) decrementApprovalsTotal();
      closeRequestModal();
      reloadRequests?.();
    } catch (requestError) {
      alert(requestError?.message || tr('error.generic'));
    } finally {
      setReviewSubmitting(false);
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

  const slips = slipData?.items || [];
  const slipMeta = slipData?.meta || { total: 0, pages: 1 };
  const requests = requestData?.items || [];
  const requestMeta = requestData?.meta || { total: 0, pages: 1 };

  return (
    <AppShell>
      <PageHeader title={tr('approvals.title')} subtitle={tr('approvals.subtitle')} />

      <div className="mb-6 border-b border-brand-200">
        <nav className="flex gap-1" aria-label="Tabs">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-t-xl transition ${
              activeTab === 'slips'
                ? 'bg-brand-700 text-white'
                : 'text-brand-700 hover:bg-brand-100'
            }`}
            onClick={() => setActiveTab('slips')}
          >
            {tr('approvals.paymentSlips')}{' '}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === 'slips' ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
              }`}
            >
              {slipMeta.total || 0}
            </span>
          </button>
           <button
             type="button"
             className={`px-4 py-2 text-sm font-medium rounded-t-xl transition ${
               activeTab === 'requests'
                 ? 'bg-brand-700 text-white'
                 : 'text-brand-700 hover:bg-brand-100'
             }`}
             onClick={() => setActiveTab('requests')}
           >
             {tr('approvals.approvalRequests')}{' '}
             <span
               className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                 activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
               }`}
             >
               {requestMeta.total || 0}
             </span>
           </button>
           <button
             type="button"
             className={`px-4 py-2 text-sm font-medium rounded-t-xl transition ${
               activeTab === 'kyc'
                 ? 'bg-brand-700 text-white'
                 : 'text-brand-700 hover:bg-brand-100'
             }`}
             onClick={() => setActiveTab('kyc')}
           >
             {tr('approvals.kycProfiles')}{' '}
             <span
               className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                 activeTab === 'kyc' ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
               }`}
             >
               {kycData?.meta?.total || 0}
             </span>
           </button>
         </nav>
       </div>

      {activeTab === 'slips' && (
        <>
          <form onSubmit={handleSlipSearch} className="mb-6">
            <FilterBar>
              <SearchInput
                value={slipSearch}
                onChange={(e) => setSlipSearch(e.target.value)}
                placeholder={tr('savings.searchPlaceholder')}
                className="flex-1 min-w-[280px] max-w-md"
              />
              <Select
                value={slipStatusFilter}
                onChange={(e) => setSlipStatusFilter(e.target.value)}
                options={SLIP_STATUSES}
                className="w-[160px]"
              />
              <Select
                value={slipMethodFilter}
                onChange={(e) => setSlipMethodFilter(e.target.value)}
                options={METHODS}
                className="w-[160px]"
              />
            </FilterBar>
          </form>

          <div className="card">
            {slipLoading ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="md" />
              </div>
            ) : slipError ? (
              <EmptyState icon="alert" title={tr('common.error')} description={slipError} className="p-8" />
            ) : slips.length === 0 ? (
              <EmptyState icon="file" title={tr('approvals.noSlips')} description={tr('common.noData')} className="p-12" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-brand-200 text-sm">
                    <thead className="bg-brand-50/80">
                      <tr>
                        <th className="th">{tr('approvals.paymentNo')}</th>
                        <th className="th">{tr('approvals.date')}</th>
                        <th className="th">{tr('members.name')}</th>
                        <th className="th">{tr('savings.type')}</th>
                        <th className="th">{tr('savings.amount')}</th>
                        <th className="th">{tr('savings.method')}</th>
                        <th className="th">{tr('savings.status')}</th>
                        <th className="th">{tr('approvals.submittedBy')}</th>
                        <th className="th">{tr('members.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-200">
                      {slips.map((slip) => (
                        <tr key={slip._id} className="tr-hover">
                          <td className="td font-mono text-brand-900">{slip.paymentNo}</td>
                          <td className="td text-brand-700">{formatDate(slip.createdAt)}</td>
                          <td className="td font-medium text-brand-900">
                            {lang === 'bn' && slip.member?.fullNameBn
                              ? slip.member.fullNameBn
                              : slip.member?.fullName || '-'}
                            <br />
                            <span className="text-xs text-brand-500 font-mono">{slip.member?.code}</span>
                          </td>
                          <td className="td capitalize">
                            {slip.savingsDue?.savingsType ? tr(`savings.${slip.savingsDue.savingsType}`) : '-'}
                          </td>
                          <td className="td font-mono font-semibold text-brand-900">
                            {formatMoney(slip.amountPaisa || 0)}
                          </td>
                          <td className="td capitalize">{tr(`method.${slip.method}`)}</td>
                          <td className="td">
                            <StatusBadge status={slip.status} />
                          </td>
                          <td className="td text-brand-700">{slip.createdBy?.name || '-'}</td>
                          <td className="td">
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={() => openSlipReview(slip)}
                              aria-label={tr('approvals.review')}
                            >
                              {tr('approvals.review')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={slipMeta} onPage={setSlipPage} />
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'requests' && (
        <>
          <form onSubmit={handleRequestSearch} className="mb-6">
            <FilterBar>
              <SearchInput
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                placeholder={tr('savings.searchPlaceholder')}
                className="flex-1 min-w-[280px] max-w-md"
              />
              <Select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                options={REQUEST_STATUSES}
                className="w-[180px]"
              />
            </FilterBar>
          </form>

          <div className="card">
            {requestLoading ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="md" />
              </div>
            ) : requestError ? (
              <EmptyState icon="alert" title={tr('common.error')} description={requestError} className="p-8" />
            ) : requests.length === 0 ? (
              <EmptyState icon="shield" title={tr('approvals.noRequests')} description={tr('common.noData')} className="p-12" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-brand-200 text-sm">
                    <thead className="bg-brand-50/80">
                      <tr>
                        <th className="th">{tr('approvals.requestNo')}</th>
                        <th className="th">{tr('approvals.date')}</th>
                        <th className="th">{tr('approvals.requestedBy')}</th>
                        <th className="th">{tr('approvals.entity')}</th>
                        <th className="th">{tr('approvals.amount')}</th>
                        <th className="th">{tr('approvals.status')}</th>
                        <th className="th">{tr('approvals.progress')}</th>
                        <th className="th">{tr('members.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-200">
                      {requests.map((request) => (
                        <tr key={request._id} className="tr-hover">
                          <td className="td font-mono text-brand-900">{request.requestNo}</td>
                          <td className="td text-brand-700">{formatDate(request.createdAt)}</td>
                          <td className="td font-medium text-brand-900">
                            {lang === 'bn' && request.requestedBy?.nameBn
                              ? request.requestedBy.nameBn
                              : request.requestedBy?.name || '-'}
                            <br />
                            <span className="text-xs text-brand-500">
                              {tr(`role.${request.requestedBy?.role}`)}
                            </span>
                          </td>
                          <td className="td capitalize">
                            {tr(`approvals.entity.${request.entityType}`) || request.entityType}
                          </td>
                          <td className="td font-mono font-semibold text-brand-900">
                            {formatMoney(request.amountPaisa || 0)}
                          </td>
                          <td className="td">
                            <StatusBadge status={request.status} />
                          </td>
                          <td className="td">
                            <span className="text-sm text-brand-700">
                              {request.approvalCount || 0} / {request.requiredApprovals || 1}
                            </span>
                          </td>
                          <td className="td">
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={() => openRequestReview(request)}
                              aria-label={tr('approvals.review')}
                            >
                              {tr('approvals.review')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={requestMeta} onPage={setRequestPage} />
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'kyc' && (
        <>
          <form onSubmit={(e) => { e.preventDefault(); setKycPage(1); reloadKyc?.(); }} className="mb-6">
            <FilterBar>
              <SearchInput
                value={kycSearch}
                onChange={(e) => setKycSearch(e.target.value)}
                placeholder={tr('savings.searchPlaceholder')}
                className="flex-1 min-w-[280px] max-w-md"
              />
              <Select
                value={kycStatusFilter}
                onChange={(e) => setKycStatusFilter(e.target.value)}
                options={[
                  { value: '', label: tr('approvals.all') },
                  { value: 'under_review', label: tr('status.under_review') },
                  { value: 'rejected', label: tr('status.rejected') },
                  { value: 'active', label: tr('approvals.pendingUpdates') },
                ]}
                className="w-[180px]"
              />
            </FilterBar>
          </form>

          <div className="card">
            {kycLoading ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="md" />
              </div>
            ) : kycError ? (
              <EmptyState icon="alert" title={tr('common.error')} description={kycError} className="p-8" />
            ) : kycData?.items?.length === 0 ? (
              <EmptyState icon="user" title={tr('approvals.noKyc')} description={tr('common.noData')} className="p-12" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-brand-200 text-sm">
                    <thead className="bg-brand-50/80">
                      <tr>
                        <th className="th">{tr('members.name')}</th>
                        <th className="th">{tr('approvals.email')}</th>
                        <th className="th">{tr('approvals.phone')}</th>
                        <th className="th">{tr('approvals.submittedAt')}</th>
                        <th className="th">{tr('approvals.status')}</th>
                        <th className="th">{tr('members.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-200">
                      {kycData.items.map((user) => (
                        <tr key={user._id} className="tr-hover">
                          <td className="td font-medium text-brand-900">
                            {lang === 'bn' && user.profileData?.fullNameBn
                              ? user.profileData.fullNameBn
                              : user.name || user.profileData?.fullName || '-'}
                            <br />
                            <span className="text-xs text-brand-500 font-mono">{user.email}</span>
                            {user.requestType === 'update' && (
                              <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                {tr('approvals.pendingUpdate')}
                              </span>
                            )}
                          </td>
                          <td className="td text-brand-700">{user.email || '-'}</td>
                          <td className="td text-brand-700">{user.phone || '-'}</td>
                          <td className="td text-brand-700">
                            {user.requestType === 'update'
                              ? user.kycUpdateSubmittedAt
                                ? formatDate(user.kycUpdateSubmittedAt)
                                : '-'
                              : user.kycSubmittedAt
                                ? formatDate(user.kycSubmittedAt)
                                : '-'}
                          </td>
                          <td className="td">
                            <StatusBadge status={user.status} />
                          </td>
                          <td className="td">
                            <button
                              type="button"
                              className="btn-primary text-xs px-3 py-1.5"
                              onClick={() => openKycReview(user)}
                              aria-label={tr('approvals.review')}
                            >
                              {tr('approvals.review')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination meta={kycData?.meta} onPage={setKycPage} />
              </>
            )}
          </div>
        </>
      )}

      <SlipReviewModal
        open={showSlipModal}
        onClose={closeSlipModal}
        slip={reviewingSlip}
        decision={slipDecision}
        onDecisionChange={setSlipDecision}
        submitting={reviewSubmitting}
        onSubmit={handleSlipDecision}
      />

      <RequestReviewModal
        open={showRequestModal}
        onClose={closeRequestModal}
        request={reviewingRequest}
        decision={requestDecision}
        onDecisionChange={setRequestDecision}
        submitting={reviewSubmitting}
        onSubmit={handleRequestDecision}
      />

      <KycReviewModal
        open={showKycModal}
        onClose={closeKycModal}
        user={reviewingKyc}
        decision={kycDecision}
        onDecisionChange={setKycDecision}
        onDecision={submitKycDecision}
        submitting={reviewSubmitting}
        onSubmit={handleKycDecision}
      />
    </AppShell>
  );
}

function SlipReviewModal({ open, onClose, slip, decision, onDecisionChange, submitting, onSubmit }) {
  const { tr, formatMoney, formatDate } = useLang();

  if (!open || !slip) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('approvals.reviewSlip')} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-brand-500">{tr('approvals.paymentNo')}</p>
              <p className="font-mono font-semibold text-brand-900">{slip.paymentNo}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('approvals.date')}</p>
              <p className="font-semibold text-brand-900">{formatDate(slip.createdAt)}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('members.name')}</p>
              <p className="font-semibold text-brand-900">{slip.member?.fullName || '-'}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('savings.type')}</p>
              <p className="font-semibold text-brand-900 capitalize">
                {slip.savingsDue?.savingsType ? tr(`savings.${slip.savingsDue.savingsType}`) : '-'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('savings.amount')}</p>
              <p className="font-mono text-2xl font-bold text-brand-900">
                {formatMoney(slip.amountPaisa || 0)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('savings.method')}</p>
              <p className="font-semibold text-brand-900 capitalize">{tr(`method.${slip.method}`)}</p>
            </div>
            {slip.providerRef && (
              <div className="sm:col-span-2">
                <p className="text-brand-500">{tr('savings.reference')}</p>
                <p className="font-mono text-brand-900">{slip.providerRef}</p>
              </div>
            )}
            {slip.senderNumber && (
              <div className="sm:col-span-2">
                <p className="text-brand-500">{tr('savings.sender')}</p>
                <p className="font-mono text-brand-900">{slip.senderNumber}</p>
              </div>
            )}
            {slip.bankName && (
              <div className="sm:col-span-2">
                <p className="text-brand-500">{tr('savings.bank')}</p>
                <p className="font-mono text-brand-900">{slip.bankName}</p>
              </div>
            )}
            {slip.note && (
              <div className="sm:col-span-2">
                <p className="text-brand-500">{tr('savings.note')}</p>
                <p className="text-brand-900">{slip.note}</p>
              </div>
            )}
          </div>
        </div>

        <FormSection title={tr('approvals.decision')}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="slip-decision"
                value="approved"
                checked={decision.approved}
                onChange={(e) =>
                  onDecisionChange({ ...decision, approved: e.target.value === 'approved' })
                }
                className="h-4 w-4 text-brand-700"
              />
              <span className="font-medium text-brand-900">{tr('approvals.approve')}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="slip-decision"
                value="rejected"
                checked={!decision.approved}
                onChange={(e) =>
                  onDecisionChange({ ...decision, approved: e.target.value === 'approved' })
                }
                className="h-4 w-4 text-red-600"
              />
              <span className="font-medium text-brand-900">{tr('approvals.reject')}</span>
            </label>
          </div>
          {!decision.approved && (
            <Input
              label={tr('approvals.rejectionReason')}
              value={decision.reason}
              onChange={(e) => onDecisionChange({ ...decision, reason: e.target.value })}
              required
              multiline
              rows={3}
            />
          )}
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant={decision.approved ? 'primary' : 'danger'}
            loading={submitting}
            loadingLabel={tr('common.saving')}
          >
            {decision.approved ? tr('approvals.approve') : tr('approvals.reject')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}

const KYC_RELATIONSHIP_KEYS = new Set(['spouse', 'child', 'parent', 'sibling', 'other']);

function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(url) || /\/raw\/upload\//i.test(url);
}

function KycDocumentPreview({ url, alt }) {
  const { tr } = useLang();

  if (!url) {
    return <span className="text-brand-400">{tr('approvals.noDocument')}</span>;
  }

  if (isPdfUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-semibold text-brand-700 underline hover:text-brand-900"
      >
        <Icon name="fileText" className="h-4 w-4" />
        {tr('approvals.viewDocument')}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block"
      title={tr('approvals.viewDocument')}
    >
      <img
        src={url}
        alt={alt || ''}
        className="h-20 w-20 rounded-lg border border-brand-200 bg-white object-cover"
      />
    </a>
  );
}

const KYC_COMPARISON_FIELDS = [
  { key: 'fullName', labelKey: 'members.fullName' },
  { key: 'fullNameBn', labelKey: 'members.fullNameBn' },
  { key: 'fatherHusbandName', labelKey: 'members.fatherHusbandName' },
  { key: 'motherName', labelKey: 'approvals.motherName' },
  { key: 'dateOfBirth', labelKey: 'approvals.dob', type: 'date' },
  { key: 'nid', labelKey: 'approvals.nid' },
  { key: 'occupation', labelKey: 'approvals.occupation' },
  { key: 'phone', labelKey: 'approvals.phone' },
  { key: 'email', labelKey: 'approvals.email' },
  { key: 'presentAddress', labelKey: 'approvals.presentAddress' },
  { key: 'permanentAddress', labelKey: 'approvals.permanentAddress' },
  { key: 'shareCount', labelKey: 'approvals.shareCount' },
  { key: 'notes', labelKey: 'approvals.notes' },
  { key: 'photo', labelKey: 'members.applicantPhoto', type: 'document' },
  { key: 'nidDocument', labelKey: 'members.nidDocument', type: 'document' },
];

const NOMINEE_CHANGE_STYLES = {
  added: 'border-emerald-200 bg-emerald-50/40',
  removed: 'border-rose-200 bg-rose-50/40',
  modified: 'border-amber-300 bg-amber-50/60',
  unchanged: 'border-brand-200 bg-white',
};

const NOMINEE_CHANGE_LABELS = {
  added: 'approvals.nomineeAdded',
  removed: 'approvals.nomineeRemoved',
  modified: 'approvals.nomineeModified',
  unchanged: 'approvals.nomineeUnchanged',
};

function comparableValue(value, type) {
  if (!value) return '';
  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function nomineeComparisonKey(nominee) {
  if (!nominee) return '';
  if (nominee._id) return `id:${nominee._id}`;
  if (nominee.nid) return `nid:${nominee.nid}`;
  return `name:${nominee.name || ''}`;
}

function nomineeComparable(nominee) {
  return {
    name: nominee?.name || '',
    relation: nominee?.relation || '',
    nid: nominee?.nid || '',
    phone: nominee?.phone || '',
    percentage: Number(nominee?.percentage) || 0,
    photo: nominee?.photo || '',
    nidDocument: nominee?.nidDocument || '',
  };
}

function nomineesEqual(left, right) {
  return JSON.stringify(nomineeComparable(left)) === JSON.stringify(nomineeComparable(right));
}

function compareNominees(liveNominees, requestedNominees) {
  const live = Array.isArray(liveNominees) ? liveNominees : [];
  const requested = Array.isArray(requestedNominees) ? requestedNominees : [];
  const liveByKey = new Map(live.map((nominee) => [nomineeComparisonKey(nominee), nominee]));
  const requestedByKey = new Map(
    requested.map((nominee) => [nomineeComparisonKey(nominee), nominee]),
  );
  const changes = [];

  requested.forEach((nominee) => {
    const key = nomineeComparisonKey(nominee);
    const previous = liveByKey.get(key);
    if (!previous) {
      changes.push({ key: `added-${key}`, type: 'added', live: null, requested: nominee });
    } else if (nomineesEqual(previous, nominee)) {
      changes.push({ key, type: 'unchanged', live: previous, requested: nominee });
    } else {
      changes.push({ key, type: 'modified', live: previous, requested: nominee });
    }
  });

  live.forEach((nominee) => {
    const key = nomineeComparisonKey(nominee);
    if (!requestedByKey.has(key)) {
      changes.push({
        key: `removed-${key}`,
        type: 'removed',
        live: nominee,
        requested: null,
      });
    }
  });

  return changes;
}

function ProfileComparisonValue({ value, type }) {
  const { formatDate } = useLang();

  if (type === 'document') {
    return <KycDocumentPreview url={value} alt="" />;
  }

  if (value === null || value === undefined || String(value).trim() === '') {
    return <span className="text-brand-400">—</span>;
  }

  if (type === 'date') {
    return <span>{formatDate(value)}</span>;
  }

  return <span>{String(value)}</span>;
}

function NomineeComparisonSide({ title, nominee }) {
  const { tr } = useLang();

  if (!nominee) {
    return (
      <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-400">{title}</p>
        <p className="mt-2 text-sm text-brand-400">{tr('approvals.noNominee')}</p>
      </div>
    );
  }

  const relation = nominee.relation
    ? KYC_RELATIONSHIP_KEYS.has(nominee.relation)
      ? tr(`relationship.${nominee.relation}`)
      : nominee.relation
    : '-';

  return (
    <div className="rounded-lg border border-brand-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-400">{title}</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <dt className="text-brand-500">{tr('members.nomineeRelation')}</dt>
          <dd className="text-right font-medium text-brand-900">{relation}</dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="text-brand-500">{tr('approvals.nomineeNid')}</dt>
          <dd className="text-right font-mono text-brand-900">{nominee.nid || '-'}</dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="text-brand-500">{tr('approvals.nomineePhone')}</dt>
          <dd className="text-right text-brand-900">{nominee.phone || '-'}</dd>
        </div>
        <div className="flex items-start justify-between gap-2">
          <dt className="text-brand-500">{tr('approvals.nomineeShare')}</dt>
          <dd className="text-right font-semibold text-brand-900">{Number(nominee.percentage) || 0}%</dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] text-brand-500">{tr('members.nomineePhoto')}</p>
          <KycDocumentPreview url={nominee.photo} alt={nominee.name || ''} />
        </div>
        <div>
          <p className="mb-1 text-[11px] text-brand-500">{tr('members.nomineeNidDocument')}</p>
          <KycDocumentPreview url={nominee.nidDocument} alt={nominee.name || ''} />
        </div>
      </div>
    </div>
  );
}

function ProfileUpdateComparison({ live, requested }) {
  const { tr } = useLang();

  const fields = KYC_COMPARISON_FIELDS.map((field) => {
    const liveValue = comparableValue(live?.[field.key], field.type);
    const requestedValue = comparableValue(requested?.[field.key], field.type);
    return { ...field, liveValue, requestedValue, changed: liveValue !== requestedValue };
  });
  const changedCount = fields.filter((field) => field.changed).length;
  const nomineeChanges = compareNominees(live?.nominees, requested?.nominees);
  const changedNomineeCount = nomineeChanges.filter((change) => change.type !== 'unchanged').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-brand-900">
            {requested?.fullName || live?.fullName || '-'}
          </p>
          <p className="text-xs text-brand-500">{tr('approvals.requestedChanges')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              changedCount
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {changedCount
              ? tr('approvals.changedFields', { count: changedCount })
              : tr('approvals.noChanges')}
          </span>
          {changedNomineeCount > 0 && (
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {tr('approvals.nominees')}: {changedNomineeCount}
            </span>
          )}
        </div>
      </div>

      <FormSection title={tr('approvals.requestedChanges')}>
        <div className="overflow-x-auto rounded-xl border border-brand-200">
          <table className="min-w-full text-sm">
            <thead className="bg-brand-50/80">
              <tr>
                <th className="th">{tr('approvals.field')}</th>
                <th className="th">{tr('approvals.currentLive')}</th>
                <th className="th">{tr('approvals.requestedChanges')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {fields.map((field) => (
                <tr key={field.key} className={field.changed ? 'bg-amber-50' : ''}>
                  <td
                    className={`td whitespace-nowrap font-medium text-brand-700 ${
                      field.changed ? 'border-l-4 border-amber-400' : ''
                    }`}
                  >
                    {tr(field.labelKey)}
                  </td>
                  <td className={`td ${field.changed ? 'text-brand-500' : 'text-brand-700'}`}>
                    <ProfileComparisonValue value={field.liveValue} type={field.type} />
                  </td>
                  <td
                    className={`td ${
                      field.changed ? 'font-semibold text-amber-900' : 'text-brand-700'
                    }`}
                  >
                    <ProfileComparisonValue value={field.requestedValue} type={field.type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>

      <FormSection title={tr('approvals.nominees')}>
        {nomineeChanges.length === 0 ? (
          <p className="text-sm text-brand-400">{tr('approvals.noNominee')}</p>
        ) : (
          <div className="space-y-3">
            {nomineeChanges.map((change) => (
              <div
                key={change.key}
                className={`rounded-xl border p-4 ${NOMINEE_CHANGE_STYLES[change.type]}`}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-brand-900">
                    {change.requested?.name || change.live?.name || tr('approvals.nominee')}
                  </p>
                  <span className="rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                    {tr(NOMINEE_CHANGE_LABELS[change.type])}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NomineeComparisonSide title={tr('approvals.currentLive')} nominee={change.live} />
                  <NomineeComparisonSide
                    title={tr('approvals.requestedChanges')}
                    nominee={change.requested}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </FormSection>
    </div>
  );
}

function KycReviewModal({ open, onClose, user, decision, onDecisionChange, onDecision, submitting, onSubmit }) {
  const { tr, formatDate } = useLang();

  if (!open || !user) return null;

  const profile = user.profileData || {};
  const live = user.liveData || {};
  const requested = user.requestedData || profile;
  const isUpdate = user.requestType === 'update';
  const nominees = Array.isArray(profile.nominees) ? profile.nominees : [];
  const fullName = (isUpdate ? requested.fullName : profile.fullName) || user.name || '-';

  const relationLabel = (relation) => {
    if (!relation) return '-';
    return KYC_RELATIONSHIP_KEYS.has(relation) ? tr(`relationship.${relation}`) : relation;
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (!isUpdate) onSubmit(event);
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isUpdate ? tr('approvals.reviewProfileUpdate') : tr('approvals.reviewKyc')}
      size="lg"
    >
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {isUpdate ? (
          <ProfileUpdateComparison live={live} requested={requested} />
        ) : (
          <>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="sm:col-span-2">
                  <p className="text-brand-500">{tr('members.name')}</p>
                  <p className="font-semibold text-brand-900">{fullName}</p>
                  {profile.fullNameBn && <p className="text-brand-700">{profile.fullNameBn}</p>}
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.email')}</p>
                  <p className="font-semibold text-brand-900">{profile.email || user.email || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.phone')}</p>
                  <p className="font-semibold text-brand-900">{profile.phone || user.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.nid')}</p>
                  <p className="font-mono font-semibold text-brand-900">{profile.nid || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.dob')}</p>
                  <p className="font-semibold text-brand-900">{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('members.fatherHusbandName')}</p>
                  <p className="font-semibold text-brand-900">{profile.fatherHusbandName || profile.fatherName || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.motherName')}</p>
                  <p className="font-semibold text-brand-900">{profile.motherName || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.spouseName')}</p>
                  <p className="font-semibold text-brand-900">{profile.spouseName || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.occupation')}</p>
                  <p className="font-semibold text-brand-900">{profile.occupation || '-'}</p>
                </div>
                <div className="sm:col-span-2 border-t border-brand-200 pt-2 mt-2">
                  <p className="text-brand-500 font-medium mb-1">{tr('approvals.presentAddress')}</p>
                  <p className="whitespace-pre-line text-brand-900">{profile.presentAddress || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-brand-500 font-medium mb-1">{tr('approvals.permanentAddress')}</p>
                  <p className="whitespace-pre-line text-brand-900">{profile.permanentAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.shareCount')}</p>
                  <p className="font-semibold text-brand-900">{profile.shareCount || '0'}</p>
                </div>
                <div>
                  <p className="text-brand-500">{tr('approvals.submittedAt')}</p>
                  <p className="font-semibold text-brand-900">{user.kycSubmittedAt ? formatDate(user.kycSubmittedAt) : '-'}</p>
                </div>
                {profile.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-brand-500">{tr('approvals.notes')}</p>
                    <p className="text-brand-900 italic">"{profile.notes}"</p>
                  </div>
                )}
              </div>
            </div>

            <FormSection title={tr('approvals.documents')}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm text-brand-500">{tr('members.applicantPhoto')}</p>
                  <KycDocumentPreview url={profile.photo} alt={fullName} />
                </div>
                <div>
                  <p className="mb-1 text-sm text-brand-500">{tr('members.nidDocument')}</p>
                  <KycDocumentPreview url={profile.nidDocument} alt={tr('members.nidDocument')} />
                </div>
              </div>
            </FormSection>

            <FormSection title={tr('approvals.nominees')}>
              {nominees.length === 0 ? (
                <p className="text-sm text-brand-400">{tr('approvals.noDocument')}</p>
              ) : (
                <div className="space-y-3">
                  {nominees.map((nominee, index) => (
                    <div
                      key={nominee._id || index}
                      className="rounded-xl border border-brand-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-brand-900">
                            {nominee.name || tr('members.nominee', { idx: index + 1 })}
                          </p>
                          <p className="text-xs text-brand-500">
                            {relationLabel(nominee.relation)} · {tr('approvals.nomineeShare')}: {Number(nominee.percentage) || 0}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="text-brand-500">{tr('approvals.nomineeNid')}</p>
                          <p className="font-mono text-brand-900">{nominee.nid || '-'}</p>
                        </div>
                        <div>
                          <p className="text-brand-500">{tr('approvals.nomineePhone')}</p>
                          <p className="text-brand-900">{nominee.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-brand-500">{tr('members.nomineePhoto')}</p>
                          <KycDocumentPreview url={nominee.photo} alt={nominee.name || ''} />
                        </div>
                        <div>
                          <p className="mb-1 text-brand-500">{tr('members.nomineeNidDocument')}</p>
                          <KycDocumentPreview url={nominee.nidDocument} alt={nominee.name || ''} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>
          </>
        )}

        {isUpdate ? (
          <FormSection title={tr('approvals.decision')}>
            <Input
              label={tr('approvals.rejectionReason')}
              value={decision.reason}
              onChange={(e) => onDecisionChange({ ...decision, reason: e.target.value })}
              multiline
              rows={3}
            />
            <p className="mt-2 text-xs text-brand-500">{tr('approvals.updateReasonHint')}</p>
          </FormSection>
        ) : (
          <FormSection title={tr('approvals.decision')}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="kyc-decision"
                  value="approved"
                  checked={decision.decision === 'approved'}
                  onChange={(e) => onDecisionChange({ ...decision, decision: e.target.value })}
                  className="h-4 w-4 text-brand-700"
                />
                <span className="font-medium text-brand-900">{tr('approvals.approve')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="kyc-decision"
                  value="rejected"
                  checked={decision.decision === 'rejected'}
                  onChange={(e) => onDecisionChange({ ...decision, decision: e.target.value })}
                  className="h-4 w-4 text-red-600"
                />
                <span className="font-medium text-brand-900">{tr('approvals.reject')}</span>
              </label>
            </div>
            <Input
              label={decision.decision === 'rejected' ? tr('approvals.rejectionReason') : tr('approvals.note')}
              value={decision.reason}
              onChange={(e) => onDecisionChange({ ...decision, reason: e.target.value })}
              required={decision.decision === 'rejected'}
              multiline
              rows={3}
            />
          </FormSection>
        )}

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          {isUpdate ? (
            <>
              <Button
                type="button"
                variant="danger"
                loading={submitting}
                loadingLabel={tr('common.saving')}
                onClick={() => onDecision('rejected')}
              >
                {tr('approvals.rejectRequest')}
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                loadingLabel={tr('common.saving')}
                onClick={() => onDecision('approved')}
              >
                {tr('approvals.approveUpdates')}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              variant={decision.decision === 'approved' ? 'primary' : 'danger'}
              loading={submitting}
              loadingLabel={tr('common.saving')}
            >
              {decision.decision === 'approved' ? tr('approvals.approve') : tr('approvals.reject')}
            </Button>
          )}
        </FormActions>
      </form>
    </Modal>
  );
}

function RequestReviewModal({ open, onClose, request, decision, onDecisionChange, submitting, onSubmit }) {
  const { tr, formatMoney, formatDate } = useLang();

  if (!open || !request) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('approvals.reviewRequest')} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-brand-500">{tr('approvals.requestNo')}</p>
              <p className="font-mono font-semibold text-brand-900">{request.requestNo}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('approvals.date')}</p>
              <p className="font-semibold text-brand-900">{formatDate(request.createdAt)}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('approvals.requestedBy')}</p>
              <p className="font-semibold text-brand-900">{request.requestedBy?.name || '-'}</p>
            </div>
            <div>
              <p className="text-brand-500">{tr('approvals.entity')}</p>
              <p className="font-semibold text-brand-900 capitalize">
                {tr(`approvals.entity.${request.entityType}`) || request.entityType}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('approvals.amount')}</p>
              <p className="font-mono text-2xl font-bold text-brand-900">
                {formatMoney(request.amountPaisa || 0)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('approvals.action')}</p>
              <p className="font-semibold text-brand-900">{request.action}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-brand-500">{tr('approvals.progress')}</p>
              <p className="font-semibold text-brand-900">
                {request.approvalCount || 0} / {request.requiredApprovals || 1} {tr('approvals.approvals')}
              </p>
            </div>
            {request.metadata && Object.keys(request.metadata).length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-brand-500">{tr('approvals.metadata')}</p>
                <pre className="text-xs text-brand-700 bg-white p-2 rounded overflow-auto">
                  {JSON.stringify(request.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <FormSection title={tr('approvals.decision')}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="request-decision"
                value="approved"
                checked={decision.decision === 'approved'}
                onChange={(e) => onDecisionChange({ ...decision, decision: e.target.value })}
                className="h-4 w-4 text-brand-700"
              />
              <span className="font-medium text-brand-900">{tr('approvals.approve')}</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="request-decision"
                value="rejected"
                checked={decision.decision === 'rejected'}
                onChange={(e) => onDecisionChange({ ...decision, decision: e.target.value })}
                className="h-4 w-4 text-red-600"
              />
              <span className="font-medium text-brand-900">{tr('approvals.reject')}</span>
            </label>
          </div>
          <Input
            label={decision.decision === 'rejected' ? tr('approvals.rejectionReason') : tr('approvals.note')}
            value={decision.note}
            onChange={(e) => onDecisionChange({ ...decision, note: e.target.value })}
            required={decision.decision === 'rejected'}
            multiline
            rows={3}
          />
        </FormSection>

        <FormActions>
          <Button type="button" variant="secondary" onClick={onClose}>
            {tr('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant={decision.decision === 'approved' ? 'primary' : 'danger'}
            loading={submitting}
            loadingLabel={tr('common.saving')}
          >
            {decision.decision === 'approved' ? tr('approvals.approve') : tr('approvals.reject')}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}