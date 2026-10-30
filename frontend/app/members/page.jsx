'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiDelete } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import MemberRegistrationForm from '@/components/members/MemberRegistrationForm';
import {
  Icon,
  Button,
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

const STATUSES = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'resigned', label: 'Resigned' },
];

export default function MembersPage() {
  const router = useRouter();
  const { tr, lang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const canManageMembers = useAuthStore((state) => state.canManageMembers);

  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const queryParams = useMemo(() => ({
    page,
    limit: 10,
    search: search.trim() || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  }), [page, search, statusFilter]);

  const { data, loading, error, reload } = useApi('/members', queryParams, {
    enabled: isAuthenticated,
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

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  };

  const openAdd = () => {
    setEditingMember(null);
    setShowModal(true);
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMember(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(tr('common.confirm') || 'Are you sure you want to delete this member?')) return;
    try {
      await apiDelete(`/members/${id}`);
      toast.success(tr('toast.deleted') || 'Member deleted successfully');
      reload();
    } catch (requestError) {
      toast.error(requestError?.message || tr('error.generic'));
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

  const members = data?.items || [];
  const meta = data?.meta || { total: 0, pages: 1 };
  const hasActiveFilters = Boolean(search || statusFilter !== 'all');

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('members.title') || 'Shodoshsho Talika'}
          subtitle={tr('members.subtitle') || 'Somitir shokol nibondhito shodoshsho o tader shonchoy profile'}
        />
        {canManageMembers?.() && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="primary" onClick={openAdd} className="shadow-xs">
              <Icon name="plus" className="h-4 w-4 mr-1.5" />
              {tr('members.add') || 'Notun Shodoshsho Jog Korun'}
            </Button>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-brand-200/80 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('members.search') || 'Naam, code ba phone number diye khujun...'}
              className="w-full sm:max-w-md"
            />
            <Select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              options={STATUSES}
              className="w-full sm:w-[180px] text-xs"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition self-start sm:self-center"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
              Filter Muchun
            </button>
          )}
        </form>
      </div>

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
        ) : members.length === 0 ? (
          <EmptyState
            icon="users"
            title={tr('members.empty') || 'Kono shodoshsho pawa jayni'}
            description={tr('common.noData')}
            className="p-16"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200/70 text-left text-sm">
                <thead className="bg-[#FAF7F2] text-[11px] font-bold uppercase tracking-wider text-brand-600">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">{tr('members.code')}</th>
                    <th scope="col" className="px-5 py-3.5">{tr('members.name')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('members.phone')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('members.joinDate')}</th>
                    <th scope="col" className="px-5 py-3.5 text-right">{tr('members.savings')}</th>
                    <th scope="col" className="px-4 py-3.5">{tr('members.status')}</th>
                    <th scope="col" className="px-5 py-3.5 text-right">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/80 bg-white">
                  {members.map((member) => {
                    const memberName = lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName;

                    return (
                      <tr key={member._id} className="transition-colors hover:bg-brand-50/40">
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className="font-mono text-xs font-semibold text-brand-900 bg-brand-50 px-2 py-1 rounded-md border border-brand-200/60">
                            {member.code || '—'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <Link
                              href={`/members/${member._id}`}
                              className="font-semibold text-brand-900 hover:text-brand-600 transition"
                            >
                              {memberName}
                            </Link>
                            <span className="text-[11px] text-brand-500 font-mono">
                              {member.email || member.nid || ''}
                            </span>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-brand-700">
                          {member.phone || '—'}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-brand-600">
                          {member.joinedAt ? formatDate(member.joinedAt) : tr('common.na')}
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-sm font-bold text-emerald-700">
                          {formatMoney(member.savingsBalance || 0)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <StatusBadge status={member.status} />
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/members/${member._id}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-white text-brand-600 transition hover:bg-brand-50 hover:text-brand-900"
                              title={tr('common.view') || 'View Profile'}
                            >
                              <Icon name="eye" className="h-4 w-4" />
                            </Link>

                            {canManageMembers?.() && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEdit(member)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-white text-brand-600 transition hover:bg-brand-50 hover:text-brand-900"
                                  title={tr('common.edit')}
                                >
                                  <Icon name="pencilLine" className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(member._id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/50 text-rose-600 transition hover:bg-rose-100"
                                  title={tr('common.delete')}
                                >
                                  <Icon name="trash" className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-brand-200/70 p-4">
              <Pagination meta={meta} onPage={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingMember ? (tr('members.editTitle') || 'Shodoshsho Tothyo Shompado') : (tr('members.newTitle') || 'Notun Shodoshsho Nibondhon')}
        size="xl"
      >
        <div className="py-2">
          <MemberRegistrationForm
            initialData={editingMember}
            mode="modal"
            onSuccess={() => {
              closeModal();
              reload();
            }}
            onCancel={closeModal}
          />
        </div>
      </Modal>
    </AppShell>
  );
}