'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { apiPost } from '@/lib/useApi';
import { Icon, Input, Button, LoadingSpinner } from '@/components/ui/common';
import { toast } from 'react-toastify';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tr } = useLang();
  
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error(tr('resetPassword.tokenInvalid'));
    }
  }, [token, tr]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) {
      toast.error(tr('validation.mismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await apiPost('/auth/setup-password', { token, password });
      setSuccess(true);
      toast.success(tr('resetPassword.success'));
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="card card-pad text-center py-12">
        <Icon name="alert" className="mx-auto h-12 w-12 text-amber-500" />
        <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('resetPassword.tokenInvalid')}</h3>
        <p className="mt-2 text-brand-500">The link may have expired or is invalid. Please contact your administrator.</p>
        <Button 
          variant="secondary" 
          className="mt-6" 
          onClick={() => router.push('/login')}
        >
          {tr('resetPassword.login')}
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card card-pad text-center py-12">
        <Icon name="check" className="mx-auto h-12 w-12 text-green-500" />
        <h3 className="mt-4 text-lg font-semibold text-brand-900">{tr('resetPassword.success')}</h3>
        <p className="mt-2 text-brand-500">Your password has been set up. You can now sign in to your account.</p>
        <Button 
          variant="primary" 
          className="mt-6" 
          onClick={() => router.push('/login')}
        >
          {tr('resetPassword.login')}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <Input
            label={tr('resetPassword.password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label={tr('resetPassword.confirmPassword')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <Button 
          type="submit" 
          variant="primary" 
          className="w-full" 
          loading={submitting} 
          loadingLabel={tr('common.saving')}
        >
          {tr('resetPassword.submit')}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { tr } = useLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-5 py-10 sm:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-700 shadow-lg ring-4 ring-brand-100">
            <Icon name="wallet" className="h-5 w-5 text-gold-300" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-brand-900">{tr('app.name')}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-brand-500">{tr('app.tagline')}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-brand-200/70 bg-white/95 p-6 shadow-[0_30px_70px_-40px_rgba(45,21,27,0.55)] backdrop-blur sm:p-9 slide-up">
          <div className="mb-7">
            <h1 className="text-[26px] font-bold tracking-tight text-brand-900">{tr('resetPassword.title')}</h1>
            <p className="mt-1.5 text-sm text-brand-500">{tr('resetPassword.subtitle')}</p>
          </div>
          <Suspense fallback={<LoadingSpinner size="md" className="mx-auto" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
