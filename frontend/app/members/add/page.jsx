'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MemberRegistrationForm } from '@/components/members';
import AppShell from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/common';
import { useLang } from '@/lib/useLang';

export default function AddMemberPage() {
  const router = useRouter();
  const { tr } = useLang();

  const handleSuccess = (member) => {
    if (member?._id) {
      router.push(`/members/${member._id}`);
    } else {
      router.push('/members');
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <AppShell>
      <PageHeader title={tr('members.newTitle')} subtitle={tr('members.subtitle')} />
      <MemberRegistrationForm
        mode="page"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </AppShell>
  );
}