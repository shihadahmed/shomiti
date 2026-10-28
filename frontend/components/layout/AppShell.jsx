'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster, toast } from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth';
import { useLang } from '@/lib/useLang';
import { apiClient } from '@/lib/api';
import { initials } from '@/lib/i18n';
import { Icon, Button, Modal, Input } from '@/components/ui/common';
import Sidebar from './SidebarV2';
import GlobalSearch from './GlobalSearch';

let approvalsCache = { userId: null, total: 0, promise: null };
const approvalsListeners = new Set();

function emitApprovalsChange() {
  approvalsListeners.forEach((listener) => listener());
}

export function subscribeApprovals(listener) {
  approvalsListeners.add(listener);
  return () => approvalsListeners.delete(listener);
}

export function getApprovalsTotal() {
  return approvalsCache.total;
}

export function decrementApprovalsTotal() {
  if (approvalsCache.total <= 0) return;
  approvalsCache = { ...approvalsCache, total: approvalsCache.total - 1 };
  emitApprovalsChange();
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tr, lang, setLang } = useLang();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loadSession = useAuthStore((state) => state.loadSession);
  const logout = useAuthStore((state) => state.logout);
  const setUser = useAuthStore((state) => state.setUser);

  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const pendingApprovals = useSyncExternalStore(
    subscribeApprovals,
    getApprovalsTotal,
    () => 0,
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadSession().finally(() => {
      if (active) setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [loadSession]);

  useEffect(() => {
    if (!checking && !isAuthenticated) {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [checking, isAuthenticated, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function closeMenu(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => {
    const { user: currentUser, isAuthenticated: authed } = useAuthStore.getState();
    const userId = currentUser?._id;

    if (!userId) {
      if (approvalsCache.userId !== null || approvalsCache.total !== 0) {
        approvalsCache = { userId: null, total: 0, promise: null };
        emitApprovalsChange();
      }
      return undefined;
    }

    if (!authed || currentUser.role === 'member') return undefined;

    if (approvalsCache.userId !== userId) {
      approvalsCache = { userId, total: 0, promise: null };
      approvalsCache.promise = (async () => {
        try {
          const [slips, requests] = await Promise.all([
            apiClient.get('/approvals/slips', { status: 'pending', limit: 1 }),
            apiClient.get('/approvals', { status: 'pending', limit: 1 }),
          ]);
          const totalSlips = slips.data?.data?.meta?.total || slips.data?.meta?.total || 0;
          const totalReqs = requests.data?.data?.meta?.total || requests.data?.meta?.total || 0;
          return totalSlips + totalReqs;
        } catch {
          return 0;
        }
      })();
      approvalsCache.promise.then((total) => {
        if (approvalsCache.userId !== userId) return;
        approvalsCache = { ...approvalsCache, total };
        emitApprovalsChange();
      });
    }

    return undefined;
  }, [user?._id]);

  const displayName = lang === 'bn' && user?.nameBn ? user.nameBn : user?.name;

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FDFBF7]">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#6B1D2F] shadow-xl ring-4 ring-[#D4AF37]/30">
          <img src="/logo.png" alt="" className="h-full w-full object-cover animate-pulse" aria-hidden="true" />
        </div>
        <p className="font-medium tracking-wide text-xs text-[#6B1D2F]">{tr('common.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D151B]">
      <Sidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
        pendingApprovals={pendingApprovals}
      />

      <div className={`flex min-h-screen min-w-0 flex-col transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        
        {/* Navbar */}
        <header className="sticky top-0 z-30 w-full border-b border-[#E8D3A7]/60 bg-white/90 backdrop-blur-md shadow-xs">
          <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            
            {/* Mobile Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#6B1D2F] hover:bg-[#F7EEDD] transition-colors lg:hidden focus:outline-none"
                onClick={() => setMobileOpen(true)}
                aria-label={tr('shell.menu')}
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
            </div>

            {/* Global Search */}
            <div className="flex-1 max-w-md mx-2">
              <GlobalSearch className="w-full" />
            </div>

            {/* Actions & Profile */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              
              {/* Notification Bell */}
              <Link
                href="/notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#6B1D2F] hover:bg-[#F7EEDD] transition-colors"
                aria-label={tr('settings.notifications')}
              >
                <Icon name="bell" className="h-5 w-5" />
                {pendingApprovals > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                    {pendingApprovals > 99 ? '99+' : pendingApprovals}
                  </span>
                )}
              </Link>

              {/* User Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-full p-0.5 transition-all hover:ring-2 hover:ring-[#D4AF37] focus:outline-none"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label={displayName || 'Profile'}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6B1D2F] to-[#531322] text-xs font-bold text-white shadow-sm ring-2 ring-[#D4AF37]/50">
                    {initials(displayName || '')}
                  </div>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2.5 w-64 origin-top-right overflow-hidden rounded-2xl border border-[#E8D3A7] bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100" role="menu">
                    
                    {/* User Identity Card */}
                    <div className="flex items-center gap-3 rounded-xl bg-[#FDFBF7] p-3 border border-[#E8D3A7]/50 mb-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B1D2F] text-xs font-bold text-white shadow-sm ring-2 ring-[#D4AF37]/40">
                        {initials(displayName || '')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#2D151B]">{displayName}</p>
                        <span className="inline-block rounded-md bg-[#F7EEDD] px-1.5 py-0.5 text-[10px] font-semibold text-[#6B1D2F]">
                          {tr(`role.${user.role}`)}
                        </span>
                        <p className="truncate text-[11px] text-stone-500 mt-0.5">{user.email || user.phone}</p>
                      </div>
                    </div>

                    {/* Language Switcher */}
                    <div className="mb-2 rounded-xl bg-gradient-to-r from-[#FDFBF7] to-[#F7EEDD]/60 p-2 border border-[#E8D3A7]/40">
                      <div className="flex items-center justify-between pb-1.5 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B1D2F]/70">
                          {tr('shell.language')}
                        </span>
                        <span className="text-[10px] font-semibold text-[#D4AF37]">
                          {lang === 'bn' ? 'বাংলা ভার্সন' : 'English Mode'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLang('bn')}
                          className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                            lang === 'bn'
                              ? 'bg-[#6B1D2F] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                              : 'bg-white/80 text-stone-600 hover:bg-white hover:text-[#6B1D2F]'
                          }`}
                        >
                          <span>বাংলা</span>
                          {lang === 'bn' && <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLang('en')}
                          className={`relative flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                            lang === 'en'
                              ? 'bg-[#6B1D2F] text-white shadow-sm ring-1 ring-[#D4AF37]/50'
                              : 'bg-white/80 text-stone-600 hover:bg-white hover:text-[#6B1D2F]'
                          }`}
                        >
                          <span>English</span>
                          {lang === 'en' && <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />}
                        </button>
                      </div>
                    </div>

                    {/* Menu Links */}
                    <div className="space-y-0.5 py-1">
                      <Link
                        href="/settings"
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-stone-700 hover:bg-[#F7EEDD] hover:text-[#6B1D2F] transition-colors"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Icon name="settings" className="h-4 w-4 text-[#6B1D2F]" />
                        {tr('shell.myAccount')}
                      </Link>

                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-stone-700 hover:bg-[#F7EEDD] hover:text-[#6B1D2F] transition-colors"
                        onClick={() => { setPasswordOpen(true); setUserMenuOpen(false); }}
                        role="menuitem"
                      >
                        <Icon name="lock" className="h-4 w-4 text-[#6B1D2F]" />
                        {tr('shell.changePassword')}
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-stone-100 pt-1 mt-1">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                        onClick={logout}
                        role="menuitem"
                      >
                        <Icon name="logout" className="h-4 w-4" />
                        {tr('shell.logout')}
                      </button>
                    </div>

                  </div>
                )}
              </div>

            </div>
          </div>
        </header>

        {/* Dynamic Body Content */}
        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-[#E8D3A7]/60 bg-white/50 px-4 py-4 text-[11px] font-medium text-stone-500 sm:px-6 lg:px-8">
          <span>{tr('login.footer', { year: new Date().getFullYear() })}</span>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {tr('dashboard.sessionActive')}
          </div>
        </footer>
      </div>

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onChanged={(nextUser) => setUser(nextUser)}
      />

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#2D151B',
            border: '1px solid #E8D3A7',
            borderRadius: '14px',
            fontSize: '13px',
            boxShadow: '0 10px 25px -5px rgba(107, 29, 47, 0.1)',
          },
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />
    </div>
  );
}

function ChangePasswordModal({ open, onClose, onChanged }) {
  const { tr } = useLang();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError(tr('password.mismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success(tr('toast.passwordChanged'));
      onChanged(response.data?.data?.user);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onClose();
    } catch (requestError) {
      const message = requestError?.message || tr('error.generic');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('password.title')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">{error}</p>}
        <Input
          label={tr('password.current')}
          type="password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
          required
        />
        <Input
          label={tr('password.new')}
          type="password"
          autoComplete="new-password"
          hint={tr('password.hint')}
          value={form.newPassword}
          onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
          required
        />
        <Input
          label={tr('password.confirm')}
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{tr('common.cancel')}</Button>
          <Button type="submit" loading={loading} loadingLabel={tr('common.saving')}>{tr('password.submit')}</Button>
        </div>
      </form>
    </Modal>
  );
}