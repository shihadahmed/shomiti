'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { Icon, Input, Button } from '@/components/ui/common';

const FEATURES = [
  { icon: 'users', key: 'login.featureMembers' },
  { icon: 'wallet', key: 'login.featureSavings' },
  { icon: 'shield', key: 'login.featureApprovals' },
  { icon: 'file', key: 'login.featureDocs' },
];

export default function LoginPage() {
  const router = useRouter();
  const { tr, lang, setLang } = useLang();

  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [nextUrl, setNextUrl] = useState('/dashboard');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    if (next && next.startsWith('/')) setNextUrl(next);
  }, []);

  useEffect(() => {
    if (isAuthenticated) router.replace(nextUrl);
  }, [isAuthenticated, nextUrl, router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    clearError();
    const success = await login(identifier.trim(), password, rememberMe);
    if (success) router.replace(nextUrl);
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

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <span className="h-10 w-10 animate-pulse rounded-2xl bg-brand-700" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ───────────────────────── Brand panel ───────────────────────── */}
      <aside className="auth-gradient relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <span className="auth-glow left-[-90px] top-[-80px] h-64 w-64 bg-gold-300/25" aria-hidden="true" />
        <span className="auth-glow bottom-[-120px] right-[-80px] h-80 w-80 bg-brand-600/60" aria-hidden="true" />
        <span className="auth-ring -right-24 top-16 h-72 w-72" aria-hidden="true" />
        <span className="auth-ring -right-10 top-32 h-96 w-96 border-gold-200/10" aria-hidden="true" />
        <span className="auth-ring right-16 top-52 h-44 w-44 border-gold-200/20" aria-hidden="true" />
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #E2C475 1px, transparent 1px), linear-gradient(to bottom, #E2C475 1px, transparent 1px)',
            backgroundSize: '58px 58px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 30% 10%, #000 20%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 30% 10%, #000 20%, transparent 75%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Icon name="wallet" className="h-6 w-6 text-gold-300" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">{tr('app.name')}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-gold-200/70">
              {tr('app.tagline')}
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl py-12">
          <p className="reveal-up mb-5 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-200/80">
            <span className="h-px w-7 bg-gradient-to-r from-gold-300 to-transparent" />
            {tr('login.secure')}
          </p>
          <h1
            className="reveal-up text-balance text-[2.35rem] font-bold leading-[1.12] tracking-tight xl:text-[2.9rem]"
            style={{ animationDelay: '60ms' }}
          >
            {tr('login.heroTitle')}
          </h1>
          <p
            className="reveal-up mt-5 max-w-lg text-[15px] leading-relaxed text-brand-100/75"
            style={{ animationDelay: '120ms' }}
          >
            {tr('login.heroText')}
          </p>

          <ul className="mt-9 space-y-3.5">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.key}
                className="reveal-up flex items-center gap-3.5 text-sm text-brand-50/85"
                style={{ animationDelay: `${160 + index * 60}ms` }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 ring-1 ring-gold-200/25">
                  <Icon name={feature.icon} className="h-4 w-4 text-gold-300" />
                </span>
                {tr(feature.key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 text-[11px] text-brand-100/55">
          <span className="inline-flex items-center gap-2">
            <Icon name="shield" className="h-4 w-4 text-gold-300/80" />
            {tr('login.secure')}
          </span>
          <span>{tr('login.footer', { year: 2026 })}</span>
        </div>
      </aside>

      {/* ───────────────────────── Form panel ───────────────────────── */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:py-14">
        <div className="w-full">
          {/* Mobile brand header */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
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
              <h2 className="text-[26px] font-bold tracking-tight text-brand-900">{tr('login.welcome')}</h2>
              <p className="mt-1.5 text-sm text-brand-500">{tr('login.subtitle')}</p>
            </div>

            {error && (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 fade-in"
                role="alert"
                aria-live="assertive"
              >
                <Icon name="alert" className="mt-0.5 h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <Input
                id="login-identifier"
                name="identifier"
                type="text"
                label={tr('login.identifier')}
                placeholder={tr('login.identifierPlaceholder')}
                autoComplete="username"
                inputMode="text"
                value={identifier}
                onChange={updateIdentifier}
                disabled={isLoading}
                required
                icon={<Icon name="users" className="h-5 w-5" />}
              />

              <div>
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  label={tr('login.password')}
                  placeholder={tr('login.passwordPlaceholder')}
                  autoComplete="current-password"
                  value={password}
                  onChange={updatePassword}
                  onKeyUp={detectCapsLock}
                  onKeyDown={detectCapsLock}
                  onBlur={() => setCapsLock(false)}
                  disabled={isLoading}
                  required
                  icon={<Icon name="lock" className="h-5 w-5" />}
                  trailingIcon={
                    <button
                      type="button"
                      className="rounded-md p-0.5 text-brand-400 transition hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? tr('login.hidePassword') : tr('login.showPassword')}
                      aria-pressed={showPassword}
                      tabIndex={0}
                    >
                      <Icon name="eye" className="h-5 w-5" />
                    </button>
                  }
                />
                {capsLock && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600" role="status">
                    <Icon name="alert" className="h-3.5 w-3.5" />
                    Caps Lock is on
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-brand-200 text-brand-700 transition focus:ring-2 focus:ring-brand-700/20"
                  />
                  <span className="text-sm text-brand-700">{tr('login.rememberMe')}</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-medium text-brand-700 transition hover:text-brand-900 hover:underline"
                  onClick={() => setHelpOpen((value) => !value)}
                  aria-expanded={helpOpen}
                >
                  {tr('login.forgotPassword')}
                </button>
              </div>

              {helpOpen && (
                <p className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-xs leading-relaxed text-brand-700 fade-in" role="note">
                  {tr('login.help')}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full shadow-lg shadow-brand-700/20"
                loading={isLoading}
                loadingLabel={tr('login.signingIn')}
                disabled={isLoading || !identifier.trim() || !password}
              >
                <span>{tr('login.signIn')}</span>
                <Icon name="arrowRight" className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-brand-200/80 pt-5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-brand-500">
                <Icon name="shield" className="h-3.5 w-3.5 text-gold-400" />
                {tr('login.secure')}
              </span>

              <div
                className="inline-flex items-center gap-0.5 rounded-full border border-brand-200 bg-brand-50 p-1"
                role="group"
                aria-label={tr('shell.language')}
              >
                <button
                  type="button"
                  className={`lang-btn ${lang === 'bn' ? 'bg-brand-700 text-white shadow-sm hover:text-white' : ''}`}
                  onClick={() => setLang('bn')}
                  aria-pressed={lang === 'bn'}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  className={`lang-btn ${lang === 'en' ? 'bg-brand-700 text-white shadow-sm hover:text-white' : ''}`}
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <p className="mt-7 text-center text-[11px] text-brand-400">
            {tr('login.footer', { year: 2026 })}
          </p>
        </div>
      </main>
    </div>
  );
}
