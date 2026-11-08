'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { Icon, Input, Button } from '@/components/ui/common';
import { toast } from 'react-toastify';

const FEATURES = [
  { icon: 'users', key: 'login.featureMembers', fallback: 'Member registry with NID and nominee records' },
  { icon: 'wallet', key: 'login.featureSavings', fallback: 'Double-entry savings ledger with receipts' },
  { icon: 'shield', key: 'login.featureApprovals', fallback: 'Multi-level approval gates for every payment' },
  { icon: 'file', key: 'login.featureDocs', fallback: 'Meeting papers, receipts and photos in one vault' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tr, lang, setLang } = useLang();

  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const nextParam = searchParams.get('next');
  const nextUrl = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace(nextUrl);
  }, [isAuthenticated, nextUrl, router]);

  const handleSubmit = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (!identifier.trim() || !password) return;

    clearError();
    try {
      const success = await login(identifier.trim(), password);
      if (success) {
        router.replace(nextUrl);
      }
    } catch (err) {
      console.error('Login submit error:', err);
      toast.error(err?.message || tr('error.generic'));
    }
  };

  const updateIdentifier = (event) => {
    setIdentifier(event.target.value);
    if (error) clearError();
  };

  const updatePassword = (event) => {
    setPassword(event.target.value);
    if (error) clearError();
  };

  const detectCapsLock = (event) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  };

  return (
    /* Full screen background split */
    <div className="relative min-h-screen w-full flex flex-col justify-center">
      {/* Background Color Bars (Full Width 100vw) */}
      <div className="absolute inset-0 hidden lg:grid lg:grid-cols-[45%_55%] pointer-events-none -z-10">
        <div className="h-full w-full bg-gradient-to-br from-[#2D151B] via-[#431B25] to-[#1E0D12]" />
        <div className="h-full w-full bg-[#FAF8F5]" />
      </div>

      {/* Mobile Background Fallback */}
      <div className="absolute inset-0 lg:hidden bg-[#FAF8F5] -z-10" />

      {/* Centered Fixed Content Container (Max 1600px) */}
      <div className="w-full max-w-[1600px] mx-auto min-h-screen grid grid-cols-1 lg:grid-cols-[45%_55%]">
        
        {/* ─────────────── Left Side: Brand Section ─────────────── */}
        <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-20 text-white overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute -left-10 -top-10 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-80 w-80 rounded-full bg-rose-900/30 blur-3xl" />

          {/* Top Brand Header */}
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur-md">
              <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold tracking-tight text-white">
                {tr('app.name') || 'Shopnonir Somobai Somitee'}
              </h2>
              <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-amber-300/80">
                {tr('app.tagline') || 'MEMBERS · SAVINGS · TRANSPARENCY'}
              </p>
            </div>
          </div>

          {/* Center Brand Text */}
          <div className="relative z-10 max-w-lg my-auto py-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3.5 py-1 text-[11px] font-semibold text-amber-200">
              <Icon name="shield" className="h-3.5 w-3.5 text-amber-300" />
              <span>{tr('login.secureSession') || 'Secure session · Session protected'}</span>
            </div>

            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-white">
              {tr('login.heroTitle')}
            </h1>

            <p className="mt-4 text-sm leading-relaxed text-rose-100/75">
              {tr('login.heroText')}
            </p>

            <ul className="mt-8 space-y-3.5">
              {FEATURES.map((feature) => (
                <li key={feature.key} className="flex items-center gap-3 text-xs text-rose-50/90 font-medium">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icon name={feature.icon} className="h-3.5 w-3.5 text-amber-300" />
                  </span>
                  <span>{tr(feature.key)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer Note */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-rose-200/60">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shield" className="h-3.5 w-3.5 text-amber-400/90" />
              {tr('login.sslSecured')}
            </span>
            <span>{tr('login.copyright')}</span>
          </div>
        </aside>

        {/* ─────────────── Right Side: Login Form ─────────────── */}
        <main className="flex items-center justify-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[420px]">
            {/* Mobile Header */}
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#431B25] p-2 shadow-lg ring-4 ring-rose-100">
                <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
              </div>
              <h2 className="text-base font-bold text-gray-900">{tr('app.name')}</h2>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{tr('app.tagline')}</p>
            </div>

            {/* Form Title */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                {tr('login.welcomeBack') || 'Welcome back'}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {tr('login.signInToManage') || 'Sign in to manage your cooperative account'}
              </p>
            </div>

            {/* Error Message - using toast instead of inline */}

            {/* Inputs */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-identifier" className="mb-1.5 block text-xs font-semibold text-gray-700">
                  {tr('login.identifierLabel') || 'Email or Phone'}
                </label>
                <Input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  placeholder={tr('login.identifierPlaceholder') || '017XXXXXXXX or name@example.com'}
                  autoComplete="username"
                  value={identifier}
                  onChange={updateIdentifier}
                  disabled={isLoading}
                  required
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs font-semibold text-gray-700">
                    {tr('login.passwordLabelShort') || 'Password'}
                  </label>
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#431B25] hover:underline"
                    onClick={() => setHelpOpen((prev) => !prev)}
                  >
                    {tr('login.forgotPasswordBtn') || 'Forgot password?'}
                  </button>
                </div>

                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={tr('login.passwordPlaceholderShort') || 'Enter your password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={updatePassword}
                    onKeyUp={detectCapsLock}
                    onKeyDown={detectCapsLock}
                    onBlur={() => setCapsLock(false)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    onClick={() => setShowPassword((prev) => !prev)}
                    tabIndex={-1}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} className="h-4 w-4" />
                  </button>
                </div>

                {capsLock && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
                    <Icon name="alert" className="h-3 w-3" />
                    {tr('login.capsLockWarning') || 'Caps Lock is ON'}
                  </p>
                )}
              </div>

              {helpOpen && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 font-medium">
                  {tr('login.helpOpenText') || 'Contact your society Super Admin to issue a temporary password or reset your account credentials.'}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-2 w-full bg-[#431B25] hover:bg-[#32131B] text-white shadow-md shadow-[#431B25]/20"
                loading={isLoading}
                loadingLabel={tr('login.signingInBtn') || 'Signing in...'}
              >
                <span>{tr('login.signInBtn') || 'Sign in'}</span>
                <Icon name="arrowRight" className="ml-1.5 h-4 w-4" />
              </Button>
            </form>

            {/* Bottom Language & Status Controls */}
            <div className="mt-8 flex items-center justify-between border-t border-gray-200/70 pt-4 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                <Icon name="shield" className="h-3.5 w-3.5 text-emerald-600" />
                {tr('login.secureSessionShort') || 'Secure session · Session protected'}
              </span>

              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                  type="button"
                  className={`rounded px-2.5 py-0.5 text-[11px] font-bold transition ${
                    lang === 'bn' ? 'bg-[#431B25] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={async () => {
                    setLang('bn');
                    try {
                      const { apiClient } = await import('@/lib/api');
                      await apiClient.post('/auth/update-language', { language: 'bn' });
                    } catch (error) {
                      console.error('Failed to save language preference:', error);
                    }
                  }}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  className={`rounded px-2.5 py-0.5 text-[11px] font-bold transition ${
                    lang === 'en' ? 'bg-[#431B25] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={async () => {
                    setLang('en');
                    try {
                      const { apiClient } = await import('@/lib/api');
                      await apiClient.post('/auth/update-language', { language: 'en' });
                    } catch (error) {
                      console.error('Failed to save language preference:', error);
                    }
                  }}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#431B25] p-3 shadow-lg ring-4 ring-rose-100 animate-pulse">
            <img src="/logo.png" alt="Loading" className="h-full w-full object-contain" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}