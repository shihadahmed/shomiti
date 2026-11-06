'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { useAuthStore } from '@/lib/auth';
import { useApi, apiGet, apiPatch } from '@/lib/useApi';
import AppShell from '@/components/layout/AppShell';
import MemberRegistrationForm from '@/components/members/MemberRegistrationForm';
import {
  PageHeader,
  LoadingSpinner,
  EmptyState,
  Button,
  Icon,
} from '@/components/ui/common';
import { toast } from 'react-toastify';

export default function MemberEditPage() {
  const router = useRouter();
  const params = useParams();
  const { tr } = useLang();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const memberId = params.id;
  const [mounted, setMounted] = useState(false);
  const [initialData, setInitialData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setMounted(true);
    const fetchMember = async () => {
      try {
        const res = await apiGet(`/members/${memberId}`);
        setInitialData(res?.member ?? res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchMember();
  }, [memberId]);

  const handleSuccess = () => {
    toast.success(tr('toast.updated') || 'Member updated successfully');
    router.push(`/members/${memberId}`);
  };

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

  if (loadingData) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!initialData) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto py-12">
          <EmptyState
            icon="alert"
            title={tr('common.notFound')}
            description={tr('members.notFound')}
            actionLabel={tr('common.back')}
            onAction={() => router.back()}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={tr('members.editTitle') || 'Edit Member'}
          subtitle={initialData.code}
        />
        <Button variant="secondary" onClick={() => router.back()}>
          <Icon name="arrowLeft" className="h-4 w-4 mr-1.5" />
          {tr('common.back')}
        </Button>
      </div>

      <div className="rounded-2xl border border-brand-200/80 bg-white p-6 shadow-xs">
        <MemberRegistrationForm
          initialData={initialData}
          onSuccess={handleSuccess}
          onCancel={() => router.back()}
        />
      </div>
    </AppShell>
  );
}