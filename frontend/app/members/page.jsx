'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { useApi, apiDelete } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import SearchParamSync from '@/components/layout/SearchParamSync';
import { MemberRegistrationForm } from '@/components/members';
import { Modal } from '@/components/ui/common';
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
  FilterBar,
} from '@/components/ui/common';
import { toast } from 'react-toastify';

const STATUSES = ['all', 'active', 'inactive', 'suspended', 'resigned'];

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

  const queryParams = { page, limit: 10, search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined };

  const { data, loading, error, reload } = useApi('/members', queryParams, {
    enabled: isAuthenticated,
  });

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

  const applyUrlSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
    reload();
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
    if (!window.confirm(tr('common.confirm'))) return;
    try {
      await apiDelete(`/members/${id}`);
      toast.success(tr('toast.deleted'));
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

  return (
    <AppShell>
      <SearchParamSync onChange={applyUrlSearch} />
      <PageHeader
        title={tr('members.title')}
        subtitle={tr('members.subtitle')}
        actions={
          canManageMembers() && (
            <Button variant="primary" onClick={openAdd}>
              <Icon name="plus" className="h-4 w-4" />
              {tr('members.add')}
            </Button>
          )
        }
      />

      <form onSubmit={handleSearch} className="mb-6">
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('members.search')}
            className="flex-1 min-w-[280px] max-w-md"
          />
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            options={STATUSES.map((s) => ({ value: s, label: s === 'all' ? tr('members.allStatus') : tr(`members.${s}`) }))}
            className="w-[180px]"
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
        ) : members.length === 0 ? (
          <EmptyState icon="users" title={tr('members.empty')} description={tr('common.noData')} className="p-12" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-200 text-sm">
                <thead className="bg-brand-50/80">
                  <tr>
                    <th className="th">{tr('members.code')}</th>
                    <th className="th">{tr('members.name')}</th>
                    <th className="th">{tr('members.phone')}</th>
                    <th className="th">{tr('members.joinDate')}</th>
                    <th className="th">{tr('members.savings')}</th>
                    <th className="th">{tr('members.status')}</th>
                    <th className="th">{tr('members.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200">
                  {members.map((member) => (
                    <tr key={member._id} className="tr-hover">
                      <td className="td font-mono text-brand-900">{member.code}</td>
                      <td className="td font-semibold text-brand-900">
                        {lang === 'bn' && member.fullNameBn ? member.fullNameBn : member.fullName}
                      </td>
                      <td className="td font-mono text-brand-700">{member.phone}</td>
                      <td className="td text-brand-700">{member.joinedAt ? formatDate(member.joinedAt) : tr('common.na')}</td>
                      <td className="td font-mono font-semibold text-brand-900">{formatMoney(member.savingsBalance || 0)}</td>
                      <td className="td">
                        <StatusBadge status={member.status} />
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          {canManageMembers() && (
                            <>
                              <button
                                type="button"
                                className="btn-icon h-8 w-8 text-brand-500 hover:bg-brand-100"
                                onClick={() => openEdit(member)}
                                aria-label={tr('common.edit')}
                              >
                                <Icon name="edit" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="btn-icon h-8 w-8 text-red-500 hover:bg-red-100"
                                onClick={() => handleDelete(member._id)}
                                aria-label={tr('common.delete')}
                              >
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            </>
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

      <Modal isOpen={showModal} onClose={closeModal} title={editingMember ? tr('members.editTitle') : tr('members.newTitle')} size="xl">
        <MemberRegistrationForm
          initialData={editingMember}
          mode="modal"
          onSuccess={() => {
            closeModal();
            reload();
          }}
          onCancel={closeModal}
        />
      </Modal>
    </AppShell>
  );
}