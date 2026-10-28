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
  const [activeTab, setActiveTab] = useState('slips'); // 'slips' or 'requests'
  const [slipPage, setSlipPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [slipSearch, setSlipSearch] = useState('');
  const [slipStatusFilter, setSlipStatusFilter] = useState('');
  const [slipMethodFilter, setSlipMethodFilter] = useState('');
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('');
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reviewingSlip, setReviewingSlip] = useState(null);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [slipDecision, setSlipDecision] = useState({ approved: true, reason: '' });
  const [requestDecision, setRequestDecision] = useState({ decision: 'approved', note: '' });
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