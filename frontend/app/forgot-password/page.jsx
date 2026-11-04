'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/useLang';
import { apiPost } from '@/lib/useApi';
import { Icon, Input, Button, LoadingSpinner } from '@/components/ui/common';
import { toast } from 'react-toastify';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { tr } = useLang();

  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await apiPost('/auth/forgot-password', { identifier: trimmed });
      setSuccess(true);
      toast.success(tr('forgotPassword.success'));
    } catch (err) {
      toast.error(err?.message || tr('error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

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
            <h1 className="text-[26px] font-bold tracking-tight text-brand-900">
              {success ? (tr('forgotPassword.sentTitle') || 'Email Sent') : (tr('forgotPassword.title') || 'Forgot Password')}
            </h1>
            <p className="mt-1.5 text-sm text-brand-500">
              {success
                ? (tr('forgotPassword.sentDesc') || 'If the email exists, a password reset link has been sent.')
                : (tr('forgotPassword.subtitle') || 'Enter your email or phone to receive a password reset link.')}
            </p>
          </div>

          {success ? (
            <div className="card card-pad text-center py-12">
              <Icon name="mail" className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-brand-900">
                {tr('forgotPassword.sentTitle') || 'Email Sent'}
              </h3>
              <p className="mt-2 text-brand-500">
                {tr('forgotPassword.sentDesc') || 'If the email exists, a password reset link has been sent.'}
              </p>
              <Button
                variant="primary"
                className="mt-6"
                onClick={() => router.push('/login')}
              >
                {tr('forgotPassword.backToLogin') || 'Back to Login'}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={tr('forgotPassword.identifier') || 'Email or Phone'}
                type="text"
                placeholder={tr('forgotPassword.placeholder') || 'Enter your registered email or phone'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="email"
                icon={<Icon name="mail" className="h-5 w-5" />}
              />
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={submitting}
                loadingLabel={tr('common.sending') || 'Sending...'}
              >
                {tr('forgotPassword.submit') || 'Send Reset Link'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-brand-700 transition hover:text-brand-900 hover:underline"
            >
              {tr('login.backToLogin') || 'Back to Login'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}