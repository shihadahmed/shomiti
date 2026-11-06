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
    // Every member owns a portal account, so open the profile where access is managed.
    router.push(member?._id ? `/members/${member._id}` : '/members');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <AppShell>
      <PageHeader title={tr('members.newTitle')} subtitle={tr('members.subtitle')} />
      <MemberRegistrationForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </AppShell>
  );
}